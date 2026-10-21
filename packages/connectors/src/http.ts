import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const USER_AGENT = 'h1n1-observatorio/0.1 (ingestao de dados publicos; contato via repositorio)';

/** Tempo máximo até os cabeçalhos da resposta chegarem. */
export const HEADER_TIMEOUT_MS = 60_000;
/** Tempo máximo total de um download em streaming (SIVEP: centenas de MB). */
export const DOWNLOAD_TIMEOUT_MS = 45 * 60_000;
/** Tempo máximo total para corpos pequenos (JSON/texto). */
export const BODY_TIMEOUT_MS = 5 * 60_000;
/** Novas tentativas do download inteiro quando o stream falha depois dos cabeçalhos. */
export const STREAM_RETRIES = 2;

export interface DownloadResult {
  path: string;
  sha256: string;
  bytes: number;
  content_type: string | null;
}

export interface HttpTimeouts {
  /** ms até os cabeçalhos (default HEADER_TIMEOUT_MS) */
  headerTimeoutMs?: number;
  /** ms totais, cabeçalhos + corpo (default depende da operação) */
  totalTimeoutMs?: number;
}

export interface DownloadOptions extends HttpTimeouts {
  /** novas tentativas do download inteiro em falha de stream (default STREAM_RETRIES) */
  streamRetries?: number;
  /** tentativas da requisição (cabeçalhos) por download (default 3) */
  requestRetries?: number;
}

export class HttpError extends Error {
  constructor(public readonly url: string, public readonly status: number, message?: string) {
    super(message ?? `HTTP ${status} em ${url}`);
  }
}

export class HttpTimeoutError extends Error {
  constructor(public readonly url: string, public readonly phase: 'headers' | 'body', public readonly ms: number) {
    super(`timeout de ${phase === 'headers' ? 'cabeçalhos' : 'download'} (${Math.round(ms / 1000)} s) em ${url}`);
  }
}

interface TimedResponse {
  res: Response;
  /** libera o temporizador do corpo (chamar depois de consumir o corpo) */
  release: () => void;
}

function isAbort(e: unknown): boolean {
  return e instanceof HttpTimeoutError || (e instanceof Error && e.name === 'AbortError');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch com retry (5xx e falhas de rede) e dois temporizadores por AbortSignal: um até os cabeçalhos,
 * outro para o total (cabeçalhos + corpo). O temporizador do corpo fica ativo até `release()`.
 */
async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 3, timeouts: HttpTimeouts = {}): Promise<TimedResponse> {
  const headerMs = timeouts.headerTimeoutMs ?? HEADER_TIMEOUT_MS;
  const totalMs = timeouts.totalTimeoutMs ?? BODY_TIMEOUT_MS;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const t0 = Date.now();
    const headerTimer = setTimeout(() => ac.abort(new HttpTimeoutError(url, 'headers', headerMs)), headerMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'user-agent': USER_AGENT, accept: '*/*', ...(init.headers ?? {}) },
        redirect: 'follow',
        signal: ac.signal,
      });
      clearTimeout(headerTimer);
      if (res.status >= 500 && attempt < retries) {
        lastErr = new HttpError(url, res.status);
        await res.body?.cancel().catch(() => {});
        await sleep(1000 * attempt);
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        throw new HttpError(url, res.status);
      }
      const remaining = Math.max(1, totalMs - (Date.now() - t0));
      const bodyTimer = setTimeout(() => ac.abort(new HttpTimeoutError(url, 'body', totalMs)), remaining);
      return { res, release: () => clearTimeout(bodyTimer) };
    } catch (e) {
      clearTimeout(headerTimer);
      const err = ac.signal.aborted && ac.signal.reason instanceof Error ? ac.signal.reason : e;
      lastErr = err;
      if (err instanceof HttpError && err.status < 500) throw err;
      if (attempt === retries) throw err;
      await sleep(1000 * attempt);
    }
  }
  throw lastErr;
}

/** GET JSON. Envia só `accept: application/json` — APIs com negociação de conteúdo (UKHSA) devolvem HTML se text/html estiver no accept. */
export async function fetchJson<T = unknown>(url: string, init: RequestInit = {}, timeouts: HttpTimeouts = {}): Promise<T> {
  const { res, release } = await fetchWithRetry(url, { ...init, headers: { accept: 'application/json', ...(init.headers ?? {}) } }, 3, timeouts);
  let text: string;
  try {
    text = await res.text();
  } finally {
    release();
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta não é JSON (${res.headers.get('content-type') ?? 'sem content-type'}) em ${url}: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
}

export async function fetchText(url: string, init: RequestInit = {}, timeouts: HttpTimeouts = {}): Promise<string> {
  const { res, release } = await fetchWithRetry(url, { ...init, headers: { accept: 'text/html, text/plain, */*', ...(init.headers ?? {}) } }, 3, timeouts);
  try {
    return await res.text();
  } finally {
    release();
  }
}

/**
 * Baixa a URL em streaming para um arquivo, calculando sha256 e bytes sem carregar o corpo em memória.
 * Timeouts: 60 s para cabeçalhos, 45 min para o download total. Falha de stream (conexão caiu, timeout do corpo)
 * refaz o download inteiro até `streamRetries` vezes; em qualquer erro o arquivo parcial é removido.
 */
export async function downloadToFile(url: string, destPath: string, init: RequestInit = {}, opts: DownloadOptions = {}): Promise<DownloadResult> {
  const streamRetries = opts.streamRetries ?? STREAM_RETRIES;
  const timeouts: HttpTimeouts = { headerTimeoutMs: opts.headerTimeoutMs ?? HEADER_TIMEOUT_MS, totalTimeoutMs: opts.totalTimeoutMs ?? DOWNLOAD_TIMEOUT_MS };
  await mkdir(join(destPath, '..'), { recursive: true });
  let lastErr: unknown;
  for (let attempt = 0; attempt <= streamRetries; attempt++) {
    let timed: TimedResponse | null = null;
    try {
      // Falha antes dos cabeçalhos (4xx, 5xx após retries, timeout de cabeçalho) não é falha de stream: propaga.
      timed = await fetchWithRetry(url, init, opts.requestRetries ?? 3, timeouts);
    } catch (e) {
      await rm(destPath, { force: true }).catch(() => {});
      throw e;
    }
    const { res, release } = timed;
    try {
      if (!res.body) throw new Error(`Resposta sem corpo: ${url}`);
      const hash = createHash('sha256');
      let bytes = 0;
      const source = Readable.fromWeb(res.body as never);
      source.on('data', (chunk: Buffer) => {
        hash.update(chunk);
        bytes += chunk.length;
      });
      await pipeline(source, createWriteStream(destPath));
      const expected = Number(res.headers.get('content-length') ?? NaN);
      if (Number.isFinite(expected) && expected > 0 && bytes !== expected) {
        throw new Error(`download incompleto: ${bytes} de ${expected} bytes em ${url}`);
      }
      release();
      return { path: destPath, sha256: hash.digest('hex'), bytes, content_type: res.headers.get('content-type') };
    } catch (e) {
      release();
      await rm(destPath, { force: true }).catch(() => {});
      // o stream abortado pelo temporizador do corpo chega como AbortError: traduz para o erro de timeout
      lastErr = isAbort(e) && !(e instanceof HttpTimeoutError) ? new HttpTimeoutError(url, 'body', timeouts.totalTimeoutMs ?? DOWNLOAD_TIMEOUT_MS) : e;
      if (attempt < streamRetries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastErr;
}

/** Grava conteúdo em memória (JSON/texto pequeno) no arquivo e devolve hash/bytes. */
export async function writeRawFile(destPath: string, content: string | Buffer, contentType: string | null): Promise<DownloadResult> {
  await mkdir(join(destPath, '..'), { recursive: true });
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  await writeFile(destPath, buf);
  return { path: destPath, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length, content_type: contentType };
}

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
