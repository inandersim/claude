import { RemoteSpeciesClient } from '../ai/remoteSpecies';
import { MockDatabase } from '../mock/database';
import { createMockProvider } from '../mock/provider';
import { createWildlifeRepository } from '../mock/repos/wildlife';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const KACKAR = { latitude: 40.85, longitude: 41.2 };

describe('Wildlife — türler ve tanımlama', () => {
  it('liste, filtre ve detay', async () => {
    const p = make();
    const all = await p.wildlife.species({});
    expect(all.length).toBe(40);
    const tr = await p.wildlife.species({ countryCode: 'TR', group: 'snake' });
    expect(tr.every((s) => s.group === 'snake' && s.countryCodes.includes('TR'))).toBe(true);
    expect((await p.wildlife.speciesById('sp_ursus_arctos'))?.commonName).toBe('Boz ayı');
    expect(await p.wildlife.speciesById('yok')).toBeNull();
  });

  it('identify: uzak istemci yokken yerel tahmin üretir ve geçmişe yazar', async () => {
    const p = make();
    const before = await p.wildlife.identifications(CURRENT_USER_ID);
    expect(before.length).toBe(3);
    const r = await p.wildlife.identify(CURRENT_USER_ID, {
      imageUri: null,
      imageBase64: null,
      description: 'zigzag sırt, üçgen kafa, kayalıkta',
      coords: KACKAR,
      locale: 'tr',
    });
    expect(r.source).toBe('local');
    expect(r.candidates[0]?.name).toMatch(/engerek/i);
    const after = await p.wildlife.identifications(CURRENT_USER_ID);
    expect(after.length).toBe(4);
    expect(after[0]?.id).toBe(r.id);
    await expect(
      p.wildlife.identify('u_yok', {
        imageUri: null,
        imageBase64: null,
        description: 'x',
        coords: null,
        locale: 'tr',
      }),
    ).rejects.toThrow();
  });

  it('identify: uzak istemci başarılıysa remote, hata verirse yerel tahmine düşer', async () => {
    const p = make();
    const okFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              name: 'Boz ayı',
              scientificName: 'Ursus arctos',
              confidence: 0.9,
              danger: 'dangerous',
            },
          ],
          advice: ['Uzaklaş'],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const failFetch: typeof fetch = async () => new Response('down', { status: 503 });

    const okClient = new RemoteSpeciesClient({ baseUrl: 'http://gw', fetchImpl: okFetch });
    const badClient = new RemoteSpeciesClient({ baseUrl: 'http://gw', fetchImpl: failFetch });
    const input = {
      imageUri: null,
      imageBase64: null,
      description: 'kahverengi büyük memeli',
      coords: KACKAR,
      locale: 'tr',
    };

    const remoteOk = await okClient.identify(input, await p.wildlife.species({}));
    expect(remoteOk.source).toBe('remote');
    expect(remoteOk.candidates[0]).toMatchObject({ speciesId: 'sp_ursus_arctos', confidence: 0.9 });
    await expect(badClient.identify(input, [])).rejects.toThrow();
    await expect(okClient.identify({ ...input, description: '' }, [])).rejects.toThrow(/gerekli/);
  });
});

describe('Wildlife — soru / cevap / kabul / oy', () => {
  it('ask → answer → accept akışı; answersCount ve status', async () => {
    const p = make();
    const q = await p.wildlife.ask(CURRENT_USER_ID, {
      title: 'Bu örümcek ne?',
      body: 'Siyah, karnında kırmızı benekler.',
      imageUrl: null,
      coords: KACKAR,
      locationName: 'Datça',
      speciesGuessId: 'sp_latrodectus_tredecimguttatus',
      urgent: false,
    });
    expect(q.status).toBe('open');
    expect(q.answersCount).toBe(0);
    expect(q.speciesGuess?.id).toBe('sp_latrodectus_tredecimguttatus');
    expect(q.author.id).toBe(CURRENT_USER_ID);
    expect(q.onlineHelpers).toBeGreaterThanOrEqual(12);

    const answered = await p.wildlife.answer(
      'u_can',
      q.id,
      'Karadul, dokunma.',
      'sp_latrodectus_tredecimguttatus',
    );
    expect(answered.answersCount).toBe(1);
    expect(answered.status).toBe('answered');
    expect(answered.answers[0]).toMatchObject({
      authorId: 'u_can',
      isExpert: true,
      upvotedByMe: false,
    });
    expect(answered.answers[0]?.species?.id).toBe('sp_latrodectus_tredecimguttatus');

    // Soru sahibine bildirim gitti
    const notifications = await p.notifications.list(CURRENT_USER_ID);
    expect(notifications.some((n) => n.type === 'comment' && n.targetId === q.id)).toBe(true);

    const answerId = answered.answers[0]!.id;
    await expect(p.wildlife.accept('u_elif', q.id, answerId)).rejects.toThrow(/sahibi/);
    const resolved = await p.wildlife.accept(CURRENT_USER_ID, q.id, answerId);
    expect(resolved.status).toBe('resolved');
    expect(resolved.acceptedAnswerId).toBe(answerId);
    expect(resolved.answers[0]?.id).toBe(answerId);

    const mine = await p.wildlife.questions(CURRENT_USER_ID, { mineOnly: true });
    expect(mine.some((x) => x.id === q.id)).toBe(true);
    const resolvedList = await p.wildlife.questions(CURRENT_USER_ID, { status: 'resolved' });
    expect(resolvedList.every((x) => x.status === 'resolved')).toBe(true);
  });

  it('upvote yalnızca bir kez sayılır', async () => {
    const p = make();
    const first = await p.wildlife.upvote(CURRENT_USER_ID, 'wa_2');
    expect(first.upvotes).toBe(6);
    const second = await p.wildlife.upvote(CURRENT_USER_ID, 'wa_2');
    expect(second.upvotes).toBe(6);
    const q = await p.wildlife.question(CURRENT_USER_ID, 'wq_1');
    expect(q?.answers.find((a) => a.id === 'wa_2')?.upvotedByMe).toBe(true);
    // Zaten seed'de oy verilmiş cevap artmaz
    expect((await p.wildlife.upvote(CURRENT_USER_ID, 'wa_1')).upvotes).toBe(12);
    await expect(p.wildlife.upvote(CURRENT_USER_ID, 'yok')).rejects.toThrow();
  });

  it('acil sorular önce listelenir; boş başlık reddedilir', async () => {
    const p = make();
    const list = await p.wildlife.questions(CURRENT_USER_ID);
    expect(list[0]?.urgent).toBe(true);
    const urgent = await p.wildlife.questions(CURRENT_USER_ID, { urgentOnly: true });
    expect(urgent.length).toBe(2);
    await expect(
      p.wildlife.ask(CURRENT_USER_ID, {
        title: '  ',
        body: 'x',
        imageUrl: null,
        coords: null,
        locationName: '',
        speciesGuessId: null,
        urgent: true,
      }),
    ).rejects.toThrow();
    expect(await p.wildlife.question(CURRENT_USER_ID, 'yok')).toBeNull();
  });
});

describe('Wildlife — kaçırma ve çevrimiçi yardımcılar', () => {
  it('deterrents, deterrent ve logDeterrent', async () => {
    const p = make();
    const all = await p.wildlife.deterrents();
    expect(all.length).toBe(9);
    expect((await p.wildlife.deterrent('snake')).sounds[0]?.sound).toBe('stomp');
    const ev = await p.wildlife.logDeterrent(CURRENT_USER_ID, 'bear', 'air_horn', KACKAR, 17.6);
    expect(ev).toMatchObject({
      userId: CURRENT_USER_ID,
      animal: 'bear',
      sound: 'air_horn',
      durationS: 18,
    });
    expect(ev.id).toMatch(/^det/);
  });

  it('onlineHelpers: sayı ve 3 uzman', async () => {
    const p = make();
    const r = await p.wildlife.onlineHelpers();
    expect(r.count).toBeGreaterThanOrEqual(12);
    expect(r.count).toBeLessThanOrEqual(140);
    expect(r.experts.length).toBe(3);
    expect(r.experts[0]?.id).toBe('u_can');
  });

  it('createWildlifeRepository remote:null ile yerel tahmin', async () => {
    const db = new MockDatabase(false);
    const users = (await db.load()).users;
    const repo = createWildlifeRepository(
      {
        db,
        wait: async () => undefined,
        latencyMs: 0,
        requireUser: (list, id) => {
          const u = list.find((x) => x.id === id);
          if (!u) throw new Error('yok');
          return u;
        },
        pushNotification: async () => undefined,
      },
      { remote: null },
    );
    expect(users.length).toBeGreaterThan(0);
    const r = await repo.identify(CURRENT_USER_ID, {
      imageUri: null,
      imageBase64: null,
      description: 'çıngırak sesi, elmas desen',
      coords: { latitude: 33.4, longitude: -112 },
      locale: 'tr',
    });
    expect(r.source).toBe('local');
    expect(r.candidates[0]?.speciesId).toBe('sp_crotalus_atrox');
  });
});
