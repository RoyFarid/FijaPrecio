import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
// Valida el entorno de servidor al compilar/arrancar (fail-fast).
import './src/env';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next 15 trata 127.0.0.1 ≠ localhost como cross-origin y bloquea el HMR/RSC en dev.
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  transpilePackages: ['@fijaprecio/shared-types', '@fijaprecio/config-schema'],
  experimental: {
    // Resuelve deps del workspace desde la raíz del monorepo.
    externalDir: true,
  },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default withNextIntl(nextConfig);
