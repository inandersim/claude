import type { ID, Notification, User } from '@/domain';
import { yerelMedyaMi } from '@/domain/media';

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

/**
 * Cihazdaki bir dosyayı yükleyip **genel adresini** döner.
 *
 * Veri katmanı bunu bir arayüz olarak alır, kendi uygulamasını taşımaz:
 * gerçek uygulama küçültme ve EXIF temizleme için yerel bir modüle
 * (`expo-image-manipulator`) ihtiyaç duyar ve `src/features/media` altında
 * yaşar. Böylece bu katman test edilebilir kalır ve katman sırası bozulmaz.
 */
export type MedyaYukleyici = (girdi: {
  bucket: string;
  userId: ID;
  localUri: string;
}) => Promise<string>;

export interface RemoteContext {
  db: SupabaseLike;
  /** Şu anki oturum kullanıcısı (bilinmiyorsa null) — RPC'lerde `auth.uid()`. */
  sessionUserId(): ID | null;
  setSessionUserId(id: ID | null): void;
  /** Yerel medya yükleyici; tanımlı değilse yerel adresler olduğu gibi kalır. */
  medyaYukleyici: MedyaYukleyici | null;
  setMedyaYukleyici(fn: MedyaYukleyici | null): void;
}

export function createRemoteContext(db: SupabaseLike): RemoteContext {
  let sessionUserId: ID | null = null;
  const ctx: RemoteContext = {
    db,
    sessionUserId: () => sessionUserId,
    setSessionUserId: (id) => {
      sessionUserId = id;
    },
    medyaYukleyici: null,
    setMedyaYukleyici: (fn) => {
      ctx.medyaYukleyici = fn;
    },
  };
  return ctx;
}

/**
 * Yerel bir medya adresini yükleyip genel adrese çevirir.
 *
 * **Neden burada, ekranlarda değil:** aynı hata sekiz ayrı ekranda tekrar
 * ediyordu — seçilen fotoğrafın `file://…` adresi doğrudan veritabanına
 * yazılıyor, fotoğrafı gönderen dışında herkes kırık görsel görüyordu.
 * Kararı tek bir noktaya almak hem mevcut sekiz yolu birden düzeltir hem de
 * dokuzuncu ekranın aynı hatayı tekrarlamasını engeller.
 *
 * Yükleyici tanımlı değilse (testler, yükleme katmanı olmayan ortamlar)
 * adres olduğu gibi döner: bu katman sessizce çökmez.
 */
export async function medyaAdresi(
  ctx: RemoteContext,
  bucket: string,
  userId: ID,
  uri: string | null | undefined,
): Promise<string | null> {
  const v = uri?.trim();
  if (!v) return uri ?? null;
  if (!yerelMedyaMi(v)) return v;
  if (!ctx.medyaYukleyici) return v;
  return await ctx.medyaYukleyici({ bucket, userId, localUri: v });
}

/** Birden çok adres için `medyaAdresi`; boşlar elenir. */
export async function medyaAdresleri(
  ctx: RemoteContext,
  bucket: string,
  userId: ID,
  uris: readonly (string | null | undefined)[],
): Promise<string[]> {
  const out = await Promise.all(uris.map((u) => medyaAdresi(ctx, bucket, userId, u)));
  return out.filter((u): u is string => Boolean(u));
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
