/** GA4 for the public simulator. Dev and test builds do not send hits. */

export const DEFAULT_GA_MEASUREMENT_ID = 'G-7DC7DWPTND';

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;
const GTAG_ORIGIN = 'https://www.googletagmanager.com/gtag/js';

export function resolveGaMeasurementId(configured: string | undefined | null): string {
  const value = configured?.trim() ?? '';
  return MEASUREMENT_ID_PATTERN.test(value) ? value : DEFAULT_GA_MEASUREMENT_ID;
}

export function pagePath(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

/**
 * Install gtag and record a page view when the URL changes.
 * The config command sends the first page view; later history and hash
 * updates are explicit page_view events because this app has no router.
 */
export function installGoogleAnalytics(measurementId: string, host: AnalyticsWindow = window, doc: Document = document): void {
  if (host.gtag) return;

  const dataLayer: unknown[] = host.dataLayer ?? [];
  host.dataLayer = dataLayer;
  function gtag(..._command: unknown[]) {
    dataLayer.push(arguments);
  }
  host.gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId);

  let lastPath = pagePath(host.location);
  const trackIfChanged = () => {
    const path = pagePath(host.location);
    if (path === lastPath) return;
    lastPath = path;
    gtag('event', 'page_view', {
      page_title: doc.title,
      page_location: host.location.href,
      page_path: path,
      send_to: measurementId,
    });
  };

  host.addEventListener('hashchange', trackIfChanged);
  host.addEventListener('popstate', trackIfChanged);
  const wrap = (method: 'pushState' | 'replaceState') => {
    const original = host.history[method].bind(host.history);
    host.history[method] = ((...args: Parameters<History['pushState']>) => {
      original(...args);
      trackIfChanged();
    }) as History['pushState'] & History['replaceState'];
  };
  wrap('pushState');
  wrap('replaceState');

  const mount = () => {
    const src = `${GTAG_ORIGIN}?id=${encodeURIComponent(measurementId)}`;
    if (doc.querySelector(`script[src="${src}"]`)) return;
    const script = doc.createElement('script');
    script.async = true;
    script.src = src;
    script.fetchPriority = 'low';
    doc.head.appendChild(script);
  };
  const idle = host.requestIdleCallback?.bind(host);
  if (idle) idle(mount, { timeout: 2000 });
  else host.setTimeout(mount, 1);
}

export function initAnalytics(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  installGoogleAnalytics(resolveGaMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID));
}
