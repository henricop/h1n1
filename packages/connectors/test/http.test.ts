import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadToFile, fetchJson, HttpError, HttpTimeoutError, sha256Hex } from '../src/http.js';

const BODY = Buffer.from('x'.repeat(50_000));
let server: Server;
let base: string;
let dir: string;
const hits: Record<string, number> = {};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'h1n1-http-'));
  server = createServer((req, res) => {
    const path = req.url ?? '/';
    hits[path] = (hits[path] ?? 0) + 1;
    if (path === '/ok') { res.writeHead(200, { 'content-type': 'text/csv', 'content-length': String(BODY.length) }); res.end(BODY); return; }
    if (path === '/flaky') {
      // 1ª tentativa: corpo truncado (conexão cai no meio); 2ª: completo
      res.writeHead(200, { 'content-type': 'text/csv', 'content-length': String(BODY.length) });
      if (hits[path] === 1) { res.write(BODY.subarray(0, 1000)); setTimeout(() => res.destroy(), 20); return; }
      res.end(BODY);
      return;
    }
    if (path === '/stall') { res.writeHead(200, { 'content-type': 'text/csv' }); res.write('abc'); return; /* nunca termina */ }
    if (path === '/silent') return; /* nunca responde cabeçalhos */
    if (path === '/json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"a":1}'); return; }
    res.writeHead(404); res.end('nao');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
});
afterAll(async () => {
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});

describe('http.downloadToFile', () => {
  it('baixa em streaming com sha256 e bytes', async () => {
    const dest = join(dir, 'ok.csv');
    const r = await downloadToFile(`${base}/ok`, dest);
    expect(r.bytes).toBe(BODY.length);
    expect(r.sha256).toBe(sha256Hex(BODY));
    expect(r.content_type).toBe('text/csv');
    expect(readFileSync(dest).equals(BODY)).toBe(true);
  });

  it('falha de stream (corpo truncado) refaz o download inteiro e não deixa parcial', async () => {
    const dest = join(dir, 'flaky.csv');
    const r = await downloadToFile(`${base}/flaky`, dest, {}, { streamRetries: 2 });
    expect(hits['/flaky']).toBe(2);
    expect(r.bytes).toBe(BODY.length);
    expect(r.sha256).toBe(sha256Hex(BODY));
  }, 15_000);

  it('sem novas tentativas, a falha de stream propaga e o arquivo parcial é removido', async () => {
    const dest = join(dir, 'flaky0.csv');
    hits['/flaky'] = 0;
    await expect(downloadToFile(`${base}/flaky`, dest, {}, { streamRetries: 0 })).rejects.toThrow();
    expect(existsSync(dest)).toBe(false);
  });

  it('HTTP 404 não é tentado de novo e não deixa arquivo', async () => {
    const dest = join(dir, '404.csv');
    await expect(downloadToFile(`${base}/nada`, dest)).rejects.toBeInstanceOf(HttpError);
    expect(hits['/nada']).toBe(1);
    expect(existsSync(dest)).toBe(false);
  });

  it('timeout de cabeçalhos (AbortSignal) remove o parcial e identifica a fase', async () => {
    const dest = join(dir, 'silent.csv');
    await expect(downloadToFile(`${base}/silent`, dest, {}, { headerTimeoutMs: 200, totalTimeoutMs: 5000, requestRetries: 1, streamRetries: 0 }))
      .rejects.toSatisfy((e: unknown) => e instanceof HttpTimeoutError && e.phase === 'headers');
    expect(existsSync(dest)).toBe(false);
  });

  it('timeout total do download (stream parado) aborta, remove o parcial e identifica a fase', async () => {
    const dest = join(dir, 'stall.csv');
    await expect(downloadToFile(`${base}/stall`, dest, {}, { headerTimeoutMs: 2000, totalTimeoutMs: 300, requestRetries: 1, streamRetries: 0 }))
      .rejects.toSatisfy((e: unknown) => e instanceof HttpTimeoutError && e.phase === 'body');
    expect(existsSync(dest)).toBe(false);
  });

  it('fetchJson continua funcionando com os temporizadores', async () => {
    expect(await fetchJson(`${base}/json`)).toEqual({ a: 1 });
  });
});
