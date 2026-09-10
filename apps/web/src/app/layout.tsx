import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getMessages } from 'next-intl/server';
import { Providers } from '../components/providers';
import { locale, timeZone } from '../i18n/request';
import '../styles/globals.css';
import '../env'; // valida entorno del servidor al renderizar

export const metadata: Metadata = {
  title: {
    default: 'FijaPrecio',
    template: '%s · FijaPrecio',
  },
  description: 'A cuánto vender tu producto: costeo real vs. precio de mercado en vivo.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="es-PE">
      <body>
        <Providers locale={locale} messages={messages} timeZone={timeZone}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
