import type { Metadata, Viewport } from 'next';
import { Big_Shoulders, Instrument_Serif, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/Footer';
import { SkipLink } from '@/components/SkipLink';
import { Brand } from '@/components/shell/Brand';
import { Menu } from '@/components/shell/Menu';
import { SmoothScroll } from '@/components/shell/SmoothScroll';
import { ThemeSections } from '@/components/shell/ThemeSections';
import { TopLinks } from '@/components/shell/TopLinks';
import { institutionalLinks, menuDestinations, topShortcuts } from '@/components/shell/destinations';
import { SIMPLE_MODE_BOOT_SCRIPT } from '@/lib/motion/simple-mode';
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

/**
 * Shell v4 (docs/reformulacao-v4.md §1, §6 e §7): sem barra de navegação. Marca + atalhos + pílula Menu fixos no
 * topo; `#page-root` envolve cromo, `<main>` (opaco, por cima) e rodapé (revelado por baixo) e fica `inert` com o
 * Menu aberto; o `<dialog>` do Menu é irmão de `#page-root` (portal no `<body>`). `<main>` sem largura máxima nem
 * respiro: cada página põe o próprio contêiner (a home usa a largura total) e reserva o topo para o cromo fixo.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { nav, institutional } = siteChrome();
  const destinations = menuDestinations(nav);
  const shortcuts = topShortcuts(nav);
  const institutionalShort = institutionalLinks(institutional);
  return (
    <html lang="pt-BR" className={`${inter.variable} ${instrument.variable} ${bigShoulders.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        {/* "Versão simples" aplicada antes da primeira pintura (sem flash de movimento); inline, sem rede. */}
        <script dangerouslySetInnerHTML={{ __html: SIMPLE_MODE_BOOT_SCRIPT }} />
      </head>
      <body className="bg-bg text-ink">
        <SkipLink />
        <SmoothScroll />
        <ThemeSections />
        <div id="page-root" className="flex min-h-screen flex-col">
          <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pr-[calc(env(safe-area-inset-right)+0.75rem)] pl-[calc(env(safe-area-inset-left)+0.75rem)] md:pt-[calc(env(safe-area-inset-top)+1.25rem)] md:pr-[calc(env(safe-area-inset-right)+1.25rem)] md:pl-[calc(env(safe-area-inset-left)+1.25rem)]">
            <Brand />
            <div className="flex items-center gap-2">
              <TopLinks links={shortcuts} />
              <Menu destinations={destinations} institutional={institutionalShort} rootId="page-root" />
            </div>
          </header>
          <main id="conteudo" className="relative z-10 w-full flex-1 bg-bg" tabIndex={-1}>
            {children}
          </main>
          <Footer nav={nav} institutional={institutional} />
        </div>
      </body>
    </html>
  );
}
