import type { GroupMessageWithSender, ID, LocationShareWithUser, NotificationWithSender, StreamMessageWithAuthor } from '@/domain';

import { PROFILE_SELECT, fetchUser } from './context';
import { toGroupMessage, toLocationShare, toNotification, toStreamMessage, toUser } from './mappers';
import { maybeRow, type RealtimeChannelLike, type Row, type SupabaseLike } from './postgrest';

/**
 * Realtime abonelikleri — mock sağlayıcıdaki periyodik sorgulamanın (polling)
 * yerini alır.
 *
 * `supabase/migrations/0300_realtime_storage.sql` şu tabloları
 * `supabase_realtime` yayınına ekler: `group_messages`, `stream_messages`,
 * `location_shares`, `notifications`, `messages`, `sos_sessions`, `hazards`.
 *
 * Kullanım (ekran tarafında):
 * ```ts
 * const stop = subscribeGroupMessages(client, groupId, (m) => append(m));
 * return () => { void stop(); };
 * ```
 * Geri dönen fonksiyon aboneliği kapatır; `useEffect` temizliğinde çağrılmalıdır.
 */

export type Unsubscribe = () => Promise<void>;

/** Abonelik kurulamadığında (ör. istemci realtime desteklemiyorsa) boş kapatıcı. */
const NOOP: Unsubscribe = async () => undefined;

function open(
  client: SupabaseLike,
  name: string,
  table: string,
  filter: string | null,
  event: 'INSERT' | 'UPDATE' | '*',
  handler: (row: Row) => void | Promise<void>,
): Unsubscribe {
  if (typeof client.channel !== 'function') return NOOP;
  const channel: RealtimeChannelLike = client
    .channel(name)
    .on(
      'postgres_changes',
      { event, schema: 'public', table, ...(filter ? { filter } : {}) },
      (payload) => {
        void handler(payload.new ?? {});
      },
    )
    .subscribe();
  return async () => {
    if (typeof client.removeChannel === 'function') client.removeChannel(channel);
    else await channel.unsubscribe();
  };
}

/** Grup sohbeti: yeni mesajlar (gönderen profili ayrı bir istekle çözülür). */
export function subscribeGroupMessages(
  client: SupabaseLike,
  groupId: ID,
  onMessage: (message: GroupMessageWithSender) => void,
): Unsubscribe {
  return open(
    client,
    `group:${groupId}`,
    'group_messages',
    `group_id=eq.${groupId}`,
    'INSERT',
    async (row) => {
      const message = toGroupMessage(row);
      const sender = await fetchUser(client, message.senderId);
      if (!sender) return;
      onMessage({ ...message, sender, myVote: null, replyTo: null });
    },
  );
}

/** Yayın sohbeti: yeni mesajlar. */
export function subscribeStreamMessages(
  client: SupabaseLike,
  streamId: ID,
  onMessage: (message: StreamMessageWithAuthor) => void,
): Unsubscribe {
  return open(
    client,
    `stream:${streamId}`,
    'stream_messages',
    `stream_id=eq.${streamId}`,
    'INSERT',
    async (row) => {
      const message = toStreamMessage(row);
      const author = await fetchUser(client, message.authorId);
      if (!author) return;
      onMessage({ ...message, author });
    },
  );
}

/**
 * Canlı konum: paylaşım eklendiğinde/güncellendiğinde tetiklenir.
 * RLS yalnızca görme yetkisi olan satırları yayınlar.
 */
export function subscribeLocationShares(
  client: SupabaseLike,
  onShare: (share: LocationShareWithUser) => void,
): Unsubscribe {
  return open(client, 'presence', 'location_shares', null, '*', async (row) => {
    const share = toLocationShare(row);
    const user = await fetchUser(client, share.userId);
    if (!user) return;
    onShare({ ...share, user, distanceKm: null, isStale: false });
  });
}

/** Bildirimler: yalnızca bana gelenler. */
export function subscribeNotifications(
  client: SupabaseLike,
  meId: ID,
  onNotification: (notification: NotificationWithSender) => void,
): Unsubscribe {
  return open(
    client,
    `notifications:${meId}`,
    'notifications',
    `receiver_id=eq.${meId}`,
    'INSERT',
    async (row) => {
      const notification = toNotification(row);
      const sender = await maybeRow(
        client.from('profiles').select(PROFILE_SELECT).eq('id', notification.senderId),
        'gönderen okunamadı',
      );
      if (!sender) return;
      onNotification({ ...notification, sender: toUser(sender) });
    },
  );
}

/** Birebir mesajlar: bana gelenler. */
export function subscribeDirectMessages(
  client: SupabaseLike,
  meId: ID,
  onMessage: (row: Row) => void,
): Unsubscribe {
  return open(client, `dm:${meId}`, 'messages', `receiver_id=eq.${meId}`, 'INSERT', onMessage);
}

/** Tehlike bölgeleri: yeni bildirim ve durum değişiklikleri. */
export function subscribeHazards(client: SupabaseLike, onChange: (row: Row) => void): Unsubscribe {
  return open(client, 'hazards', 'hazards', null, '*', onChange);
}

/** Uydu SOS oturumu: aşama değişiklikleri. */
export function subscribeSosSession(
  client: SupabaseLike,
  sessionId: ID,
  onChange: (row: Row) => void,
): Unsubscribe {
  return open(client, `sos:${sessionId}`, 'sos_sessions', `id=eq.${sessionId}`, '*', onChange);
}
