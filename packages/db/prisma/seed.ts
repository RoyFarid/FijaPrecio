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
    'catalog.autocreate_canonical_status': 'PENDING_REVIEW',

    // Scraping
    'scraper.default_cadence': 'weekly',
    'scraper.top_n_nightly': 100,
    'scraper.result_ttl_hours': 24,
    'scraper.outlier_trim_pct': 0.1, // recorta 10% extremos antes de la mediana

    // Boletas / OCR
    'receipts.retention_days': 365,
    'ocr.provider_by_plan': { FREE: 'PADDLE', PREMIUM: 'PADDLE', BUSINESS: 'PADDLE' },
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
    type: 'PLAYWRIGHT',
    baseUrl: 'https://www.promart.pe',
    rateLimitRpm: 10,
    priority: 5,
    enabled: false, // se habilita cuando los selectores estén validados
    config: {
      search_path: '/search?text={query}',
      selectors: {
        card: '[data-testid="product-card"]',
        price: '[data-testid="price"]',
        title: '[data-testid="product-name"]',
      },
      wait_for: '[data-testid="product-card"]',
    },
  },
  {
    name: 'Sodimac Perú',
    slug: 'sodimac-pe',
    type: 'PLAYWRIGHT',
    baseUrl: 'https://www.sodimac.com.pe',
    rateLimitRpm: 10,
    priority: 5,
    enabled: false,
    config: {
      search_path: '/sodimac-pe/search?Ntt={query}',
      selectors: {
        card: '.product-card',
        price: '.price-amount',
        title: '.product-title',
      },
    },
  },
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

// --- 7. Plantillas de notificación ---------------------------------------

async function seedNotificationTemplates() {
  const templates = [
    {
      code: 'alert.margin_drop',
      channel: 'EMAIL' as const,
      subject: 'Tu margen en {{productName}} bajó a {{marginPct}}',
      body: 'El costo de {{driverInput}} subió. Tu margen pasó de {{prevMarginPct}} a {{marginPct}}. Sugerimos precio {{suggestedPrice}}.',
    },
    {
      code: 'alert.margin_drop',
      channel: 'IN_APP' as const,
      subject: null,
      body: 'Margen de {{productName}}: {{marginPct}} (antes {{prevMarginPct}}).',
    },
    {
      code: 'receipt.parsed',
      channel: 'TELEGRAM' as const,
      subject: null,
      body: 'Detecté {{itemCount}} ítems en tu boleta. Revisa y confirma en la app.',
    },
  ];
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
