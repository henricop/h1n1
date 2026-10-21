import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SkipLink } from '@/components/SkipLink';
import { siteChrome } from '@/lib/nav';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, locale: 'pt_BR', type: 'website' },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#11304d' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { nav, institutional } = siteChrome();
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col">
        <SkipLink />
        <Header nav={nav} />
        <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6" tabIndex={-1}>
          {children}
        </main>
        <Footer nav={nav} institutional={institutional} />
      </body>
    </html>
  );
}
