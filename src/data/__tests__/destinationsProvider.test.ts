import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });
const ISTANBUL = { latitude: 41.0082, longitude: 28.9784 };

describe('Destinations provider', () => {
  it('seed: 18 destinasyon, her birinin etapları var, 2 kayıtlı', async () => {
    const p = make();
    const all = await p.destinations.list(CURRENT_USER_ID, {});
    expect(all.length).toBeGreaterThanOrEqual(16);
    for (const d of all) {
      const stages = await p.destinations.stages(d.id);
      expect(stages.length).toBeGreaterThanOrEqual(6);
      expect(stages.length).toBe(d.stageCount);
      expect(stages.map((s) => s.order)).toEqual(stages.map((_, i) => i + 1));
      expect(d.guide.length).toBeGreaterThan(1200);
    }
    expect(
      all
        .filter((d) => d.savedByMe)
        .map((d) => d.id)
        .sort(),
    ).toEqual(['dest_ebc', 'dest_kackar']);
  });

  it('list: mesafe ve filtre; getById savedByMe', async () => {
    const p = make();
    const near = await p.destinations.list(CURRENT_USER_ID, {
      origin: ISTANBUL,
      countryCode: 'TR',
    });
    expect(near.every((d) => d.countryCode === 'TR')).toBe(true);
    expect(near[0]?.distanceKm).not.toBeNull();
    for (let i = 1; i < near.length; i += 1) {
      expect(near[i]!.distanceKm!).toBeGreaterThanOrEqual(near[i - 1]!.distanceKm!);
    }
    const ebc = await p.destinations.getById(CURRENT_USER_ID, 'dest_ebc', null);
    expect(ebc?.savedByMe).toBe(true);
    expect(ebc?.distanceKm).toBeNull();
    expect(await p.destinations.getById(CURRENT_USER_ID, 'yok', null)).toBeNull();
  });

  it('toggleSave ekler/kaldırır ve saved listesine yansır', async () => {
    const p = make();
    expect(await p.destinations.toggleSave(CURRENT_USER_ID, 'dest_inca')).toEqual({ saved: true });
    expect((await p.destinations.saved(CURRENT_USER_ID)).map((d) => d.id)).toContain('dest_inca');
    expect(await p.destinations.toggleSave(CURRENT_USER_ID, 'dest_inca')).toEqual({ saved: false });
    expect((await p.destinations.saved(CURRENT_USER_ID)).map((d) => d.id)).not.toContain(
      'dest_inca',
    );
    await expect(p.destinations.toggleSave(CURRENT_USER_ID, 'yok')).rejects.toThrow();
  });

  it('logAms skor ve şiddeti hesaplar; baş ağrısı kuralı', async () => {
    const p = make();
    const before = await p.destinations.amsChecks(CURRENT_USER_ID);
    expect(before).toHaveLength(4);
    const c = await p.destinations.logAms(CURRENT_USER_ID, {
      destinationId: 'dest_ebc',
      elevationM: 4940,
      headache: 2,
      gi: 2,
      fatigue: 2,
      dizziness: 1,
      note: 'Lobuche',
    });
    expect(c.score).toBe(7);
    expect(c.severity).toBe('moderate');
    const noHeadache = await p.destinations.logAms(CURRENT_USER_ID, {
      destinationId: null,
      elevationM: 3000,
      headache: 0,
      gi: 3,
      fatigue: 3,
      dizziness: 3,
      note: '',
    });
    expect(noHeadache.severity).toBe('none');
    const after = await p.destinations.amsChecks(CURRENT_USER_ID);
    expect(after).toHaveLength(6);
    expect(after[0]?.id).toBe(noHeadache.id);
    await expect(
      p.destinations.logAms(CURRENT_USER_ID, {
        destinationId: null,
        elevationM: 12000,
        headache: 1,
        gi: 0,
        fatigue: 0,
        dizziness: 0,
        note: '',
      }),
    ).rejects.toThrow(/irtifa/);
  });

  it('createReturnPlan acil kişilerin userId’lerini bağlar; markReturned / cancel', async () => {
    const p = make();
    const start = new Date(Date.now() - 60_000).toISOString();
    const back = new Date(Date.now() + 3 * 3_600_000).toISOString();
    const plan = await p.destinations.createReturnPlan(CURRENT_USER_ID, {
      title: 'Aydos akşam turu',
      destinationId: null,
      adventureType: 'hiking',
      startAt: start,
      expectedReturnAt: back,
      graceMin: 30,
      route: 'Aydos Ormanı çevre yolu',
      companions: '',
    });
    expect(plan.status).toBe('active');
    expect(plan.contactIds).toEqual(['u_elif']);
    const returned = await p.destinations.markReturned(CURRENT_USER_ID, plan.id);
    expect(returned.status).toBe('returned');
    expect(returned.returnedAt).not.toBeNull();
    await expect(p.destinations.cancelReturnPlan(CURRENT_USER_ID, plan.id)).rejects.toThrow();

    await expect(
      p.destinations.createReturnPlan(CURRENT_USER_ID, {
        title: '',
        destinationId: null,
        adventureType: 'hiking',
        startAt: start,
        expectedReturnAt: back,
        graceMin: 30,
        route: '',
        companions: '',
      }),
    ).rejects.toThrow(/başlığı/);
    await expect(
      p.destinations.createReturnPlan(CURRENT_USER_ID, {
        title: 'x',
        destinationId: null,
        adventureType: 'hiking',
        startAt: back,
        expectedReturnAt: start,
        graceMin: 30,
        route: '',
        companions: '',
      }),
    ).rejects.toThrow(/başlangıçtan/);
  });

  it('checkOverdue: süresi + tolerans geçen aktif planı overdue yapar ve acil kişiye bildirim gönderir', async () => {
    const p = make();
    const nowIso = new Date().toISOString();
    expect(await p.destinations.checkOverdue(CURRENT_USER_ID, nowIso)).toEqual([]);

    // Aktif seed planı 2 saat sonra doluyor, tolerans 60 dk → 3 saat 1 dk sonrasını simüle et
    const later = new Date(Date.now() + 3 * 3_600_000 + 60_000).toISOString();
    const updated = await p.destinations.checkOverdue(CURRENT_USER_ID, later);
    expect(updated.map((u) => u.id)).toEqual(['rp_active']);
    expect(updated[0]?.status).toBe('overdue');
    expect(updated[0]?.alertSentAt).toBe(later);

    const plans = await p.destinations.returnPlans(CURRENT_USER_ID);
    expect(plans.find((x) => x.id === 'rp_active')?.status).toBe('overdue');

    const elifNotifications = await p.notifications.list('u_elif');
    const alert = elifNotifications.find((n) => n.type === 'trip_overdue');
    expect(alert).toBeDefined();
    expect(alert?.senderId).toBe(CURRENT_USER_ID);
    expect(alert?.targetId).toBe('rp_active');
    expect(alert?.message).toContain('Kaçkar zirve günü');

    // İkinci çağrı aynı planı tekrar işaretlemez
    expect(await p.destinations.checkOverdue(CURRENT_USER_ID, later)).toEqual([]);
  });

  it('destinasyon acil merkezleri ana listeye eklenir (HRA Pheriche EBC yakınında)', async () => {
    const p = make();
    const near = await p.emergency.centers({ latitude: 27.8956, longitude: 86.8194 }, 3);
    expect(near[0]?.id).toBe('dec_hra_pheriche');
  });
});
