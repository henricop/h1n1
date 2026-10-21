import type { NextConfig } from 'next';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const DEV = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy (achado e). `unsafe-inline` em script-src é exigido pelo bootstrap do Next e pelo JSON-LD;
 * `unsafe-eval` só em desenvolvimento (React Refresh). Imagens/fonts locais ou data:/blob: (globo WebGL, next/font
 * auto-hospedada). Sem conexão externa em runtime: o navegador só fala com o próprio site e com a API própria
 * (NEXT_PUBLIC_API_URL); ws:/wss: só em desenvolvimento (HMR). Nenhum iframe.
 */
export function buildCsp(apiUrl = API_URL, dev = DEV): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${apiUrl}${dev ? ' ws: wss:' : ''}`,
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join('; ');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  poweredByHeader: false,
  transpilePackages: ['@h1n1/core'],
  // Sem analytics nem JS pesado no MVP; componentes server por padrão.
  experimental: {},
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: buildCsp() },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
