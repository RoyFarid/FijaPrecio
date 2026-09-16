/**
 * FijaPrecio — seed de datos base.
 *
 * Siembra SOLO configuración de sistema y datos de referencia que, de otro modo,
 * terminarían hardcodeados en el código:
 *   - Planes y sus entitlements (límites)
 *   - AppSettings globales (IGV, márgenes, umbrales de consenso, reputación, ...)
 *   - Conversiones de unidades
 *   - Fuentes de scraping y de datos abiertos
 *   - Categorías de insumos raíz
 *   - Plantillas de notificación
 *
 * Es idempotente: usa upsert por clave natural. Se puede correr en cada deploy.
 * NO siembra datos de usuarios/organizaciones (eso es fixture de test, aparte).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// --- helpers ----------------------------------------------------------------

async function setGlobal(key: string, value: Prisma.InputJsonValue) {
  const existing = await prisma.appSetting.findFirst({
    where: { scope: 'GLOBAL', key },
  });
  if (existing) {
    await prisma.appSetting.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.appSetting.create({ data: { scope: 'GLOBAL', key, value } });
  }
}

// --- 1. Planes + entitlements ---------------------------------------------------

const PLANS: Array<{
  code: string;
  name: string;
  priceMonth: string | null;
  sortOrder: number;
  entitlements: Record<string, Prisma.InputJsonValue>;
}> = [
  {
    code: 'FREE',
    name: 'Free',
    priceMonth: '0',
    sortOrder: 0,
    entitlements: {
      ocr_receipts_per_month: 5,
      scraper_cadence: 'weekly',
      on_demand_scrape: false,
      scenario_simulator: false,
      scenario_max_overrides: 1,
      radar_history_days: 7,
      alerts_max: 3,
      pdf_export: false,
      public_catalog: false,
      api_access: false,
      seats: 1,
    },
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    priceMonth: '39.00',
    sortOrder: 1,
    entitlements: {
      ocr_receipts_per_month: -1,
      scraper_cadence: 'daily',
      on_demand_scrape: false,
      scenario_simulator: true,
      scenario_max_overrides: 10,
      radar_history_days: 90,
      alerts_max: 50,
      pdf_export: true,
      public_catalog: true,
      api_access: false,
      seats: 2,
    },
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    priceMonth: '129.00',
    sortOrder: 2,
    entitlements: {
      ocr_receipts_per_month: -1,
      scraper_cadence: 'daily',
      on_demand_scrape: true,
      scenario_simulator: true,
      scenario_max_overrides: -1,
      radar_history_days: 365,
      alerts_max: -1,
      pdf_export: true,
      public_catalog: true,
      api_access: true,
      data_export: true,
      seats: 5,
    },
  },
];

async function seedPlans() {
  for (const p of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      update: { name: p.name, priceMonth: p.priceMonth, sortOrder: p.sortOrder },
      create: {
        code: p.code,
        name: p.name,
        priceMonth: p.priceMonth,
        currency: 'PEN',
        sortOrder: p.sortOrder,
      },
    });
    for (const [key, value] of Object.entries(p.entitlements)) {
      await prisma.planEntitlement.upsert({
        where: { planId_key: { planId: plan.id, key } },
        update: { value },
        create: { planId: plan.id, key, value },
      });
    }
  }
}

// --- 2. AppSettings globales (parámetros de negocio) --------------------------

async function seedGlobalSettings() {
  const settings: Record<string, Prisma.InputJsonValue> = {
    // Impuestos / costeo
    'tax.igv_rate': 0.18,
    'costing.default_margin_pct': 0.3,
    'costing.overhead_method': 'PCT_OF_DIRECT_COST',
    'costing.price_from_markup_on_price': true, // precio = costo / (1 - margen)

    // Consenso estadístico
    'consensus.window_days': 90,
    'consensus.min_sample_size': 5,
    'consensus.outlier_method': 'MAD',
    'consensus.mad_threshold': 3.5,
    'consensus.iqr_multiplier': 1.5, // fallback con muestra pequeña
    'consensus.recency_halflife_days': 45,
    'consensus.source_weights': {
      OFFICIAL: 1.0,
      OCR: 0.9,
      SUPPLIER: 0.8,
      SCRAPE: 0.7,
      MANUAL: 0.5,
    },
    'consensus.confidence_min_to_show': 0.4,
    'consensus.notify_change_pct': 0.1, // avisar si el consenso se mueve >10%
    'consensus.reputation_full_weight_at': 500, // reputación para llegar al peso máximo
    'consensus.confidence_weights': { size: 0.4, dispersion: 0.35, diversity: 0.25 },

    // Reputación de aportantes
    'reputation.points': {
      OBSERVATION_SURVIVED: 5,
      OBSERVATION_REJECTED: -3,
      OCR_VERIFIED: 10,
      SUPPLIER_CONTRIBUTION: 3,
    },
    'reputation.max_weight_multiplier': 2.0,

    // Catálogo / matching
    'catalog.match_min_similarity': 0.35,
    'catalog.match_auto_assign_similarity': 0.62,
    'catalog.autocreate_canonical_status': 'PENDING_REVIEW',

    // Scraping
    'scraper.default_cadence': 'weekly',
    'scraper.top_n_nightly': 100,
    'scraper.result_ttl_hours': 24,
    'scraper.outlier_trim_pct': 0.1, // recorta 10% extremos antes de la mediana
    // sin 'scraper.radar_links_per_source': por default se guardan TODOS los
    // ítems encontrados por fuente en el radar (tabla "ver todos" del frontend).
    // Sólo definir esta clave si se quiere volver a limitar por fuente.
    // Rubro (del insumo/producto) → alias. Acota qué fuentes se raspan:
    // una fuente con `config.rubros=['gastronomia']` no se consulta para muebles.
    'scraper.rubro_aliases': {
      gastronomia: ['gastronomia', 'panaderia', 'pasteleria', 'reposteria', 'abarrotes', 'restaurante', 'cafeteria', 'bodega'],
      muebles: ['muebles', 'carpinteria', 'madera', 'melamina', 'ferreteria', 'construccion', 'closet', 'cocina'],
      confeccion: ['confeccion', 'textil', 'textiles', 'costura', 'ropa', 'avios', 'sastreria', 'bordado'],
    },
    // Menaje/decoración a excluir de CUALQUIER búsqueda (no es por producto):
    // el mismo query genérico ("pan", "queso"...) también matchea sus
    // utensilios/accesorios ("Cuchillo de Pan", "Molde para Pan"). Agregar acá
    // según se detecten nuevos casos — no hace falta tocar código ni desplegar.
    'scraper.accessory_noise_words': [
      'cuchillo', 'cuchillos', 'plato', 'platos', 'tostador', 'tostadora', 'tostadoras',
      'canasta', 'canastas', 'sanduchera', 'sanducheras', 'rebanadora', 'rebanadoras',
      'contenedor', 'contenedores', 'cuadro', 'cuadros', 'taza', 'tazas', 'mug', 'mugs',
      'lonchera', 'loncheras', 'tabla',
    ],

    // Boletas / OCR
    'receipts.retention_days': 365,
    // TESSERACT hasta que se despliegue una imagen con el extra `paddle`.
    'ocr.provider_by_plan': { FREE: 'TESSERACT', PREMIUM: 'TESSERACT', BUSINESS: 'TESSERACT' },
    'ocr.min_line_confidence': 0.55,

    // Unidades válidas (la validación de entrada las lee de aquí)
    'units.allowed': [
      'm', 'cm', 'mm', 'kg', 'g', 'l', 'ml', 'unidad', 'par', 'docena',
      'ciento', 'millar', 'rollo', 'cono', 'metro2', 'galon', 'pulgada',
    ],

    // Regiones soportadas (para el selector y el consenso)
    'regions.supported': [
      'PE', 'PE-LIM', 'PE-JUN', 'PE-ARE', 'PE-CUS', 'PE-LAL', 'PE-PIU', 'PE-LAM',
    ],

    // Alertas
    'alerts.check_cron': '0 * * * *',
    'alerts.digest_cron_free': '0 13 * * *',
    'notify.dedup_hours': 24, // una alerta no se repite antes de N horas
  };

  for (const [key, value] of Object.entries(settings)) {
    await setGlobal(key, value);
  }
}

// --- 3. Conversiones de unidad ----------------------------------------------

const UNIT_CONVERSIONS: Array<[string, string, string, string]> = [
  // from, to, factor, category
  ['cm', 'm', '0.01', 'length'],
  ['mm', 'm', '0.001', 'length'],
  ['pulgada', 'm', '0.0254', 'length'],
  ['g', 'kg', '0.001', 'weight'],
  ['ml', 'l', '0.001', 'volume'],
  ['galon', 'l', '3.78541', 'volume'],
  ['docena', 'unidad', '12', 'count'],
  ['ciento', 'unidad', '100', 'count'],
  ['millar', 'unidad', '1000', 'count'],
  ['par', 'unidad', '2', 'count'],
];

async function seedUnitConversions() {
  for (const [fromUnit, toUnit, factor, category] of UNIT_CONVERSIONS) {
    await prisma.unitConversion.upsert({
      where: { fromUnit_toUnit: { fromUnit, toUnit } },
      update: { factor, category },
      create: { fromUnit, toUnit, factor, category },
    });
  }
}

// --- 4. Fuentes de scraping -------------------------------------------------

const SCRAPING_SOURCES: Array<{
  name: string;
  slug: string;
  type: 'PLAYWRIGHT' | 'HTTP' | 'API';
  baseUrl: string;
  rateLimitRpm: number;
  priority: number;
  enabled: boolean;
  config: Prisma.InputJsonValue;
}> = [
  {
    name: 'MercadoLibre Perú',
    slug: 'mercadolibre-pe',
    type: 'API',
    baseUrl: 'https://api.mercadolibre.com',
    rateLimitRpm: 60,
    priority: 10,
    enabled: true,
    config: {
      site_id: 'MLP',
      search_path: '/sites/MLP/search?q={query}&limit=50',
      price_field: 'price',
      currency_field: 'currency_id',
      auth: 'oauth_client_credentials', // token vía env, NO aquí
    },
  },
  {
    name: 'Promart',
    slug: 'promart',
    type: 'API', // VTEX: API pública de catálogo (adapter=vtex), no requiere navegador
    baseUrl: 'https://www.promart.pe',
    rateLimitRpm: 30,
    priority: 5,
    enabled: true, // validado 2026-09-10 contra la API VTEX en vivo
    config: {
      adapter: 'vtex',
      search_path: '/api/catalog_system/pub/products/search?ft={query}&_from=0&_to=49',
      rubros: ['muebles'], // ferretería / construcción / hogar
      // sin seller_filter: se toma la oferta disponible más barata (1P o marketplace)
    },
  },
  {
    name: 'Sodimac Perú',
    slug: 'sodimac-pe',
    type: 'HTTP', // plataforma Falabella (Next.js): se parsea `__NEXT_DATA__` del HTML
    baseUrl: 'https://www.sodimac.com.pe',
    rateLimitRpm: 20,
    priority: 5,
    enabled: true, // validado 2026-09-10 contra el HTML/__NEXT_DATA__ en vivo
    config: {
      adapter: 'sodimac',
      search_path: '/sodimac-pe/buscar?Ntt={query}',
      rubros: ['muebles'],
    },
  },
  {
    name: 'Plaza Vea',
    slug: 'plaza-vea',
    type: 'API', // VTEX (Supermercados Peruanos)
    baseUrl: 'https://www.plazavea.com.pe',
    rateLimitRpm: 30,
    priority: 5,
    enabled: true, // validado 2026-09-10 contra la API VTEX en vivo
    config: {
      adapter: 'vtex',
      search_path: '/api/catalog_system/pub/products/search?ft={query}&_from=0&_to=49',
      rubros: ['gastronomia'],
    },
  },
  {
    name: 'Tottus',
    slug: 'tottus',
    type: 'HTTP', // plataforma Falabella (mismo parser que Sodimac)
    baseUrl: 'https://tottus.falabella.com.pe',
    rateLimitRpm: 20,
    priority: 5,
    enabled: true, // validado 2026-09-10 contra el HTML/__NEXT_DATA__ en vivo
    config: {
      adapter: 'falabella',
      search_path: '/tottus-pe/search?Ntt={query}',
      rubros: ['gastronomia'],
    },
  },
  {
    name: 'Metro',
    slug: 'metro',
    type: 'API', // VTEX (Cencosud Perú)
    baseUrl: 'https://www.metro.pe',
    rateLimitRpm: 30,
    priority: 5,
    enabled: true, // validado 2026-09-10 contra la API VTEX en vivo
    config: {
      adapter: 'vtex',
      search_path: '/api/catalog_system/pub/products/search?ft={query}&_from=0&_to=49',
      rubros: ['gastronomia'],
    },
  },
  {
    name: 'Wong',
    slug: 'wong',
    type: 'API', // VTEX (Cencosud Perú)
    baseUrl: 'https://www.wong.pe',
    rateLimitRpm: 30,
    priority: 5,
    enabled: true, // validado 2026-09-10 contra la API VTEX en vivo
    config: {
      adapter: 'vtex',
      search_path: '/api/catalog_system/pub/products/search?ft={query}&_from=0&_to=49',
      rubros: ['gastronomia'],
    },
  },
  // Vivanda (Supermercados Peruanos): VTEX IO headless, el endpoint catalog_system
  // público está deshabilitado → pendiente (intelligent-search GraphQL).
];

async function seedScrapingSources() {
  for (const s of SCRAPING_SOURCES) {
    await prisma.scrapingSource.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        type: s.type,
        baseUrl: s.baseUrl,
        rateLimitRpm: s.rateLimitRpm,
        priority: s.priority,
        config: s.config,
        // enabled NO se toca en update: puede haberse cambiado desde el panel
      },
      create: s,
    });
  }
}

// --- 5. Fuentes de datos abiertos -----------------------------------------

async function seedGovDataSources() {
  const sources: Array<{
    name: string;
    kind: 'SISAP' | 'MIDAGRI' | 'EXCHANGE_RATE';
    endpoint: string;
    config: Prisma.InputJsonValue;
  }> = [
    {
      name: 'MIDAGRI - SISAP (precios mayoristas)',
      kind: 'SISAP',
      endpoint: 'https://sistemas.midagri.gob.pe/sisap/portal2/mayorista/',
      config: { format: 'html_table', markets: ['Santa Anita', 'Moshoqueque'] },
    },
    {
      name: 'SBS - Tipo de cambio',
      kind: 'EXCHANGE_RATE',
      endpoint: 'https://www.sbs.gob.pe/app/pp/sistip_portal/paginas/publicacion/tipocambiopromedio.aspx',
      config: { pairs: [['USD', 'PEN'], ['EUR', 'PEN']] },
    },
  ];
  for (const s of sources) {
    await prisma.govDataSource.upsert({
      where: { name: s.name },
      update: { endpoint: s.endpoint, config: s.config },
      create: s,
    });
  }
}

// --- 6. Categorías de insumos raíz --------------------------------------

async function seedCategories() {
  const roots: Array<{ name: string; slug: string; rubro: string }> = [
    { name: 'Textiles e hilados', slug: 'textiles', rubro: 'confeccion' },
    { name: 'Avíos', slug: 'avios', rubro: 'confeccion' },
    { name: 'Insumos de panadería', slug: 'panaderia', rubro: 'gastronomia' },
    { name: 'Abarrotes', slug: 'abarrotes', rubro: 'gastronomia' },
    { name: 'Maderas y tableros', slug: 'maderas', rubro: 'muebles' },
    { name: 'Ferretería', slug: 'ferreteria', rubro: 'muebles' },
    { name: 'Empaque y etiquetado', slug: 'empaque', rubro: 'general' },
  ];
  for (const c of roots) {
    await prisma.inputCategory.upsert({
      where: { slug: c.slug },
      update: { name: c.name, rubro: c.rubro },
      create: c,
    });
  }
}

// --- 6b. Categorías de producto final (piloto: rubros más fáciles) -------
//
// Prueba de concepto del "diferencial" del producto: en vez de raspar por el
// nombre libre del producto ("Pan", que matchea de todo), la categoría trae
// una plantilla de búsqueda + los atributos que hay que pedirle al usuario
// para armarla ("pan {tipoHarina} {peso}{pesoUnidad}" → "pan integral 500g").
// Se arranca con dos rubros a propósito (uno por cada evidencia real que ya
// tenemos de esta sesión) para confirmar que el mecanismo generaliza y no
// quedó sobreajustado al caso de Pan — ver conversación sobre el roadmap.

interface AttributeDefSeed {
  key: string;
  label: string;
  valueType: 'TEXT' | 'NUMBER' | 'NUMBER_WITH_UNIT' | 'ENUM' | 'BOOLEAN';
  options?: string[];
  required: boolean;
  sortOrder: number;
  helpText?: string;
}

/** Crea/actualiza rootName > leafName (con su plantilla) + sus atributos. */
async function upsertProductCategoryTree(args: {
  rootName: string;
  rootSlug: string;
  leafName: string;
  leafSlug: string;
  rubro: string;
  searchQueryTemplate: string;
  attrs: AttributeDefSeed[];
}) {
  const root = await prisma.productCategory.upsert({
    where: { slug: args.rootSlug },
    update: { rubro: args.rubro },
    create: { name: args.rootName, slug: args.rootSlug, rubro: args.rubro },
  });

  const leaf = await prisma.productCategory.upsert({
    where: { slug: args.leafSlug },
    update: {
      parentId: root.id,
      rubro: args.rubro,
      searchQueryTemplate: args.searchQueryTemplate,
    },
    create: {
      name: args.leafName,
      slug: args.leafSlug,
      parentId: root.id,
      rubro: args.rubro,
      searchQueryTemplate: args.searchQueryTemplate,
    },
  });

  for (const a of args.attrs) {
    await prisma.productCategoryAttribute.upsert({
      where: { categoryId_key: { categoryId: leaf.id, key: a.key } },
      update: {
        label: a.label,
        valueType: a.valueType,
        options: a.options,
        required: a.required,
        sortOrder: a.sortOrder,
        helpText: a.helpText,
      },
      create: { categoryId: leaf.id, ...a },
    });
  }

  return leaf;
}

async function seedProductCategories() {
  await upsertProductCategoryTree({
    rootName: 'Panadería',
    rootSlug: 'panaderia',
    leafName: 'Pan',
    leafSlug: 'pan',
    rubro: 'gastronomia',
    searchQueryTemplate: 'pan {tipoHarina} {peso}{pesoUnidad}',
    attrs: [
      {
        key: 'tipoHarina',
        label: 'Tipo de harina',
        valueType: 'ENUM',
        options: ['trigo', 'integral', 'centeno', 'sin gluten'],
        required: true,
        sortOrder: 0,
        helpText: 'De qué harina es el pan — es lo que más cambia el precio de mercado.',
      },
      {
        key: 'peso',
        label: 'Peso o presentación',
        valueType: 'NUMBER',
        required: true,
        sortOrder: 1,
        helpText: 'Cuánto pesa (o cuántas unidades trae) la presentación que vendes.',
      },
      {
        key: 'pesoUnidad',
        label: 'Unidad',
        valueType: 'ENUM',
        options: ['g', 'kg', 'unidad'],
        required: true,
        sortOrder: 2,
      },
    ],
  });

  await upsertProductCategoryTree({
    rootName: 'Muebles',
    rootSlug: 'muebles-raiz',
    leafName: 'Repisa de melamina',
    leafSlug: 'repisa-melamina',
    rubro: 'muebles',
    searchQueryTemplate: 'repisa flotante melamina {color} {largoCm}cm',
    attrs: [
      {
        key: 'color',
        label: 'Color / acabado',
        valueType: 'ENUM',
        options: ['blanco', 'wengue', 'roble', 'negro'],
        required: true,
        sortOrder: 0,
        helpText: 'El acabado de la melamina cambia bastante el precio de mercado.',
      },
      {
        key: 'largoCm',
        label: 'Largo (cm)',
        valueType: 'NUMBER',
        required: true,
        sortOrder: 1,
        helpText: 'Cuánto mide de largo la repisa que vendes.',
      },
      {
        key: 'espesorMm',
        label: 'Espesor',
        valueType: 'ENUM',
        options: ['18', '25'],
        required: false,
        sortOrder: 2,
        helpText: 'Grosor de la plancha de melamina, en milímetros.',
      },
    ],
  });
}

// --- 7. Plantillas de notificación ---------------------------------------

async function seedNotificationTemplates() {
  const CHANNELS = ['IN_APP', 'EMAIL', 'TELEGRAM'] as const;

  const bodies: Record<string, { subject: string; body: string }> = {
    'alert.margin_drop': {
      subject: 'Tu margen en {{productName}} bajó a {{marginPct}}',
      body: 'El margen de {{productName}} es {{marginPct}} (tu piso: {{marginFloorPct}}). Precio sugerido: {{suggestedPrice}}.',
    },
    'alert.input_price_rise': {
      subject: '{{inputName}} subió en el mercado',
      body: 'El mercado reporta {{inputName}} a {{marketPrice}}, {{changePct}} por encima de lo que pagas ({{yourPrice}}).',
    },
    'alert.competitor_price_drop': {
      subject: 'La competencia bajó el precio de {{productName}}',
      body: 'La mediana de mercado de {{productName}} pasó de {{previousMedian}} a {{currentMedian}} ({{changePct}}).',
    },
    'alert.consensus_shift': {
      subject: 'El precio de consenso de {{inputName}} se movió',
      body: 'El consenso de {{inputName}} cambió {{changePct}} (ahora {{marketPrice}}).',
    },
    'receipt.parsed': {
      subject: 'Boleta procesada',
      body: 'Detecté {{itemCount}} ítems en tu boleta. Revisa y confirma en la app.',
    },
  };

  const templates = Object.entries(bodies).flatMap(([code, t]) =>
    CHANNELS.map((channel) => ({ code, channel, subject: t.subject, body: t.body })),
  );
  for (const t of templates) {
    await prisma.notificationTemplate.upsert({
      where: { code_locale_channel: { code: t.code, locale: 'es-PE', channel: t.channel } },
      update: { subject: t.subject ?? null, body: t.body },
      create: { ...t, locale: 'es-PE' },
    });
  }
}

// --- 8. Feature flags -----------------------------------------------------

async function seedFeatureFlags() {
  const flags = [
    { key: 'radar_v2', description: 'Nuevo panel de radar de competencia', enabled: false },
    { key: 'marketplace_ads', description: 'Slots de proveedor sugerido', enabled: false },
    { key: 'telegram_bot', description: 'Carga de boletas por Telegram', enabled: false },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: { description: f.description },
      create: f,
    });
  }
}

// --- main ---------------------------------------------------------------

async function main() {
  await seedPlans();
  await seedGlobalSettings();
  await seedUnitConversions();
  await seedScrapingSources();
  await seedGovDataSources();
  await seedCategories();
  await seedProductCategories();
  await seedNotificationTemplates();
  await seedFeatureFlags();
  console.log('✔ seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
