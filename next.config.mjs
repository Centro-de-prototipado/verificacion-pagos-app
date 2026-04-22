/** @type {import('next').NextConfig} */
const nextConfig = {
  logging: {
    browserToTerminal: true,
  },
  // pdfjs-dist usa módulos nativos Node.js — excluirlo del bundler del servidor
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
