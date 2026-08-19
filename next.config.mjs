/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // exceljs usa requires dinámicos: empaquetarlo rompe la generación de
  // plantillas en producción, donde no hay árbol de node_modules completo.
  serverExternalPackages: ['exceljs'],
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
