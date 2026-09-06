import {
  applyVote,
  buildChatItems,
  canManageGroup,
  canPost,
  decodeSystemMessage,
  encodeSystemMessage,
  extractMentions,
  filterGroups,
  generateInviteCode,
  groupMessagesByDay,
  INVITE_CODE_LENGTH,
  mentionsMe,
  normalizeInviteCode,
  pollPercentages,
  previewText,
  shouldGroupWithPrevious,
  sortByActivity,
  systemMessage,
  unreadCount,
  type Group,
  type GroupMember,
  type GroupMessage,
} from '@/domain';

const iso = (minutesAgo: number) =>
  new Date(Date.UTC(2026, 8, 6, 12, 0) - minutesAgo * 60_000).toISOString();

const group = (patch: Partial<Group> = {}): Group => ({
  id: 'g1',
  name: 'Kaçkar ekibi',
  kind: 'group',
  privacy: 'private',
  description: 'Ağustos zirve planı',
  avatarUrl: null,
  adventureTypes: ['hiking'],
  city: 'Rize',
  countryCode: 'TR',
  ownerId: 'u_elif',
  memberCount: 3,
  inviteCode: 'ABCDEFGH',
  pinnedMessageId: null,
  clubId: null,
  createdAt: iso(10_000),
  lastMessageAt: iso(5),
  ...patch,
});

const message = (patch: Partial<GroupMessage> = {}): GroupMessage => ({
  id: 'm1',
  groupId: 'g1',
  senderId: 'u_elif',
  type: 'text',
  text: 'Merhaba',
  imageUrl: null,
  coords: null,
  routeId: null,
  poll: null,
  replyToId: null,
  createdAt: iso(5),
  editedAt: null,
  ...patch,
});

const member = (patch: Partial<GroupMember> = {}): GroupMember => ({
  groupId: 'g1',
  userId: 'u_me',
  role: 'member',
  joinedAt: iso(1000),
  muted: false,
  lastReadAt: null,
  ...patch,
});

describe('generateInviteCode', () => {
  it('8 karakter, karışmayan alfabe ve deterministik', () => {
    const a = generateInviteCode('g_kackar');
    expect(a).toHaveLength(INVITE_CODE_LENGTH);
    expect(a).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(a).not.toMatch(/[01OIL]/);
    expect(generateInviteCode('g_kackar')).toBe(a);
    expect(generateInviteCode('g_other')).not.toBe(a);
  });

  it('normalizeInviteCode boşluk/tire temizler ve büyütür', () => {
    expect(normalizeInviteCode(' ab-cd ef gh ')).toBe('ABCDEFGH');
  });
});

describe('applyVote', () => {
  const poll = {
    question: 'Gün?',
    multi: false,
    options: [
      { id: 'o1', text: 'Cuma', votes: 2 },
      { id: 'o2', text: 'Cumartesi', votes: 1 },
    ],
  };

  it('tekli: yeni oy ekler, önceki oyu düşer', () => {
    const first = applyVote(poll, null, ['o1']);
    expect(first.vote).toEqual(['o1']);
    expect(first.poll.options.map((o) => o.votes)).toEqual([3, 1]);
    const switched = applyVote(first.poll, first.vote, ['o2']);
    expect(switched.vote).toEqual(['o2']);
    expect(switched.poll.options.map((o) => o.votes)).toEqual([2, 2]);
  });

  it('tekli ankette yalnızca ilk seçenek alınır', () => {
    const r = applyVote(poll, null, ['o2', 'o1']);
    expect(r.vote).toEqual(['o2']);
    expect(r.poll.options.map((o) => o.votes)).toEqual([2, 2]);
  });

  it('çoklu: birden fazla seçenek ve kısmi değişiklik', () => {
    const multi = { ...poll, multi: true };
    const r1 = applyVote(multi, null, ['o1', 'o2']);
    expect(r1.vote).toEqual(['o1', 'o2']);
    expect(r1.poll.options.map((o) => o.votes)).toEqual([3, 2]);
    const r2 = applyVote(r1.poll, r1.vote, ['o2']);
    expect(r2.vote).toEqual(['o2']);
    expect(r2.poll.options.map((o) => o.votes)).toEqual([2, 2]);
  });

  it('aynı seçim tekrar gönderilirse oy geri alınır', () => {
    const r = applyVote(poll, ['o1'], ['o1']);
    expect(r.vote).toBeNull();
    expect(r.poll.options.map((o) => o.votes)).toEqual([1, 1]);
  });

  it('geçersiz seçenekleri yok sayar ve sayaç negatife düşmez', () => {
    const r = applyVote(poll, ['zzz'], ['nope']);
    expect(r.vote).toBeNull();
    expect(r.poll.options.map((o) => o.votes)).toEqual([2, 1]);
  });

  it('pollPercentages toplam ve yüzde', () => {
    const { total, byOption } = pollPercentages(poll);
    expect(total).toBe(3);
    expect(byOption.o1).toBe(67);
    expect(byOption.o2).toBe(33);
    expect(pollPercentages({ ...poll, options: [] }).total).toBe(0);
  });
});

describe('unreadCount', () => {
  const messages = [
    message({ id: 'a', senderId: 'u_elif', createdAt: iso(30) }),
    message({ id: 'b', senderId: 'u_me', createdAt: iso(20) }),
    message({ id: 'c', senderId: 'u_can', createdAt: iso(10) }),
    message({ id: 'd', senderId: 'u_can', createdAt: iso(5), groupId: 'g2' }),
  ];

  it('lastReadAt sonrası, kendi mesajları hariç', () => {
    expect(unreadCount(messages, member({ lastReadAt: iso(25) }))).toBe(1);
    expect(unreadCount(messages, member({ lastReadAt: null }))).toBe(2);
    expect(unreadCount(messages, member({ lastReadAt: iso(0) }))).toBe(0);
  });

  it('üye değilse ya da davet bekliyorsa 0', () => {
    expect(unreadCount(messages, null)).toBe(0);
    expect(unreadCount(messages, member({ joinedAt: '' }))).toBe(0);
  });
});

describe('canPost / canManageGroup', () => {
  it('kanalda yalnızca admin/owner yazabilir', () => {
    const channel = group({ kind: 'channel' });
    expect(canPost(channel, 'member')).toBe(false);
    expect(canPost(channel, 'admin')).toBe(true);
    expect(canPost(channel, 'owner')).toBe(true);
    expect(canPost(channel, null)).toBe(false);
  });

  it('grupta her üye yazabilir, üye olmayan yazamaz', () => {
    const g = group();
    expect(canPost(g, 'member')).toBe(true);
    expect(canPost(g, null)).toBe(false);
  });

  it('yönetim admin/owner', () => {
    expect(canManageGroup('member')).toBe(false);
    expect(canManageGroup('admin')).toBe(true);
    expect(canManageGroup('owner')).toBe(true);
    expect(canManageGroup(null)).toBe(false);
  });
});

describe('shouldGroupWithPrevious', () => {
  it('aynı gönderen ve 5 dk içinde → gruplanır', () => {
    const prev = message({ createdAt: iso(4) });
    const cur = message({ id: 'm2', createdAt: iso(1) });
    expect(shouldGroupWithPrevious(prev, cur)).toBe(true);
  });

  it('farklı gönderen, 5 dk aşımı ya da sistem mesajı → gruplanmaz', () => {
    const prev = message({ createdAt: iso(4) });
    expect(
      shouldGroupWithPrevious(prev, message({ id: 'x', senderId: 'u_can', createdAt: iso(1) })),
    ).toBe(false);
    expect(
      shouldGroupWithPrevious(
        message({ createdAt: iso(10) }),
        message({ id: 'x', createdAt: iso(1) }),
      ),
    ).toBe(false);
    expect(
      shouldGroupWithPrevious(message({ type: 'system' }), message({ id: 'x', createdAt: iso(1) })),
    ).toBe(false);
    expect(shouldGroupWithPrevious(null, message())).toBe(false);
  });
});

describe('gün ayraçları', () => {
  const day1 = new Date(2026, 8, 1, 10, 0).toISOString();
  const day1b = new Date(2026, 8, 1, 10, 2).toISOString();
  const day2 = new Date(2026, 8, 2, 9, 0).toISOString();

  it('groupMessagesByDay eski→yeni ve güne göre gruplar', () => {
    const days = groupMessagesByDay([
      message({ id: 'c', createdAt: day2 }),
      message({ id: 'a', createdAt: day1 }),
      message({ id: 'b', createdAt: day1b }),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0]?.messages.map((m) => m.id)).toEqual(['a', 'b']);
    expect(days[1]?.messages.map((m) => m.id)).toEqual(['c']);
  });

  it('buildChatItems ters liste: en yeni önce, ayraç günün mesajlarından sonra', () => {
    const items = buildChatItems([
      message({ id: 'a', createdAt: day1 }),
      message({ id: 'b', createdAt: day1b }),
      message({ id: 'c', createdAt: day2, senderId: 'u_can' }),
    ]);
    expect(items.map((i) => i.key)).toEqual(['day-2026-09-02', 'c', 'day-2026-09-01', 'b', 'a']);
    const b = items.find((i) => i.key === 'b');
    expect(b?.kind === 'message' && b.grouped).toBe(true);
    const a = items.find((i) => i.key === 'a');
    expect(a?.kind === 'message' && a.grouped).toBe(false);
  });
});

describe('filterGroups', () => {
  const groups = [
    group({ id: 'g1', name: 'Kaçkar ekibi', kind: 'group', adventureTypes: ['hiking'] }),
    group({
      id: 'g2',
      name: 'Zirve Duyurular',
      kind: 'channel',
      adventureTypes: ['skiing'],
      city: null,
    }),
    group({
      id: 'g3',
      name: 'Antalya Tırmanış',
      kind: 'group',
      adventureTypes: ['climbing'],
      city: 'Antalya',
    }),
  ];
  const memberships = [member({ groupId: 'g1' }), member({ groupId: 'g3', joinedAt: '' })];

  it('mineOnly bekleyen davetleri saymaz', () => {
    expect(filterGroups(groups, { mineOnly: true }, memberships).map((g) => g.id)).toEqual(['g1']);
  });

  it('tür, macera türü ve arama', () => {
    expect(filterGroups(groups, { kind: 'channel' }, []).map((g) => g.id)).toEqual(['g2']);
    expect(filterGroups(groups, { adventureType: 'climbing' }, []).map((g) => g.id)).toEqual([
      'g3',
    ]);
    expect(filterGroups(groups, { query: 'antalya' }, []).map((g) => g.id)).toEqual(['g3']);
    expect(filterGroups(groups, { query: 'KAÇKAR' }, []).map((g) => g.id)).toEqual(['g1']);
    expect(filterGroups(groups, {}, []).length).toBe(3);
  });
});

describe('sortByActivity', () => {
  it('son mesaja göre azalan; etkinliği olmayan sonda', () => {
    const sorted = sortByActivity([
      group({ id: 'old', lastMessageAt: iso(100) }),
      group({ id: 'none', lastMessageAt: null }),
      group({ id: 'new', lastMessageAt: iso(1) }),
    ]);
    expect(sorted.map((g) => g.id)).toEqual(['new', 'old', 'none']);
  });
});

describe('sistem mesajı ve önizleme', () => {
  it('encode/decode ve i18n anahtarı', () => {
    const text = encodeSystemMessage('joined', 'Elif Doğan');
    expect(decodeSystemMessage(text)).toEqual({ kind: 'joined', name: 'Elif Doğan' });
    expect(decodeSystemMessage('merhaba')).toBeNull();
    expect(systemMessage('pinned', 'Can')).toEqual({
      key: 'groups.system.pinned',
      params: { name: 'Can' },
    });
  });

  it('previewText türe göre etiket üretir', () => {
    expect(previewText(message({ text: 'Selam  ekip\n' }), 'tr')).toBe('Selam ekip');
    expect(previewText(message({ type: 'image', text: '', imageUrl: 'x' }), 'tr')).toBe(
      '📷 Fotoğraf',
    );
    expect(previewText(message({ type: 'location', text: '' }), 'en')).toBe('📍 Location');
    expect(
      previewText(
        message({ type: 'poll', text: '', poll: { question: 'Gün?', multi: false, options: [] } }),
        'tr',
      ),
    ).toBe('🗳 Anket: Gün?');
    expect(
      previewText(message({ type: 'system', text: encodeSystemMessage('left', 'Can') }), 'tr'),
    ).toBe('Can ayrıldı');
    expect(previewText(null, 'tr')).toBe('');
  });
});

describe('mentions', () => {
  const me = { username: 'deniz.kaya', displayName: 'Deniz Kaya' };
  it('kullanıcı adı ya da görünen ad ile etiket', () => {
    expect(mentionsMe(message({ text: 'Selam @deniz.kaya nasılsın' }), me)).toBe(true);
    expect(mentionsMe(message({ text: '@Deniz Kaya listeyi tutuyor mu' }), me)).toBe(true);
    expect(mentionsMe(message({ text: 'Herkese selam' }), me)).toBe(false);
    expect(mentionsMe(message({ type: 'system', text: '@deniz.kaya' }), me)).toBe(false);
  });
  it('extractMentions küçük harfe çevirir ve tekilleştirir', () => {
    expect(extractMentions('@Elif.Dogan ve @elif.dogan, @can_y')).toEqual(['elif.dogan', 'can_y']);
  });
});
