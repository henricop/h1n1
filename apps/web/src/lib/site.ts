/** Configuração global do site (sem analytics, sem newsletter no MVP). */

const DEV_SITE_URL = 'http://localhost:3000';

/**
 * URL pública do site.
 * - dev/test: NEXT_PUBLIC_SITE_URL ou http://localhost:3000.
 * - produção (NODE_ENV=production) sem NEXT_PUBLIC_SITE_URL: erro claro na inicialização do servidor.
 *   Durante `next build` (NEXT_PHASE=phase-production-build) só avisa e usa o placeholder, para o build
 *   passar sem a variável; `next start` em produção sem ela falha ao carregar qualquer página.
 */
export function resolveSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (env.NODE_ENV === 'production') {
    const msg =
      'NEXT_PUBLIC_SITE_URL não definida em produção: defina NEXT_PUBLIC_SITE_URL com a URL pública do site (domínio final a definir). ' +
      'Sem ela, canonical, sitemap e JSON-LD apontariam para localhost.';
    if (env.NEXT_PHASE === 'phase-production-build') {
      const g = globalThis as { __h1n1SiteUrlWarned?: boolean };
      if (!g.__h1n1SiteUrlWarned) {
        g.__h1n1SiteUrlWarned = true;
        console.warn(`[site] AVISO: ${msg} Usando ${DEV_SITE_URL} apenas para concluir o build.`);
      }
      return DEV_SITE_URL;
    }
    throw new Error(msg);
  }
  return DEV_SITE_URL; // domínio final a definir
}

export const SITE = {
  name: 'H1N1',
  tagline: 'Informação clara. Dados oficiais. Análise independente.',
  description:
    'Central pública de referência sobre influenza A(H1N1): respostas revisadas, observatório com dados oficiais e catálogo de fontes.',
  url: resolveSiteUrl(),
  locale: 'pt-BR',
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, ''),
  /** Placeholder de consentimento: desativado no MVP (sem rastreamento). */
  analyticsConsent: { enabled: false },
  medicalDisclaimer: 'Este conteúdo é educativo e não substitui avaliação médica.',
  reviewBanner:
    'Conteúdo em revisão clínica: este texto ainda não foi revisado por profissional de saúde. Não use para decidir tratamento. Em caso de sinais de alerta, procure um serviço de saúde.',
  dataLicenses: [
    { label: 'Ministério da Saúde / DATASUS (SIVEP-Gripe): CC-BY', url: 'https://dadosabertos.saude.gov.br/' },
    { label: 'OMS FluNet: conforme termos de uso da OMS', url: 'https://www.who.int/tools/flunet/' },
  ],
} as const;

export function absoluteUrl(path: string): string {
  return `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
}
