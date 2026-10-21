import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

// Componentes cliente usam o App Router; fora do Next, basta um stub de navegação.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined }) }));
import { renderToStaticMarkup } from 'react-dom/server';
import type { z } from 'zod';
import { DISABLED_MESSAGE, handleChatRequest, handleChatStatus, MAX_MESSAGE_CHARS, MAX_TOOL_STEPS } from '@/lib/assistant/handler';
import { clientIp, MemoryRateLimiter } from '@/lib/assistant/rate-limit';
import { ASSISTANT_MODEL_ID, SYSTEM_PROMPT, SYSTEM_PROMPT_REQUIRED_RULES } from '@/lib/assistant/system-prompt';
import { ASSISTANT_TOOL_NAMES, assistantTools, GeoCodeSchema, IndicatorIdSchema } from '@/lib/assistant/tools';
import { queryTerms, searchPages } from '@/lib/assistant/search';
import { AssistentePanel } from '@/components/assistente/AssistentePanel';
import { CommandPalette } from '@/components/terminal/CommandPalette';

const FIXTURES = path.join(process.cwd(), 'test', 'fixtures', 'content');

function chatRequest(body: unknown, headers: Record<string, string> = {}): Request {
  const raw = JSON.stringify(body);
  return new Request('http://localhost/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(raw)), ...headers }, body: raw });
}

const userMsg = (text: string) => ({ messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text }] }] });

describe('rota /api/chat: guardas', () => {
  it('responde 503 assistant_disabled sem ANTHROPIC_API_KEY (POST e GET)', async () => {
    const res = await handleChatRequest(chatRequest(userMsg('oi')), { env: {} });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('assistant_disabled');
    expect(body.error.message).toBe(DISABLED_MESSAGE);
    expect(body.error.message).toMatch(/ANTHROPIC_API_KEY/);
    const status = handleChatStatus({ env: { ANTHROPIC_API_KEY: '  ' } });
    expect(status.status).toBe(503);
    const on = handleChatStatus({ env: { ANTHROPIC_API_KEY: 'sk-test' } });
    expect(on.status).toBe(200);
    expect(await on.json()).toMatchObject({ enabled: true, model: ASSISTANT_MODEL_ID });
  });

  it('guarda de tamanho: mensagem acima de 2.000 caracteres → 400 message_too_long (antes de chamar o modelo)', async () => {
    const env = { ANTHROPIC_API_KEY: 'sk-test' };
    const long = 'a'.repeat(MAX_MESSAGE_CHARS + 1);
    const res = await handleChatRequest(chatRequest(userMsg(long)), { env, limiter: new MemoryRateLimiter() });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('message_too_long');
    const empty = await handleChatRequest(chatRequest(userMsg('   ')), { env, limiter: new MemoryRateLimiter() });
    expect(empty.status).toBe(400);
    const bad = await handleChatRequest(new Request('http://localhost/api/chat', { method: 'POST', body: '{nope' }), { env, limiter: new MemoryRateLimiter() });
    expect(bad.status).toBe(400);
    const tooMany = await handleChatRequest(chatRequest({ messages: Array.from({ length: 41 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', parts: [{ type: 'text', text: 'x' }] })) }), { env, limiter: new MemoryRateLimiter() });
    expect(tooMany.status).toBe(400);
  });

  it('rate limit em memória por IP: 20 por 10 min, 429 com retry-after', async () => {
    const limiter = new MemoryRateLimiter({ max: 2, windowMs: 10_000 });
    const env = { ANTHROPIC_API_KEY: 'sk-test' };
    const long = 'a'.repeat(MAX_MESSAGE_CHARS + 1); // barra depois do rate limit, sem chamar o modelo
    let t = 1_000_000;
    const now = () => t;
    const ip = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
    expect((await handleChatRequest(chatRequest(userMsg(long), ip), { env, limiter, now })).status).toBe(400);
    expect((await handleChatRequest(chatRequest(userMsg(long), ip), { env, limiter, now })).status).toBe(400);
    const blocked = await handleChatRequest(chatRequest(userMsg(long), ip), { env, limiter, now });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(((await blocked.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
    // outro IP não é afetado; após a janela, libera.
    expect((await handleChatRequest(chatRequest(userMsg(long), { 'x-forwarded-for': '198.51.100.2' }), { env, limiter, now })).status).toBe(400);
    t += 10_001;
    expect((await handleChatRequest(chatRequest(userMsg(long), ip), { env, limiter, now })).status).toBe(400);
    expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': ' 1.2.3.4 ,5.6.7.8' } }))).toBe('1.2.3.4');
    expect(clientIp(new Request('http://x'))).toBe('unknown');
    const d = new MemoryRateLimiter();
    for (let i = 0; i < 20; i++) expect(d.check('k', 0).allowed).toBe(true);
    expect(d.check('k', 0).allowed).toBe(false);
    expect(d.check('k', 10 * 60 * 1000 + 1).allowed).toBe(true);
  });
});

describe('ferramentas do assistente', () => {
  it('expõe as 9 ferramentas com schemas zod validados', () => {
    expect([...ASSISTANT_TOOL_NAMES].sort()).toEqual(['buscar_paginas', 'fontes', 'frescor', 'glossario', 'listar_indicadores', 'nowcast', 'obter_serie', 'sinais_ears', 'ultimo_valor'].sort());
    expect(MAX_TOOL_STEPS).toBe(6);
    const serie = assistantTools.obter_serie.inputSchema as z.ZodTypeAny;
    expect(serie.safeParse({ indicator: 'sivep_srag_ah1n1pdm09_confirmed' })).toMatchObject({ success: true, data: { geo_code: 'BRA' } });
    expect(serie.safeParse({ indicator: 'DROP TABLE' }).success).toBe(false);
    expect(serie.safeParse({ indicator: 'x', geo_code: 'SP' }).success).toBe(false);
    expect(serie.safeParse({ indicator: 'x', geo_code: 'BR-SP', from: '2026-W01', to: '2026' }).success).toBe(true);
    expect(serie.safeParse({ indicator: 'x', from: '2026-13' }).success).toBe(false);
    expect(IndicatorIdSchema.safeParse('flunet_ah1n1pdm09_detections').success).toBe(true);
    expect(GeoCodeSchema.safeParse('BR-SE').success).toBe(true);
    expect((assistantTools.fontes.inputSchema as z.ZodTypeAny).safeParse({ prioridade: 'P3' }).success).toBe(false);
    expect((assistantTools.buscar_paginas.inputSchema as z.ZodTypeAny).safeParse({ consulta: 'a' }).success).toBe(false);
    expect((assistantTools.glossario.inputSchema as z.ZodTypeAny).safeParse({ termo: 'SRAG' }).success).toBe(true);
    for (const name of ASSISTANT_TOOL_NAMES) {
      const t = assistantTools[name] as { description?: string; execute?: unknown };
      expect(t.description, name).toBeTruthy();
      expect(typeof t.execute, name).toBe('function');
    }
  });

  it('ultimo_valor e obter_serie (modo mock) devolvem número só com fonte, base, universo e citações', async () => {
    const opts = { toolCallId: 't1', messages: [] } as unknown as Parameters<NonNullable<typeof assistantTools.ultimo_valor.execute>>[1];
    const last = (await assistantTools.ultimo_valor.execute!({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_code: 'BRA' }, opts)) as Record<string, unknown>;
    expect(last.ok).toBe(true);
    expect(last.last).toMatchObject({ suppressed: false });
    expect(typeof (last.last as { value: unknown }).value).toBe('number');
    expect(last.universe_note).toMatch(/não todos os casos de H1N1/);
    expect(last.data_as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(last.source).toMatchObject({ id: 'BR-03' });
    expect(last.citations).toEqual(expect.arrayContaining([expect.objectContaining({ url: '/dados/brasil/?indicador=sivep_srag_ah1n1pdm09_confirmed' })]));

    const serie = (await assistantTools.obter_serie.execute!({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_code: 'BR-AC' }, opts)) as { ok: boolean; points: Array<{ suppressed: boolean; value: number | null; display: string }> };
    expect(serie.ok).toBe(true);
    expect(serie.points.length).toBeLessThanOrEqual(26);
    for (const p of serie.points) if (p.suppressed) {
      expect(p.value).toBeNull();
      expect(p.display).toBe('<5');
    }

    const gl = (await assistantTools.glossario.execute!({ termo: 'srag' }, opts)) as { ok: boolean; term?: string };
    expect(gl).toMatchObject({ ok: true, term: 'SRAG' });
    const nc = (await assistantTools.nowcast.execute!({ indicator: 'sivep_srag_ah1n1pdm09_confirmed', geo_code: 'BRA' }, opts)) as { ok: boolean; available: boolean };
    expect(nc).toMatchObject({ ok: false, available: false });
    const ears = (await assistantTools.sinais_ears.execute!({ indicator: 'sivep_srag_ah1n1pdm09_confirmed' }, opts)) as { warning: string };
    expect(ears.warning).toMatch(/sinal estatístico, não surto confirmado/);
  });
});

describe('system prompt', () => {
  it('contém as regras-chave de segurança, integridade e formato', () => {
    for (const rule of SYSTEM_PROMPT_REQUIRED_RULES) expect(SYSTEM_PROMPT, rule).toContain(rule);
    expect(SYSTEM_PROMPT).toMatch(/português/i);
    expect(SYSTEM_PROMPT).toMatch(/procure um serviço de saúde/i);
    expect(SYSTEM_PROMPT).toMatch(/sinal estatístico, não surto confirmado/);
    expect(ASSISTANT_MODEL_ID).toBe('claude-sonnet-5-5');
  });
});

describe('busca de páginas', () => {
  beforeEach(() => {
    process.env.H1N1_CONTENT_DIR = FIXTURES;
  });
  afterEach(() => {
    delete process.env.H1N1_CONTENT_DIR;
  });

  it('encontra páginas elegíveis por título/resumo e ignora não elegíveis', () => {
    expect(queryTerms('Quais são os sinais de alerta?')).toEqual(['sinais', 'alerta']);
    const hits = searchPages('sinais de alerta');
    expect(hits[0]?.url).toBe('/sintomas/sinais-de-alerta/');
    expect(hits[0]?.summary_answer).toMatch(/Falta de ar/);
    const vac = searchPages('vacina');
    expect(vac.map((h) => h.url)).not.toContain('/vacina/'); // draft + noindex_until_reviewed → não elegível
    expect(searchPages('')).toEqual([]);
    expect(searchPages('zzzz-inexistente')).toEqual([]);
    const h1 = searchPages('o que é H1N1');
    expect(h1.map((h) => h.url)).toContain('/o-que-e-h1n1/');
  });
});

describe('componentes', () => {
  it('AssistentePanel renderiza sugestões, aviso fixo e aviso de dados pessoais; compact reduz altura', () => {
    const html = renderToStaticMarkup(<AssistentePanel />);
    expect(html).toContain('Pergunte ao observatório');
    expect(html).toContain('Como está o H1N1 no Brasil nas últimas semanas?');
    expect(html).toContain('Qual a diferença entre SRAG e H1N1 confirmado?');
    expect(html).toContain('Quais UFs têm sinal estatístico?');
    expect(html).toMatch(/não substitui avaliação médica/);
    expect(html).toMatch(/Não envie dados de saúde pessoais/);
    expect(html).toContain('/sintomas/sinais-de-alerta/');
    expect(html).toContain('max-h-[28rem]');
    const compact = renderToStaticMarkup(<AssistentePanel compact />);
    expect(compact).toContain('max-h-56');
    expect(compact).toContain('data-compact="true"');
  });

  it('CommandPalette fechada não renderiza nada (abre por ⌘K ou evento h1n1:palette)', () => {
    expect(renderToStaticMarkup(<CommandPalette />)).toBe('');
  });
});
