'use client';

/** Última barrera: se renderiza si falla el propio root layout, sin providers. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es-PE">
      <body
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '100dvh',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 360, padding: '1rem' }}>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Ocurrió un error</h1>
          <p style={{ marginTop: '0.5rem', color: '#666' }}>
            Algo falló de nuestro lado. Intenta más tarde.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.25rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 0,
              background: '#0f7a5f',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
