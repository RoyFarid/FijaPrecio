import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../env'; // valida entorno del servidor al renderizar

export const metadata: Metadata = {
  title: 'FijaPrecio',
  description: 'A cuánto vender tu producto: costeo real vs. precio de mercado en vivo.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE">
      <body>{children}</body>
    </html>
  );
}
