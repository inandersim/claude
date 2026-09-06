import type { GroupRole } from './enums';
import type { Group, GroupFilter, GroupMember, GroupMessage, ID, PollOption, User } from './types';

/**
 * Gruplar & kanallar — saf iş mantığı.
 *
 * Bekleyen davetler `GroupMember` tablosuna `joinedAt: ''` ile yazılır
 * (bkz. `PENDING_INVITE`): davet edilen kişi `join` çağırınca kayıt tamamlanır,
 * üye sayısına dahil edilir. Bekleyen kayıtlar üyelik/okunmamış hesaplarında sayılmaz.
 */

export const PENDING_INVITE = '' as const;

/** Sistem mesajı türleri (i18n anahtarı `groups.system.<kind>`). */
export const SYSTEM_MESSAGE_KINDS = ['joined', 'left', 'pinned', 'created'] as const;
export type SystemMessageKind = (typeof SYSTEM_MESSAGE_KINDS)[number];

/** Ekranın çizdiği sohbet öğesi: gün ayracı ya da (gruplanmış) mesaj. */
export type ChatItem<T extends GroupMessage = GroupMessage> =
  | { kind: 'day'; key: string; date: string }
  | { kind: 'message'; key: string; message: T; grouped: boolean };

/** Karışan harfler (0/O, 1/I/L) çıkarılmış alfabe. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;
const GROUPING_WINDOW_MS = 5 * 60_000;

/** Aynı tohumdan her zaman aynı 8 karakterlik davet kodunu üretir (FNV-1a + xorshift). */
export function generateInviteCode(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let x = h || 0x9e3779b9;
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out += CODE_ALPHABET[x % CODE_ALPHABET.length];
  }
  return out;
}

/** Davet kodunu normalize eder (boşluk/tire temizler, büyük harfe çevirir). */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

/** Bekleyen davet mi (henüz katılmamış)? */
export function isPendingInvite(member: GroupMember): boolean {
  return member.joinedAt === PENDING_INVITE;
}

/** Kullanıcının gruptaki etkin üyeliği (bekleyen davetler hariç). */
export function groupMembershipOf(
  members: GroupMember[],
  groupId: ID,
  userId: ID,
): GroupMember | null {
  return (
    members.find((m) => m.groupId === groupId && m.userId === userId && !isPendingInvite(m)) ?? null
  );
}

/**
 * Grupları filtreler. `memberships` giriş yapan kullanıcının üyelik kayıtlarıdır;
 * `mineOnly` yalnızca etkin üyeliği olan grupları bırakır.
 */
export function filterGroups<T extends Group>(
  groups: T[],
  filter: GroupFilter,
  memberships: GroupMember[],
): T[] {
  const q = (filter.query ?? '').trim().toLocaleLowerCase('tr-TR');
  const mine = new Set(memberships.filter((m) => !isPendingInvite(m)).map((m) => m.groupId));
  return groups.filter((g) => {
    if (filter.mineOnly && !mine.has(g.id)) return false;
    if (filter.kind && g.kind !== filter.kind) return false;
    if (filter.adventureType && !g.adventureTypes.includes(filter.adventureType)) return false;
    if (q) {
      const hay = `${g.name} ${g.description} ${g.city ?? ''}`.toLocaleLowerCase('tr-TR');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Son okumadan sonra gelen, kullanıcının kendisine ait olmayan mesaj sayısı. */
export function unreadCount(messages: GroupMessage[], member: GroupMember | null): number {
  if (!member || isPendingInvite(member)) return 0;
  const since = member.lastReadAt ? new Date(member.lastReadAt).getTime() : 0;
  return messages.filter(
    (m) =>
      m.groupId === member.groupId &&
      m.senderId !== member.userId &&
      new Date(m.createdAt).getTime() > since,
  ).length;
}

/** Kanalda yalnızca yönetici/sahip yazabilir; grupta her üye. */
export function canPost(group: Pick<Group, 'kind'>, role: GroupRole | null): boolean {
  if (!role) return false;
  if (group.kind === 'channel') return role === 'admin' || role === 'owner';
  return true;
}

export function canManageGroup(role: GroupRole | null): boolean {
  return role === 'admin' || role === 'owner';
}

export interface PollState {
  question: string;
  options: PollOption[];
  multi: boolean;
}

/**
 * Oyu uygular: önceki oy(lar) düşülür, yeni seçenekler eklenir. Tekli ankette
 * yalnızca ilk seçenek alınır; aynı seçim tekrar gönderilirse oy geri çekilir.
 * Yeni anket nesnesi ve kullanıcının güncel oyu döner.
 */
export function applyVote(
  poll: PollState,
  prevVote: ID[] | null,
  optionIds: ID[],
  multi: boolean = poll.multi,
): { poll: PollState; vote: ID[] | null } {
  const valid = new Set(poll.options.map((o) => o.id));
  const requested = optionIds.filter((id) => valid.has(id));
  const next = multi ? Array.from(new Set(requested)) : requested.slice(0, 1);
  const prev = (prevVote ?? []).filter((id) => valid.has(id));
  const same = next.length === prev.length && next.every((id) => prev.includes(id));
  const target = same ? [] : next;

  const options = poll.options.map((o) => {
    let votes = o.votes;
    if (prev.includes(o.id)) votes -= 1;
    if (target.includes(o.id)) votes += 1;
    return { ...o, votes: Math.max(0, votes) };
  });
  return { poll: { ...poll, options }, vote: target.length ? target : null };
}

/** Seçenek başına yüzde (0–100, tam sayı) ve toplam oy. */
export function pollPercentages(poll: PollState): { total: number; byOption: Record<ID, number> } {
  const total = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const byOption: Record<ID, number> = {};
  for (const o of poll.options) {
    byOption[o.id] = total === 0 ? 0 : Math.round((o.votes / total) * 100);
  }
  return { total, byOption };
}

/** Yerel takvim gününü YYYY-MM-DD olarak döner. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Aynı gönderen, sistem mesajı değil ve 5 dakika içinde → avatar/isim gizlenir. */
export function shouldGroupWithPrevious(
  prev: GroupMessage | null | undefined,
  cur: GroupMessage,
): boolean {
  if (!prev) return false;
  if (prev.type === 'system' || cur.type === 'system') return false;
  if (prev.senderId !== cur.senderId) return false;
  if (dayKey(prev.createdAt) !== dayKey(cur.createdAt)) return false;
  const delta = new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return delta >= 0 && delta <= GROUPING_WINDOW_MS;
}

/** Mesajları güne göre gruplar (eski → yeni). */
export function groupMessagesByDay<T extends GroupMessage>(
  messages: T[],
): { day: string; messages: T[] }[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const out: { day: string; messages: T[] }[] = [];
  for (const m of sorted) {
    const key = dayKey(m.createdAt);
    const last = out[out.length - 1];
    if (last && last.day === key) last.messages.push(m);
    else out.push({ day: key, messages: [m] });
  }
  return out;
}

/**
 * Ters çevrilmiş (inverted) FlatList için öğe listesi: en yeni mesaj başta,
 * her günün ayracı o günün mesajlarından **sonra** gelir (ekranda üstte görünür).
 */
export function buildChatItems<T extends GroupMessage>(messages: T[]): ChatItem<T>[] {
  const items: ChatItem<T>[] = [];
  for (const day of groupMessagesByDay(messages)) {
    day.messages.forEach((m, i) => {
      items.push({
        kind: 'message',
        key: m.id,
        message: m,
        grouped: shouldGroupWithPrevious(day.messages[i - 1], m),
      });
    });
    const first = day.messages[0];
    if (first) items.push({ kind: 'day', key: `day-${day.day}`, date: first.createdAt });
  }
  return items.reverse();
}

const SYSTEM_PREFIX = 'sys:';

/** Sistem mesajının i18n anahtarı ve parametresi. */
export function systemMessage(
  kind: SystemMessageKind,
  name: string,
): { key: `groups.system.${SystemMessageKind}`; params: { name: string } } {
  return { key: `groups.system.${kind}`, params: { name } };
}

/** Sistem mesajını `text` alanında saklanacak biçime çevirir. */
export function encodeSystemMessage(kind: SystemMessageKind, name: string): string {
  return `${SYSTEM_PREFIX}${kind}:${name}`;
}

/** `text` alanındaki sistem mesajını çözer; biçim tanınmazsa `null`. */
export function decodeSystemMessage(
  text: string,
): { kind: SystemMessageKind; name: string } | null {
  if (!text.startsWith(SYSTEM_PREFIX)) return null;
  const rest = text.slice(SYSTEM_PREFIX.length);
  const idx = rest.indexOf(':');
  const kind = (idx === -1 ? rest : rest.slice(0, idx)) as SystemMessageKind;
  if (!SYSTEM_MESSAGE_KINDS.includes(kind)) return null;
  return { kind, name: idx === -1 ? '' : rest.slice(idx + 1) };
}

const PREVIEW_LABELS: Record<
  'tr' | 'en',
  Record<'image' | 'location' | 'route' | 'poll', string> & Record<SystemMessageKind, string>
> = {
  tr: {
    image: '📷 Fotoğraf',
    location: '📍 Konum',
    route: '🗺 Rota',
    poll: '🗳 Anket',
    joined: '{{name}} katıldı',
    left: '{{name}} ayrıldı',
    pinned: '{{name}} bir mesajı sabitledi',
    created: '{{name}} grubu oluşturdu',
  },
  en: {
    image: '📷 Photo',
    location: '📍 Location',
    route: '🗺 Route',
    poll: '🗳 Poll',
    joined: '{{name}} joined',
    left: '{{name}} left',
    pinned: '{{name}} pinned a message',
    created: '{{name}} created the group',
  },
};

/** Liste önizlemesi: metin ya da tür etiketi (📷 Fotoğraf, 📍 Konum, 🗳 Anket…). */
export function previewText(message: GroupMessage | null, locale: string): string {
  if (!message) return '';
  const labels = PREVIEW_LABELS[locale === 'tr' ? 'tr' : 'en'];
  switch (message.type) {
    case 'text':
      return message.text.replace(/\s+/g, ' ').trim();
    case 'image':
      return message.text ? `${labels.image} · ${message.text}` : labels.image;
    case 'location':
      return message.text ? `${labels.location} · ${message.text}` : labels.location;
    case 'route':
      return message.text ? `${labels.route} · ${message.text}` : labels.route;
    case 'poll':
      return message.poll ? `${labels.poll}: ${message.poll.question}` : labels.poll;
    case 'system': {
      const sys = decodeSystemMessage(message.text);
      return sys ? labels[sys.kind].replace('{{name}}', sys.name) : message.text;
    }
    default:
      return message.text;
  }
}

/** Son etkinliğe göre azalan; etkinliği olmayanlar sonda (oluşturulma tarihine göre). */
export function sortByActivity<T extends Group>(groups: T[]): T[] {
  const stamp = (g: Group) => new Date(g.lastMessageAt ?? g.createdAt).getTime();
  return [...groups].sort((a, b) => {
    if (a.lastMessageAt && !b.lastMessageAt) return -1;
    if (!a.lastMessageAt && b.lastMessageAt) return 1;
    return stamp(b) - stamp(a);
  });
}

/** Metinde `@kullanıcıadı` ya da `@Ad Soyad` geçiyor mu? */
export function mentionsMe(
  message: Pick<GroupMessage, 'text' | 'type'>,
  me: Pick<User, 'username' | 'displayName'>,
): boolean {
  if (message.type === 'system' || !message.text) return false;
  const text = message.text.toLocaleLowerCase('tr-TR');
  const handles = [me.username, me.displayName]
    .filter(Boolean)
    .map((h) => `@${h.toLocaleLowerCase('tr-TR')}`);
  return handles.some((h) => text.includes(h));
}

/** Metinde geçen `@kullanıcıadı` etiketlerini (küçük harf) döner. */
export function extractMentions(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/@([\p{L}\p{N}._-]+)/gu)) {
    const handle = m[1];
    if (handle) out.add(handle.toLocaleLowerCase('tr-TR'));
  }
  return Array.from(out);
}

/** Gönderen adı için kararlı renk seçimi (aynı kullanıcı → aynı renk). */
export function senderColorIndex(userId: ID, paletteSize: number): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return paletteSize === 0 ? 0 : h % paletteSize;
}

/** Rol öncelik sırası (sahip → yönetici → üye). */
export function roleRank(role: GroupRole): number {
  return role === 'owner' ? 0 : role === 'admin' ? 1 : 2;
}
