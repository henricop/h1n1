/**
 * Handler do assistente (Node runtime): guardas (chave, rate limit, tamanho em bytes lendo o stream),
 * validação das mensagens (só `user`/`assistant` com partes de texto; `system` e partes de ferramenta vindas do
 * cliente são descartadas) e streaming com o Vercel AI SDK (`ai` v7 + `@ai-sdk/anthropic` v4). Sem persistência.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, validateUIMessages, type LanguageModel, type UIMessage } from 'ai';
import { z } from 'zod';
import { chatRateLimiter, clientIp, type MemoryRateLimiter } from './rate-limit';
import { ASSISTANT_MODEL_ID, SYSTEM_PROMPT } from './system-prompt';
import { assistantTools } from './tools';

export const MAX_MESSAGE_CHARS = 2_000;
/** Soma dos caracteres de texto de toda a conversa enviada. */
export const MAX_CONVERSATION_CHARS = 12_000;
export const MAX_MESSAGES = 40;
export const MAX_TOOL_STEPS = 6;
export const MAX_BODY_BYTES = 256 * 1024;

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export function jsonError(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

export const DISABLED_MESSAGE = 'Assistente desativado nesta instalação (defina ANTHROPIC_API_KEY).';

/** Corpo aceito: mensagens `user`/`assistant`; `system` é rejeitado. Partes passam por `sanitizeParts`. */
const BodySchema = z.object({
  messages: z
    .array(z.object({ id: z.string().max(100).optional(), role: z.enum(['user', 'assistant']), parts: z.array(z.object({ type: z.string() }).passthrough()).max(50) }).strip())
    .min(1)
    .max(MAX_MESSAGES),
});

export interface TextPart {
  type: 'text';
  text: string;
}

/** Mantém só partes de texto (string); partes de ferramenta, arquivo, raciocínio etc. vindas do cliente são descartadas. */
export function sanitizeParts(parts: ReadonlyArray<{ type: string; text?: unknown }>): TextPart[] {
  return parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string').map((p) => ({ type: 'text', text: p.text }));
}

/**
 * Lê o corpo como texto com teto de bytes (mesmo sem Content-Length). Devolve null quando o limite é ultrapassado.
 */
export async function readBodyLimited(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

export interface HandlerOptions {
  env?: Record<string, string | undefined>;
  limiter?: MemoryRateLimiter;
  /** Modelo injetável (testes). */
  model?: LanguageModel;
  now?: () => number;
}

export function assistantEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY?.trim());
}

/** GET: estado do assistente (200 { enabled: true } ou 503 assistant_disabled). */
export function handleChatStatus(opts: HandlerOptions = {}): Response {
  const env = opts.env ?? process.env;
  if (!assistantEnabled(env)) return jsonError(503, 'assistant_disabled', DISABLED_MESSAGE);
  return Response.json({ enabled: true, model: ASSISTANT_MODEL_ID }, { headers: { 'cache-control': 'no-store' } });
}

const CONTROL_RE = /[\u0000-\u0008\u000b-\u001f\u007f]/; // eslint-disable-line no-control-regex

/** POST: valida e responde em streaming (UI message stream). */
export async function handleChatRequest(req: Request, opts: HandlerOptions = {}): Promise<Response> {
  const env = opts.env ?? process.env;
  const limiter = opts.limiter ?? chatRateLimiter;
  const now = opts.now ?? Date.now;

  if (!assistantEnabled(env)) return jsonError(503, 'assistant_disabled', DISABLED_MESSAGE);

  const decision = limiter.check(clientIp(req, env), now());
  if (!decision.allowed) {
    return jsonError(429, 'rate_limited', `Muitas perguntas em pouco tempo. Tente novamente em ${decision.retryAfterSec} s.`, { 'retry-after': String(decision.retryAfterSec) });
  }

  const text = await readBodyLimited(req, MAX_BODY_BYTES);
  if (text === null) return jsonError(413, 'payload_too_large', 'Conversa longa demais. Recomece a conversa.');

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return jsonError(400, 'validation_error', 'Corpo inválido: envie JSON { messages: UIMessage[] }.');
  }
  const body = BodySchema.safeParse(raw);
  if (!body.success) return jsonError(400, 'validation_error', 'messages: formato inválido ou conversa longa demais.');

  // Só texto: partes de ferramenta/sistema do cliente nunca chegam ao modelo.
  const messages: UIMessage[] = body.data.messages.map((m, i) => ({ id: m.id ?? `m${i}`, role: m.role, parts: sanitizeParts(m.parts as Array<{ type: string; text?: unknown }>) }));

  const last = messages[messages.length - 1]!;
  if (last.role !== 'user') return jsonError(400, 'validation_error', 'A última mensagem deve ser do usuário.');
  const lastText = (last.parts as TextPart[]).map((p) => p.text).join('\n');
  if (!lastText.trim()) return jsonError(400, 'validation_error', 'Escreva uma pergunta.');
  if (lastText.length > MAX_MESSAGE_CHARS) return jsonError(400, 'message_too_long', `Mensagem com mais de ${MAX_MESSAGE_CHARS} caracteres. Resuma a pergunta.`);
  if (CONTROL_RE.test(lastText)) return jsonError(400, 'validation_error', 'Mensagem contém caracteres de controle.');

  let total = 0;
  for (const m of messages) {
    for (const p of m.parts as TextPart[]) {
      if (p.text.length > MAX_MESSAGE_CHARS) return jsonError(400, 'message_too_long', `Cada mensagem deve ter até ${MAX_MESSAGE_CHARS} caracteres.`);
      total += p.text.length;
    }
  }
  if (total > MAX_CONVERSATION_CHARS) return jsonError(400, 'conversation_too_long', 'Conversa longa demais. Recomece a conversa.');

  let validated: UIMessage[];
  try {
    validated = await validateUIMessages({ messages, tools: assistantTools });
  } catch (err) {
    return jsonError(400, 'validation_error', `messages inválidas: ${err instanceof Error ? err.message : String(err)}`);
  }

  const model: LanguageModel = opts.model ?? createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(ASSISTANT_MODEL_ID);

  const result = streamText({
    model,
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(validated, { tools: assistantTools, ignoreIncompleteToolCalls: true }),
    tools: assistantTools,
    stopWhen: stepCountIs(MAX_TOOL_STEPS),
    maxOutputTokens: 1_500,
    providerOptions: { anthropic: { effort: 'medium' } },
    onError: ({ error }) => {
      console.error('[assistant] erro no streaming:', error instanceof Error ? error.message : error);
    },
  });

  return result.toUIMessageStreamResponse({
    headers: { 'cache-control': 'no-store' },
    onError: () => 'Falha ao consultar o modelo. Tente novamente em instantes.',
  });
}
