import type { NextConfig } from 'next';
// Valida el entorno de servidor al compilar/arrancar (fail-fast).
import './src/env';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@fijaprecio/shared-types', '@fijaprecio/config-schema'],
  experimental: {
    // Resuelve deps del workspace desde la raíz del monorepo.
    externalDir: true,
  },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
