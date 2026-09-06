import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const ist = { latitude: 41.0, longitude: 29.0 };

describe('Kids — yerler', () => {
  it('liste, süzgeç, mesafe ve kaydetme', async () => {
    const p = make();
    const all = await p.kids.places(CURRENT_USER_ID, { origin: ist });
    expect(all.length).toBeGreaterThanOrEqual(28);
    expect(all[0]!.distanceKm).not.toBeNull();
    // İstanbul'dan en yakın yer İstanbul'da olmalı
    expect(all[0]!.locationName).toContain('İstanbul');

    const beaches = await p.kids.places(CURRENT_USER_ID, { kind: 'beach', ageBand: '0_3' });
    expect(beaches.every((x) => x.kind === 'beach' && x.ageBands.includes('0_3'))).toBe(true);
    // Kaputaş 0–3 için listelenmez
    expect(beaches.some((x) => x.id === 'kp_kaputas')).toBe(false);

    const stroller = await p.kids.places(CURRENT_USER_ID, { strollerOnly: true });
    expect(stroller.every((x) => x.strollerFriendly)).toBe(true);

    expect(await p.kids.toggleSave(CURRENT_USER_ID, 'kp_polonezkoy')).toBe(true);
    const detail = await p.kids.place(CURRENT_USER_ID, 'kp_polonezkoy', ist);
    expect(detail?.savedByMe).toBe(true);
    expect(detail?.linkedBusinessId).toBeNull();
    expect(await p.kids.toggleSave(CURRENT_USER_ID, 'kp_polonezkoy')).toBe(false);
    expect(await p.kids.place(CURRENT_USER_ID, 'yok', null)).toBeNull();
    await expect(p.kids.toggleSave(CURRENT_USER_ID, 'yok')).rejects.toThrow();
  });
});

describe('Kids — çocuk profilleri', () => {
  it('addChild / removeChild ve ilerlemenin silinmesi', async () => {
    const p = make();
    const before = await p.kids.children(CURRENT_USER_ID);
    expect(before.map((c) => c.name)).toEqual(['Defne', 'Ali']);

    const child = await p.kids.addChild(CURRENT_USER_ID, '  Ege ', '0_3', '🐢');
    expect(child.name).toBe('Ege');
    expect(child.ageBand).toBe('0_3');
    expect(child.avatar).toBe('🐢');
    expect((await p.kids.children(CURRENT_USER_ID)).map((c) => c.name)).toEqual([
      'Defne',
      'Ali',
      'Ege',
    ]);
    await expect(p.kids.addChild(CURRENT_USER_ID, '   ', '4_6', '🦊')).rejects.toThrow();
    await expect(p.kids.addChild(CURRENT_USER_ID, 'defne', '4_6', '🦊')).rejects.toThrow();

    // Başkasının çocuğu listelenmez
    expect((await p.kids.children('u_elif')).map((c) => c.name)).toEqual(['Mina']);

    // Defne'nin tohum ilerlemesi var; profil kaldırılınca silinir
    expect((await p.kids.huntProgress(CURRENT_USER_ID, 'Defne')).points).toBe(130);
    const defne = before.find((c) => c.name === 'Defne')!;
    await p.kids.removeChild(CURRENT_USER_ID, defne.id);
    expect((await p.kids.children(CURRENT_USER_ID)).some((c) => c.id === defne.id)).toBe(false);
    expect((await p.kids.huntProgress(CURRENT_USER_ID, 'Defne')).points).toBe(0);
    await expect(p.kids.removeChild(CURRENT_USER_ID, defne.id)).rejects.toThrow();
  });
});

describe('Kids — doğa avı', () => {
  it('görevler yaşa göre süzülür', async () => {
    const p = make();
    const all = await p.kids.huntTasks(null);
    expect(all.length).toBeGreaterThanOrEqual(40);
    const small = await p.kids.huntTasks('0_3');
    expect(small.every((t) => t.ageBands.includes('0_3'))).toBe(true);
    expect(small.length).toBeLessThan(all.length);
  });

  it('completeTask puan ekler, eşikte çıkartma ve XP olayı yazar; tekrar sayılmaz', async () => {
    const p = make();
    const fresh = await p.kids.huntProgress(CURRENT_USER_ID, 'Ali');
    expect(fresh.points).toBe(0);
    expect(fresh.stickers).toEqual([]);

    const xpBefore = (await p.fun.summary(CURRENT_USER_ID)).level.xp;

    // ht_kozalak 10 + ht_kus_yuvasi 30 + ht_tas_sektir 25 = 65 → Yaprak (50)
    let prog = await p.kids.completeTask(CURRENT_USER_ID, 'Ali', 'ht_kozalak');
    expect(prog.points).toBe(10);
    expect(prog.stickers).toEqual([]);
    prog = await p.kids.completeTask(CURRENT_USER_ID, 'Ali', 'ht_kus_yuvasi');
    expect(prog.points).toBe(40);
    prog = await p.kids.completeTask(CURRENT_USER_ID, 'Ali', 'ht_tas_sektir');
    expect(prog.points).toBe(65);
    expect(prog.stickers).toEqual(['leaf']);
    expect(prog.completedTaskIds).toEqual(['ht_kozalak', 'ht_kus_yuvasi', 'ht_tas_sektir']);

    // Aynı görev ikinci kez puan vermez
    prog = await p.kids.completeTask(CURRENT_USER_ID, 'Ali', 'ht_kozalak');
    expect(prog.points).toBe(65);
    expect(prog.completedTaskIds).toHaveLength(3);

    const xpAfter = (await p.fun.summary(CURRENT_USER_ID)).level.xp;
    expect(xpAfter).toBe(xpBefore + 25);

    await expect(p.kids.completeTask(CURRENT_USER_ID, 'Ali', 'yok')).rejects.toThrow();
  });

  it('Defne tohum verisi ve resetHunt', async () => {
    const p = make();
    const defne = await p.kids.huntProgress(CURRENT_USER_ID, 'Defne');
    expect(defne.completedTaskIds).toHaveLength(6);
    expect(defne.stickers).toEqual(['leaf', 'cone']);
    const reset = await p.kids.resetHunt(CURRENT_USER_ID, 'Defne');
    expect(reset.points).toBe(0);
    expect(reset.stickers).toEqual([]);
    expect(reset.completedTaskIds).toEqual([]);
    expect((await p.kids.huntProgress(CURRENT_USER_ID, 'Defne')).points).toBe(0);
  });
});

describe('Kids — kontrol listesi', () => {
  it('yaş bandına göre süzülür ve kategori sırasına dizilir', async () => {
    const p = make();
    const all = await p.kids.checklist(null);
    expect(all.length).toBeGreaterThanOrEqual(30);
    const baby = await p.kids.checklist('0_3');
    expect(baby.some((i) => i.key === 'diapers')).toBe(true);
    expect(baby.some((i) => i.key === 'whistle')).toBe(false);
    expect(baby[0]!.category).toBe('safety');
    const teen = await p.kids.checklist('11_14');
    expect(teen.some((i) => i.key === 'diapers')).toBe(false);
  });
});
