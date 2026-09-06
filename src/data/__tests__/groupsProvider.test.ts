import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const make = () => createMockProvider({ persist: false, latencyMs: 0 });

describe('Groups', () => {
  it('liste: üye olduklarım aktiviteye göre önce, okunmamış ve son mesaj', async () => {
    const p = make();
    const all = await p.groups.list(CURRENT_USER_ID, {});
    expect(all).toHaveLength(12);
    const mine = all.filter((g) => g.membership !== null);
    expect(mine.map((g) => g.id).sort()).toEqual([
      'g_ebc',
      'g_ist_hike',
      'g_kackar',
      'g_zirtan_news',
    ]);
    // Üyelikler listenin başında
    expect(all.slice(0, mine.length).every((g) => g.membership !== null)).toBe(true);
    // Aktiviteye göre azalan
    for (let i = 1; i < mine.length; i++) {
      expect(
        new Date(mine[i - 1]?.lastMessageAt ?? 0) >= new Date(mine[i]?.lastMessageAt ?? 0),
      ).toBe(true);
    }
    const kackar = all.find((g) => g.id === 'g_kackar');
    expect(kackar?.membership).toBe('admin');
    expect(kackar?.unreadCount).toBeGreaterThan(0);
    expect(kackar?.lastMessage?.senderId).toBe('u_baris');
    // Bekleyen davet üyelik sayılmaz
    expect(all.find((g) => g.id === 'g_metu')?.membership).toBeNull();
    const onlyMine = await p.groups.list(CURRENT_USER_ID, { mineOnly: true });
    expect(onlyMine).toHaveLength(4);
    const channels = await p.groups.list(CURRENT_USER_ID, { kind: 'channel' });
    expect(channels.every((g) => g.kind === 'channel')).toBe(true);
  });

  it('özel gruba davetsiz katılım hata; davetli katılabilir; kodla katılım', async () => {
    const p = make();
    await expect(p.groups.join(CURRENT_USER_ID, 'g_ebc_x')).rejects.toThrow();
    await expect(p.groups.join(CURRENT_USER_ID, 'g_metu_private')).rejects.toThrow();
    // Bekleyen davet olan özel grup → join tamamlar
    const metu = await p.groups.join(CURRENT_USER_ID, 'g_metu');
    expect(metu.membership).toBe('member');
    expect(metu.memberCount).toBe(59);
    // Davetsiz özel grup
    const before = await p.groups.getById(CURRENT_USER_ID, 'g_kackar');
    const invited = await p.groups.create('u_elif', {
      name: 'Gizli ekip',
      kind: 'group',
      privacy: 'private',
      description: '',
      adventureTypes: [],
      city: null,
    });
    await expect(p.groups.join(CURRENT_USER_ID, invited.id)).rejects.toThrow(/davet kodu/i);
    // Kodla katıl
    const joined = await p.groups.joinByCode(
      CURRENT_USER_ID,
      ` ${invited.inviteCode.toLowerCase()} `,
    );
    expect(joined.membership).toBe('member');
    expect(joined.memberCount).toBe(2);
    await expect(p.groups.joinByCode(CURRENT_USER_ID, 'ZZZZZZZZ')).rejects.toThrow();
    expect(before?.membership).toBe('admin');
    // Açık gruba doğrudan katılım + sistem mesajı
    const pub = await p.groups.join(CURRENT_USER_ID, 'g_antalya_climb');
    expect(pub.membership).toBe('member');
    expect(pub.lastMessage?.type).toBe('system');
  });

  it('davet: bekleyen kayıt + bildirim; davetli join ile tamamlar', async () => {
    const p = make();
    await p.groups.invite('u_elif', 'g_kackar', 'u_nil');
    const membersBefore = await p.groups.members('g_kackar');
    expect(membersBefore.some((m) => m.id === 'u_nil')).toBe(false);
    const notifs = await p.notifications.list('u_nil');
    expect(notifs.some((n) => n.type === 'group_invite' && n.targetId === 'g_kackar')).toBe(true);
    const joined = await p.groups.join('u_nil', 'g_kackar');
    expect(joined.membership).toBe('member');
    const membersAfter = await p.groups.members('g_kackar');
    expect(membersAfter.some((m) => m.id === 'u_nil')).toBe(true);
    await expect(p.groups.invite('u_elif', 'g_kackar', 'u_nil')).rejects.toThrow();
  });

  it('mesaj gönderme okunmamışı artırır; markRead sıfırlar; kanal salt okunur', async () => {
    const p = make();
    const before = await p.groups.getById('u_can', 'g_kackar');
    const sent = await p.groups.send(CURRENT_USER_ID, 'g_kackar', {
      type: 'text',
      text: 'Test mesajı @can.yildirim',
      replyToId: 'gm_kackar_25',
    });
    expect(sent.sender.id).toBe(CURRENT_USER_ID);
    expect(sent.replyTo?.id).toBe('gm_kackar_25');
    const after = await p.groups.getById('u_can', 'g_kackar');
    expect(after?.unreadCount).toBe((before?.unreadCount ?? 0) + 1);
    // Kendi okunmamışım artmaz; markRead sonrası 0
    await p.groups.markRead(CURRENT_USER_ID, 'g_kackar');
    const mine = await p.groups.getById(CURRENT_USER_ID, 'g_kackar');
    expect(mine?.unreadCount).toBe(0);
    // Mention bildirimi yalnızca etiketlenene
    const canNotifs = await p.notifications.list('u_can');
    expect(canNotifs.some((n) => n.type === 'group_message' && n.targetId === 'g_kackar')).toBe(
      true,
    );
    const elifNotifs = await p.notifications.list('u_elif');
    expect(elifNotifs.some((n) => n.type === 'group_message' && n.targetId === 'g_kackar')).toBe(
      false,
    );
    // Kanalda üye yazamaz, yönetici yazabilir; sessize alan bildirim almaz
    await expect(
      p.groups.send(CURRENT_USER_ID, 'g_zirtan_news', { type: 'text', text: 'deneme' }),
    ).rejects.toThrow();
    await p.groups.send('u_can', 'g_zirtan_news', { type: 'text', text: 'Duyuru' });
    const meNotifs = await p.notifications.list(CURRENT_USER_ID);
    expect(meNotifs.some((n) => n.type === 'group_message' && n.targetId === 'g_zirtan_news')).toBe(
      true,
    );
    const mertNotifs = await p.notifications.list('u_mert');
    expect(
      mertNotifs.some((n) => n.type === 'group_message' && n.targetId === 'g_zirtan_news'),
    ).toBe(false);
    // Sayfalama: eski→yeni, `before` ile geriye
    const page = await p.groups.messages(CURRENT_USER_ID, 'g_kackar', null, 5);
    expect(page).toHaveLength(5);
    expect(new Date(page[0]?.createdAt ?? 0) < new Date(page[4]?.createdAt ?? 0)).toBe(true);
    const oldest = page[0]?.createdAt ?? null;
    const older = await p.groups.messages(CURRENT_USER_ID, 'g_kackar', oldest, 5);
    expect(older.every((m) => new Date(m.createdAt) < new Date(oldest ?? 0))).toBe(true);
  });

  it('anket oluşturma ve oylama', async () => {
    const p = make();
    const poll = await p.groups.send(CURRENT_USER_ID, 'g_kackar', {
      type: 'poll',
      text: '',
      poll: { question: 'Kahvaltı?', options: ['Menemen', 'Simit', ''], multi: false },
    });
    expect(poll.poll?.options).toHaveLength(2);
    expect(poll.myVote).toBeNull();
    const voted = await p.groups.vote(CURRENT_USER_ID, 'g_kackar', poll.id, ['o1']);
    expect(voted.myVote).toEqual(['o1']);
    expect(voted.poll?.options[0]?.votes).toBe(1);
    const switched = await p.groups.vote(CURRENT_USER_ID, 'g_kackar', poll.id, ['o2']);
    expect(switched.myVote).toEqual(['o2']);
    expect(switched.poll?.options.map((o) => o.votes)).toEqual([0, 1]);
    const retracted = await p.groups.vote(CURRENT_USER_ID, 'g_kackar', poll.id, ['o2']);
    expect(retracted.myVote).toBeNull();
    expect(retracted.poll?.options.map((o) => o.votes)).toEqual([0, 0]);
    // Seed anketindeki oyum
    const msgs = await p.groups.messages(CURRENT_USER_ID, 'g_kackar');
    const seeded = msgs.find((m) => m.id === 'gm_kackar_19');
    expect(seeded?.myVote).toEqual(['o2']);
    await expect(
      p.groups.send(CURRENT_USER_ID, 'g_kackar', {
        type: 'poll',
        text: '',
        poll: { question: 'X', options: ['tek'], multi: false },
      }),
    ).rejects.toThrow();
  });

  it('ayrılma: sahip ayrılamaz, üye ayrılır; sabitleme ve sessize alma', async () => {
    const p = make();
    await expect(p.groups.leave('u_elif', 'g_kackar')).rejects.toThrow();
    await p.groups.leave(CURRENT_USER_ID, 'g_ist_hike');
    const left = await p.groups.getById(CURRENT_USER_ID, 'g_ist_hike');
    expect(left?.membership).toBeNull();
    expect(left?.memberCount).toBe(339);
    expect(left?.lastMessage?.type).toBe('system');
    // Sabitleme: üye yapamaz, yönetici yapar
    await expect(p.groups.pin('u_can', 'g_kackar', 'gm_kackar_13')).rejects.toThrow();
    const pinned = await p.groups.pin(CURRENT_USER_ID, 'g_kackar', 'gm_kackar_13');
    expect(pinned.pinnedMessageId).toBe('gm_kackar_13');
    const unpinned = await p.groups.pin(CURRENT_USER_ID, 'g_kackar', null);
    expect(unpinned.pinnedMessageId).toBeNull();
    // Sessize al
    expect(await p.groups.toggleMute(CURRENT_USER_ID, 'g_kackar')).toBe(true);
    expect(await p.groups.toggleMute(CURRENT_USER_ID, 'g_kackar')).toBe(false);
    // Rol: yönetici üyeyi admin yapar; sahipliği yalnızca sahip devreder
    await p.groups.setRole(CURRENT_USER_ID, 'g_kackar', 'u_can', 'admin');
    const members = await p.groups.members('g_kackar');
    expect(members.find((m) => m.id === 'u_can')?.role).toBe('admin');
    expect(members[0]?.role).toBe('owner');
    await expect(p.groups.setRole(CURRENT_USER_ID, 'g_kackar', 'u_can', 'owner')).rejects.toThrow();
    await p.groups.setRole('u_elif', 'g_kackar', 'u_can', 'owner');
    const after = await p.groups.getById('u_elif', 'g_kackar');
    expect(after?.membership).toBe('admin');
    expect(after?.ownerId).toBe('u_can');
  });
});
