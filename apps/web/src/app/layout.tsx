import type { Metadata, Viewport } from 'next';
import { Big_Shoulders, Instrument_Serif, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SkipLink } from '@/components/SkipLink';
import { siteChrome } from '@/lib/nav';
import { SITE } from '@/lib/site';

/* DESIGN.md v3: quatro famílias auto-hospedadas (next/font baixa no build; nada é carregado de outra origem em runtime).
   Expõem as variáveis referenciadas pelos tokens de globals.css (--font-sans/--font-display/--font-condensed/--font-mono). */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const instrument = Instrument_Serif({ subsets: ['latin'], variable: '--font-instrument', display: 'swap', weight: '400', style: ['normal', 'italic'] });
// Big Shoulders só nos pesos usados (condensed-xl 800, condensed-md 700): evita baixar o eixo variável inteiro.
const bigShoulders = Big_Shoulders({ subsets: ['latin'], variable: '--font-big-shoulders', display: 'swap', weight: ['700', '800'], preload: false });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', weight: ['400', '500'], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, locale: 'pt_BR', type: 'website' },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f4f1ea', colorScheme: 'light' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { nav, institutional } = siteChrome();
  return (
    <html lang="pt-BR" className={`${inter.variable} ${instrument.variable} ${bigShoulders.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg text-ink">
        <SkipLink />
        <Header nav={nav} />
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6" tabIndex={-1}>
          {children}
        </main>
        <Footer nav={nav} institutional={institutional} />
      </body>
    </html>
  );
}
