import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SkipLink } from '@/components/SkipLink';
import { siteChrome } from '@/lib/nav';
import { SITE } from '@/lib/site';

/* As três famílias expõem as variáveis CSS referenciadas pelos tokens de globals.css (--font-sans/--font-display/--font-mono). */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-display-face', display: 'swap', weight: ['600', '700', '800'] });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, locale: 'pt_BR', type: 'website' },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff', colorScheme: 'light' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { nav, institutional } = siteChrome();
  return (
    <html lang="pt-BR" className={`${inter.variable} ${manrope.variable} ${jetbrains.variable}`}>
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
