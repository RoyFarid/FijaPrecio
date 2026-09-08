import { clientEnv } from '../env';

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', maxWidth: 640 }}>
      <h1>FijaPrecio</h1>
      <p>
        Scaffold operativo. API: <code>{clientEnv.NEXT_PUBLIC_API_URL}</code> · entorno:{' '}
        <code>{clientEnv.NEXT_PUBLIC_APP_ENV}</code>
      </p>
      <ul>
        <li>Costeo bottom-up + Target Costing</li>
        <li>Radar de competencia (scraping / API)</li>
        <li>Base de precios colaborativa + consenso estadístico</li>
        <li>Boletas por Telegram + OCR</li>
      </ul>
    </main>
  );
}
