import type { ID, Notification, User } from '@/domain';

import { toUser } from './mappers';
import { maybeRow, rows, type Row, type SupabaseLike } from './postgrest';

/** Mock sağlayıcıdaki `NotFoundError` ile aynı sözleşme (aynı ileti biçimi). */
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} bulunamadı: ${id}`);
    this.name = 'NotFoundError';
  }
}

/** Mock sağlayıcıdaki `AuthError` ile aynı sözleşme. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Profil seçimi: acil kişiler ayrı tabloda tutulduğu için tek istekte
 * gömülü olarak çekilir (N+1 sorgudan kaçınmak için hep bu sabit kullanılır).
 */
export const PROFILE_SELECT = '*, emergency_contacts!user_id(*)';

export interface RemoteContext {
  db: SupabaseLike;
  /** Şu anki oturum kullanıcısı (bilinmiyorsa null) — RPC'lerde `auth.uid()`. */
  sessionUserId(): ID | null;
  setSessionUserId(id: ID | null): void;
}

export function createRemoteContext(db: SupabaseLike): RemoteContext {
  let sessionUserId: ID | null = null;
  return {
    db,
    sessionUserId: () => sessionUserId,
    setSessionUserId: (id) => {
      sessionUserId = id;
    },
  };
}

/** Tek istekte birden çok profil; sıralama korunmaz, `Map` döner. */
export async function fetchUsers(db: SupabaseLike, ids: readonly ID[]): Promise<Map<ID, User>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return new Map();
  const data = await rows(
    db.from('profiles').select(PROFILE_SELECT).in('id', unique),
    'profiller okunamadı',
  );
  return new Map(data.map((row) => [String(row.id), toUser(row)]));
}

export async function fetchUser(db: SupabaseLike, id: ID): Promise<User | null> {
  const row = await maybeRow(
    db.from('profiles').select(PROFILE_SELECT).eq('id', id),
    'profil okunamadı',
  );
  return row ? toUser(row) : null;
}

export async function requireUser(db: SupabaseLike, id: ID): Promise<User> {
  const user = await fetchUser(db, id);
  if (!user) throw new NotFoundError('Kullanıcı', id);
  return user;
}

/** `Map`'ten kullanıcı çeker; yoksa hata. */
export function pickUser(map: Map<ID, User>, id: ID): User {
  const user = map.get(id);
  if (!user) throw new NotFoundError('Kullanıcı', id);
  return user;
}

export type NotificationInput = Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'targetId'> & {
  targetId?: ID | null;
};

/**
 * Bildirim yazar. Mock'taki `pushNotification` ile aynı kural:
 * kişi kendine bildirim göndermez.
 */
export async function notify(db: SupabaseLike, input: NotificationInput): Promise<void> {
  if (input.senderId === input.receiverId) return;
  await rows(
    db.from('notifications').insert({
      type: input.type,
      sender_id: input.senderId,
      receiver_id: input.receiverId,
      message: input.message,
      post_id: input.postId,
      match_id: input.matchId,
      target_id: input.targetId ?? null,
    }),
    'bildirim yazılamadı',
  );
}

/** Birden çok alıcıya tek istekte bildirim. */
export async function notifyMany(
  db: SupabaseLike,
  receivers: readonly ID[],
  input: Omit<NotificationInput, 'receiverId'>,
): Promise<void> {
  const targets = Array.from(new Set(receivers)).filter((id) => id && id !== input.senderId);
  if (!targets.length) return;
  const payload: Row[] = targets.map((receiverId) => ({
    type: input.type,
    sender_id: input.senderId,
    receiver_id: receiverId,
    message: input.message,
    post_id: input.postId,
    match_id: input.matchId,
    target_id: input.targetId ?? null,
  }));
  await rows(db.from('notifications').insert(payload), 'bildirimler yazılamadı');
}

/** Takipçi kimlikleri (bildirim dağıtımı için). */
export async function followerIds(db: SupabaseLike, userId: ID): Promise<ID[]> {
  const data = await rows(
    db.from('follows').select('follower_id').eq('following_id', userId),
    'takipçiler okunamadı',
  );
  return data.map((row) => String(row.follower_id));
}
