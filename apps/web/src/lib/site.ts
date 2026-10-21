/** Configuração global do site (sem analytics, sem newsletter no MVP). */
export const SITE = {
  name: 'H1N1',
  tagline: 'Informação clara. Dados oficiais. Análise independente.',
  description:
    'Central pública de referência sobre influenza A(H1N1): respostas revisadas, observatório com dados oficiais e catálogo de fontes.',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000' /* domínio final a definir */).replace(/\/$/, ''),
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
