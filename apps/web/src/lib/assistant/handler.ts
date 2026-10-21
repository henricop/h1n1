/**
 * Handler do assistente (Node runtime): guardas (chave, rate limit, tamanho), validação das mensagens
 * e streaming com o Vercel AI SDK (`ai` v7 + `@ai-sdk/anthropic` v4). Sem persistência de conversas.
 */
import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, validateUIMessages, type LanguageModel, type UIMessage } from 'ai';
import { z } from 'zod';
import { chatRateLimiter, clientIp, type MemoryRateLimiter } from './rate-limit';
import { ASSISTANT_MODEL_ID, SYSTEM_PROMPT } from './system-prompt';
import { assistantTools } from './tools';

export const MAX_MESSAGE_CHARS = 2_000;
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

/** Corpo mínimo aceito: mensagens de UI com partes de texto (partes de ferramenta passam por validateUIMessages). */
const BodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), parts: z.array(z.object({ type: z.string() }).passthrough()) }).passthrough()).min(1).max(MAX_MESSAGES),
});

function textOf(parts: Array<{ type: string; text?: unknown }>): string {
  return parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('\n');
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

/** POST: valida e responde em streaming (UI message stream). */
export async function handleChatRequest(req: Request, opts: HandlerOptions = {}): Promise<Response> {
  const env = opts.env ?? process.env;
  const limiter = opts.limiter ?? chatRateLimiter;
  const now = opts.now ?? Date.now;

  if (!assistantEnabled(env)) return jsonError(503, 'assistant_disabled', DISABLED_MESSAGE);

  const decision = limiter.check(clientIp(req), now());
  if (!decision.allowed) {
    return jsonError(429, 'rate_limited', `Muitas perguntas em pouco tempo. Tente novamente em ${decision.retryAfterSec} s.`, { 'retry-after': String(decision.retryAfterSec) });
  }

  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return jsonError(413, 'payload_too_large', 'Conversa longa demais. Recomece a conversa.');

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'validation_error', 'Corpo inválido: envie JSON { messages: UIMessage[] }.');
  }
  const body = BodySchema.safeParse(raw);
  if (!body.success) return jsonError(400, 'validation_error', 'messages: formato inválido ou conversa longa demais.');

  const last = body.data.messages[body.data.messages.length - 1]!;
  if (last.role !== 'user') return jsonError(400, 'validation_error', 'A última mensagem deve ser do usuário.');
  const lastText = textOf(last.parts as Array<{ type: string; text?: unknown }>);
  if (!lastText.trim()) return jsonError(400, 'validation_error', 'Escreva uma pergunta.');
  if (lastText.length > MAX_MESSAGE_CHARS) return jsonError(400, 'message_too_long', `Mensagem com mais de ${MAX_MESSAGE_CHARS} caracteres. Resuma a pergunta.`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(lastText)) return jsonError(400, 'validation_error', 'Mensagem contém caracteres de controle.');

  let messages: UIMessage[];
  try {
    messages = await validateUIMessages({ messages: body.data.messages, tools: assistantTools });
  } catch (err) {
    return jsonError(400, 'validation_error', `messages inválidas: ${err instanceof Error ? err.message : String(err)}`);
  }

  const model: LanguageModel = opts.model ?? createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(ASSISTANT_MODEL_ID);

  const result = streamText({
    model,
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages, { tools: assistantTools, ignoreIncompleteToolCalls: true }),
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
