import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });

describe('Countries repository', () => {
  it('liste: en az 26 ülke, kaydedilen destinasyon ülkeleri önce, sonra alfabetik', async () => {
    const p = make();
    const list = await p.countries.list();
    expect(list.length).toBeGreaterThanOrEqual(26);
    // u_me EBC (NP) ve Kaçkar (TR) kaydetmiş; TR rehberi yok → NP ilk sırada
    expect(list[0]?.countryCode).toBe('NP');
    const rest = list.slice(1).map((c) => c.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, 'tr')));
    const codes = list.map((c) => c.countryCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('arama aksansız çalışır ve getByCode büyük/küçük harf duyarsız', async () => {
    const p = make();
    const hits = await p.countries.list('gurcistan');
    expect(hits.map((c) => c.countryCode)).toEqual(['GE']);
    expect((await p.countries.getByCode('np'))?.name).toBe('Nepal');
    expect(await p.countries.getByCode('ZZ')).toBeNull();
  });

  it('seed verisi bütünlüğü: her rehberde vize, belgeler ve kaynaklar dolu', async () => {
    const p = make();
    const list = await p.countries.list();
    for (const g of list) {
      expect(g.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(g.documents.length).toBeGreaterThanOrEqual(4);
      expect(g.documents.some((d) => d.key === 'passport')).toBe(true);
      expect(g.etiquette.length).toBeGreaterThanOrEqual(5);
      expect(g.watchOut.length).toBeGreaterThanOrEqual(5);
      expect(g.dailyTips.length).toBe(5);
      expect(g.sources.length).toBeGreaterThan(0);
      expect(new Set(g.documents.map((d) => d.key)).size).toBe(g.documents.length);
      if (g.visa.type === 'e_visa' || g.visa.type === 'embassy') {
        expect(g.documents.some((d) => d.key === 'visa')).toBe(true);
      }
    }
  });

  it('checklist: seed NP dolu, TZ boş, olmayan ülke için boş oluşturulur', async () => {
    const p = make();
    const np = await p.countries.checklist(CURRENT_USER_ID, 'NP');
    expect(np.done).toEqual(['passport', 'insurance', 'photos']);
    expect(np.tripDate).not.toBeNull();
    const tz = await p.countries.checklist(CURRENT_USER_ID, 'TZ');
    expect(tz.done).toEqual([]);
    const ge = await p.countries.checklist(CURRENT_USER_ID, 'ge');
    expect(ge.countryCode).toBe('GE');
    expect(ge.done).toEqual([]);
    expect(ge.tripDate).toBeNull();
    // ikinci çağrı aynı kaydı döner
    expect((await p.countries.checklist(CURRENT_USER_ID, 'GE')).userId).toBe(CURRENT_USER_ID);
    await expect(p.countries.checklist(CURRENT_USER_ID, 'ZZ')).rejects.toThrow();
  });

  it('toggleDocument idempotent: iki kez çağrı başlangıca döner', async () => {
    const p = make();
    const a = await p.countries.toggleDocument(CURRENT_USER_ID, 'TZ', 'passport');
    expect(a.done).toEqual(['passport']);
    const b = await p.countries.toggleDocument(CURRENT_USER_ID, 'TZ', 'insurance');
    expect(b.done).toEqual(['passport', 'insurance']);
    const c = await p.countries.toggleDocument(CURRENT_USER_ID, 'TZ', 'passport');
    expect(c.done).toEqual(['insurance']);
    const d = await p.countries.toggleDocument(CURRENT_USER_ID, 'TZ', 'insurance');
    expect(d.done).toEqual([]);
    await expect(p.countries.toggleDocument(CURRENT_USER_ID, 'TZ', 'ghost')).rejects.toThrow();
  });

  it('setTripDate ayarlar, temizler ve geçersiz tarihi reddeder', async () => {
    const p = make();
    const iso = '2026-12-01T12:00:00.000Z';
    const set = await p.countries.setTripDate(CURRENT_USER_ID, 'TZ', iso);
    expect(set.tripDate).toBe(iso);
    expect((await p.countries.checklist(CURRENT_USER_ID, 'TZ')).tripDate).toBe(iso);
    const cleared = await p.countries.setTripDate(CURRENT_USER_ID, 'TZ', null);
    expect(cleared.tripDate).toBeNull();
    await expect(p.countries.setTripDate(CURRENT_USER_ID, 'TZ', 'bugün')).rejects.toThrow();
    await expect(p.countries.setTripDate('u_ghost', 'TZ', iso)).rejects.toThrow();
  });

  it('sonuçlar sınırda kopyalanır (dış mutasyon veriyi bozmaz)', async () => {
    const p = make();
    const first = await p.countries.checklist(CURRENT_USER_ID, 'NP');
    first.done.push('hacked');
    const again = await p.countries.checklist(CURRENT_USER_ID, 'NP');
    expect(again.done).not.toContain('hacked');
  });
});
