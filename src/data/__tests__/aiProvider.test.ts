import type { AiContext } from '@/domain';

import { parseSse, RemoteAiClient } from '../ai/remoteAi';
import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const ctx: AiContext = {
  locale: 'tr',
  coords: { latitude: 41.0, longitude: 29.0 },
  adventureTypes: ['hiking'],
  plan: 'free',
};

describe('AI repository (mock)', () => {
  it('seed sohbetleri listeler ve mesajları sıralı döner', async () => {
    const p = make();
    const threads = await p.ai.threads(CURRENT_USER_ID);
    expect(threads.length).toBeGreaterThanOrEqual(2);
    expect((threads[0]?.updatedAt ?? '') >= (threads[1]?.updatedAt ?? '')).toBe(true);
    const thread = await p.ai.thread(CURRENT_USER_ID, 'ait_kackar');
    expect(thread?.messages.length).toBe(4);
    expect(thread?.messages[0]?.role).toBe('user');
    expect(thread?.messages[1]?.actions.length).toBeGreaterThan(0);
    expect(await p.ai.thread(CURRENT_USER_ID, 'yok')).toBeNull();
    expect(await p.ai.thread('u_elif', 'ait_kackar')).toBeNull();
  });

  it('send yeni sohbet açar, mevcut sohbete ekler ve yerel cevap üretir', async () => {
    const p = make();
    const before = (await p.ai.threads(CURRENT_USER_ID)).length;
    const reply = await p.ai.send(CURRENT_USER_ID, null, 'Yakınımda kamp alanı öner', ctx);
    expect(reply.role).toBe('assistant');
    expect(reply.intent).toBe('find_place');
    expect(reply.actions.some((a) => a.href.startsWith('/library/'))).toBe(true);

    const threads = await p.ai.threads(CURRENT_USER_ID);
    expect(threads.length).toBe(before + 1);
    expect(threads[0]?.id).toBe(reply.threadId);
    expect(threads[0]?.title).toBe('Yakınımda kamp alanı öner');

    const second = await p.ai.send(
      CURRENT_USER_ID,
      reply.threadId,
      'Kanama nasıl durdurulur?',
      ctx,
    );
    expect(second.threadId).toBe(reply.threadId);
    expect(second.actions.some((a) => a.href === '/first-aid/bleeding')).toBe(true);
    const thread = await p.ai.thread(CURRENT_USER_ID, reply.threadId);
    expect(thread?.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);

    await expect(p.ai.send(CURRENT_USER_ID, 'yok', 'selam', ctx)).rejects.toThrow();
    await expect(p.ai.send(CURRENT_USER_ID, null, '   ', ctx)).rejects.toThrow();
  });

  it('planTrip kütüphaneden gün planı üretir', async () => {
    const p = make();
    const plan = await p.ai.planTrip(CURRENT_USER_ID, 'Kaçkar için 3 günlük yürüyüş planla', ctx);
    expect(plan.days).toHaveLength(3);
    expect(plan.days.reduce((s, d) => s + d.ascentM, 0)).toBeGreaterThan(0);
    expect(plan.title).toContain('Kaçkar');
  });

  it('deleteThread sohbeti ve mesajları siler', async () => {
    const p = make();
    await p.ai.deleteThread(CURRENT_USER_ID, 'ait_kas');
    expect(await p.ai.thread(CURRENT_USER_ID, 'ait_kas')).toBeNull();
    expect((await p.ai.threads(CURRENT_USER_ID)).some((t) => t.id === 'ait_kas')).toBe(false);
    await expect(p.ai.deleteThread(CURRENT_USER_ID, 'ait_kas')).rejects.toThrow();
  });
});

describe('RemoteAiClient', () => {
  it('parseSse olayları ve kalan tamponu ayırır', () => {
    const { events, rest } = parseSse(
      'event: delta\ndata: {"text":"Mer"}\n\nevent: delta\ndata: {"text":"haba"}\n\nevent: done\ndata: {"con',
    );
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ event: 'delta', data: '{"text":"Mer"}' });
    expect(rest).toBe('event: done\ndata: {"con');
  });

  it('chat SSE gövdesini birleştirir ve done yükünü kullanır', async () => {
    const sse = [
      'event: delta\ndata: {"text":"Kaçkar "}\n\n',
      'event: delta\ndata: {"text":"için plan."}\n\n',
      'event: done\ndata: {"intent":"plan_trip","actions":[{"label":"Planlayıcı","href":"/maps/planner","icon":"route"},{"label":"kötü","href":"http://x"}]}\n\n',
    ].join('');
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    };
    const client = new RemoteAiClient({ baseUrl: 'http://gw/', apiKey: 'k', fetchImpl });
    const deltas: string[] = [];
    const result = await client.chat([{ role: 'user', content: 'Kaçkar' }], ctx, (d) =>
      deltas.push(d),
    );
    expect(result.content).toBe('Kaçkar için plan.');
    expect(result.intent).toBe('plan_trip');
    expect(result.actions).toEqual([{ label: 'Planlayıcı', href: '/maps/planner', icon: 'route' }]);
    expect(deltas.join('')).toBe('Kaçkar için plan.');
    expect(calls[0]?.url).toBe('http://gw/v1/chat');
    expect((calls[0]?.init?.headers as Record<string, string>)['x-zirtan-key']).toBe('k');
  });

  it('hata durumunda RemoteAiError fırlatır', async () => {
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 401 });
    const client = new RemoteAiClient({ baseUrl: 'http://gw', fetchImpl });
    await expect(client.chat([{ role: 'user', content: 'x' }], ctx)).rejects.toThrow('nope');
  });
});
