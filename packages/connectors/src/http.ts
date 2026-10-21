import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const USER_AGENT = 'h1n1-observatorio/0.1 (ingestao de dados publicos; contato via repositorio)';

export interface DownloadResult {
  path: string;
  sha256: string;
  bytes: number;
  content_type: string | null;
}

export class HttpError extends Error {
  constructor(public readonly url: string, public readonly status: number, message?: string) {
    super(message ?? `HTTP ${status} em ${url}`);
  }
}

async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'user-agent': USER_AGENT, accept: '*/*', ...(init.headers ?? {}) },
        redirect: 'follow',
      });
      if (res.status >= 500 && attempt < retries) {
        lastErr = new HttpError(url, res.status);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      if (!res.ok) throw new HttpError(url, res.status);
      return res;
    } catch (e) {
      lastErr = e;
      if (e instanceof HttpError && e.status < 500) throw e;
      if (attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

/** GET JSON. Envia só `accept: application/json` — APIs com negociação de conteúdo (UKHSA) devolvem HTML se text/html estiver no accept. */
export async function fetchJson<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchWithRetry(url, { ...init, headers: { accept: 'application/json', ...(init.headers ?? {}) } });
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta não é JSON (${res.headers.get('content-type') ?? 'sem content-type'}) em ${url}: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
}

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetchWithRetry(url, { ...init, headers: { accept: 'text/html, text/plain, */*', ...(init.headers ?? {}) } });
  return res.text();
}

/** Baixa a URL em streaming para um arquivo, calculando sha256 e bytes sem carregar o corpo em memória. */
export async function downloadToFile(url: string, destPath: string, init: RequestInit = {}): Promise<DownloadResult> {
  const res = await fetchWithRetry(url, init);
  if (!res.body) throw new Error(`Resposta sem corpo: ${url}`);
  await mkdir(join(destPath, '..'), { recursive: true });
  const hash = createHash('sha256');
  let bytes = 0;
  const source = Readable.fromWeb(res.body as never);
  source.on('data', (chunk: Buffer) => {
    hash.update(chunk);
    bytes += chunk.length;
  });
  await pipeline(source, createWriteStream(destPath));
  return { path: destPath, sha256: hash.digest('hex'), bytes, content_type: res.headers.get('content-type') };
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
