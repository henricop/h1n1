import { describe, expect, it } from 'vitest';
import { DEFAULT_GA_MEASUREMENT_ID, installGoogleAnalytics, pagePath, resolveGaMeasurementId } from '../src/analytics';

describe('GA4 measurement id', () => {
  it('uses the public property unless a valid measurement id is configured', () => {
    expect(resolveGaMeasurementId(undefined)).toBe(DEFAULT_GA_MEASUREMENT_ID);
    expect(resolveGaMeasurementId(null)).toBe(DEFAULT_GA_MEASUREMENT_ID);
    expect(resolveGaMeasurementId('')).toBe(DEFAULT_GA_MEASUREMENT_ID);
    expect(resolveGaMeasurementId('UA-123')).toBe(DEFAULT_GA_MEASUREMENT_ID);
    expect(resolveGaMeasurementId('  G-OVERRIDE1  ')).toBe('G-OVERRIDE1');
    expect(DEFAULT_GA_MEASUREMENT_ID).toBe('G-ZSNQX6DE9R');
  });
});

describe('GA4 page views', () => {
  it('loads gtag once and sends a page view only when the url changes', () => {
    const dataLayer: unknown[] = [];
    let href = 'https://www.h1n1.com.br/';
    let pathname = '/';
    let search = '';
    let hash = '';
    const listeners = new Map<string, Array<() => void>>();
    const scripts: Array<{ async: boolean; src: string; fetchPriority: string }> = [];
    const applyUrl = (url?: string | URL | null) => {
      const next = new URL(String(url ?? href), href);
      href = next.href;
      pathname = next.pathname;
      search = next.search;
      hash = next.hash;
    };
    const host = {
      dataLayer,
      location: {
        get href() { return href; },
        get pathname() { return pathname; },
        get search() { return search; },
        get hash() { return hash; },
      },
      history: {
        pushState: (_data: unknown, _unused: string, url?: string | URL | null) => applyUrl(url),
        replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => applyUrl(url),
      },
      addEventListener: (type: string, listener: () => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      requestIdleCallback: (callback: () => void) => callback(),
      setTimeout: (callback: () => void) => callback(),
    };
    const doc = {
      title: 'H1N1 · Infection Journey',
      head: { appendChild: (script: { async: boolean; src: string; fetchPriority: string }) => { scripts.push(script); } },
      querySelector: (selector: string) => scripts.some((script) => selector === `script[src="${script.src}"]`) ? scriptMarker : null,
      createElement: () => ({ async: false, src: '', fetchPriority: 'auto' }),
    };
    const scriptMarker = {};

    installGoogleAnalytics('G-TEST123', host as unknown as Window, doc as unknown as Document);
    installGoogleAnalytics('G-TEST123', host as unknown as Window, doc as unknown as Document);

    const commands = () => dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
    expect(commands().map((entry) => entry[0])).toEqual(['js', 'config']);
    expect(commands()[1]?.[1]).toBe('G-TEST123');
    expect(scripts).toEqual([{ async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST123', fetchPriority: 'low' }]);

    host.history.pushState(null, '', '/');
    expect(commands()).toHaveLength(2);

    host.history.pushState(null, '', '/?lang=pt');
    expect(commands()[2]?.[0]).toBe('event');
    expect(commands()[2]?.[1]).toBe('page_view');
    expect(commands()[2]?.[2]).toMatchObject({
      page_title: 'H1N1 · Infection Journey',
      page_location: 'https://www.h1n1.com.br/?lang=pt',
      page_path: '/?lang=pt',
      send_to: 'G-TEST123',
    });

    hash = '#cell';
    href = 'https://www.h1n1.com.br/?lang=pt#cell';
    listeners.get('hashchange')?.forEach((listener) => listener());
    expect(pagePath(host.location)).toBe('/?lang=pt#cell');
    expect(commands()[3]?.[2]).toMatchObject({ page_path: '/?lang=pt#cell' });
  });
});
