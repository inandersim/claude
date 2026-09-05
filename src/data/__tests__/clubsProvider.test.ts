import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });

describe('Clubs', () => {
  it('liste, üyelik durumu ve kulüplerim', async () => {
    const p = make();
    const all = await p.clubs.list(CURRENT_USER_ID, {});
    expect(all).toHaveLength(14);
    const itu = all.find((c) => c.id === 'c_itu');
    expect(itu?.membership).toBe('member');
    expect(itu?.role).toBe('member');
    expect(itu?.upcomingEventCount).toBeGreaterThan(0);
    const mine = await p.clubs.myClubs(CURRENT_USER_ID);
    expect(mine.map((c) => c.id)).toEqual(['c_itu']);
    const ankara = await p.clubs.list(CURRENT_USER_ID, { city: 'Ankara' });
    expect(ankara.every((c) => c.city === 'Ankara')).toBe(true);
  });

  it('doğrulanmış kulübe talep, doğrulanmamışa doğrudan üyelik; ayrılma', async () => {
    const p = make();
    const requested = await p.clubs.join(CURRENT_USER_ID, 'c_metu');
    expect(requested.membership).toBe('requested');
    expect(requested.memberCount).toBe(412);
    await expect(p.clubs.join(CURRENT_USER_ID, 'c_metu')).rejects.toThrow();

    const joined = await p.clubs.join(CURRENT_USER_ID, 'c_ktu');
    expect(joined.membership).toBe('member');
    expect(joined.memberCount).toBe(159);

    const left = await p.clubs.leave(CURRENT_USER_ID, 'c_ktu');
    expect(left.membership).toBe('none');
    expect(left.memberCount).toBe(158);

    // Talep geri çekilince üye sayısı değişmez
    const withdrawn = await p.clubs.leave(CURRENT_USER_ID, 'c_metu');
    expect(withdrawn.membership).toBe('none');
    expect(withdrawn.memberCount).toBe(412);
    // Bekleyen talepler üye listesinde görünmez
    const members = await p.clubs.members('c_metu');
    expect(members.some((m) => m.id === 'u_nil')).toBe(false);
    expect(members[0]?.role).toBe('president');
  });

  it('RSVP toggle ve kurallar', async () => {
    const p = make();
    const before = await p.clubs.event(CURRENT_USER_ID, 'ce_itu_belgrad');
    expect(before?.rsvped).toBe(false);
    const on = await p.clubs.rsvp(CURRENT_USER_ID, 'ce_itu_belgrad');
    expect(on.rsvped).toBe(true);
    expect(on.attendeeCount).toBe((before?.attendeeCount ?? 0) + 1);
    const off = await p.clubs.rsvp(CURRENT_USER_ID, 'ce_itu_belgrad');
    expect(off.rsvped).toBe(false);
    expect(off.attendeeCount).toBe(before?.attendeeCount);
    // Üye olunmayan kulübün yalnızca üyelere açık etkinliği
    await expect(p.clubs.rsvp(CURRENT_USER_ID, 'ce_metu_aladaglar')).rejects.toThrow();
    // Dolu etkinlik
    await expect(p.clubs.rsvp(CURRENT_USER_ID, 'ce_akdeniz_geyik')).rejects.toThrow();
    // Geçmiş etkinlik
    await expect(p.clubs.rsvp(CURRENT_USER_ID, 'ce_metu_eymir_past')).rejects.toThrow();
  });

  it('etkinlik oluşturma yalnızca üyeler; oluşturan otomatik katılımcı', async () => {
    const p = make();
    const input = {
      clubId: 'c_itu',
      title: 'Test yürüyüşü',
      kind: 'trip' as const,
      adventureType: 'hiking' as const,
      description: '',
      locationName: 'Belgrad',
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      capacity: 10,
      openToAll: false,
      priceTry: 0,
    };
    const created = await p.clubs.createEvent(CURRENT_USER_ID, input);
    expect(created.rsvped).toBe(true);
    expect(created.attendeeCount).toBe(1);
    expect(created.club.id).toBe('c_itu');
    const events = await p.clubs.events(CURRENT_USER_ID, 'c_itu');
    expect(events.some((e) => e.id === created.id)).toBe(true);
    await expect(
      p.clubs.createEvent(CURRENT_USER_ID, { ...input, clubId: 'c_metu' }),
    ).rejects.toThrow();
  });

  it('sıralama ve öğrenci doğrulama', async () => {
    const p = make();
    const ranking = await p.clubs.ranking();
    expect(ranking[0]?.id).toBe('c_ethz');
    expect(ranking[1]?.id).toBe('c_metu');
    expect(await p.clubs.studentVerification(CURRENT_USER_ID)).toBeNull();
    await expect(p.clubs.verifyStudent(CURRENT_USER_ID, 'deniz@gmail.com')).rejects.toThrow();
    const v = await p.clubs.verifyStudent(CURRENT_USER_ID, 'Deniz.Kaya@itu.edu.tr');
    expect(v.university).toBe('İTÜ');
    expect(v.email).toBe('deniz.kaya@itu.edu.tr');
    expect(v.verifiedAt).not.toBeNull();
    expect((await p.clubs.studentVerification(CURRENT_USER_ID))?.university).toBe('İTÜ');
  });
});
