/**
 * push-fanout — bildirimleri Expo Push ile cihazlara dağıtır.
 *
 * Çalışma biçimi: `notifications` tablosunda `pushed_at IS NULL` olan
 * satırları toplar, alıcıların `profiles.push_tokens` değerlerine
 * gönderir ve satırları damgalar.
 *
 * Tetikleme: pg_cron / Supabase Scheduled Function (dakikada bir) ya da
 * doğrudan çağrı (`{ "notificationIds": [...] }`).
 *
 *   supabase functions deploy push-fanout
 *   supabase secrets set ZIRTAN_CRON_SECRET=... EXPO_ACCESS_TOKEN=...
 */
import { handler, json, requireCronSecret, serviceClient } from '../_shared/supabase.ts';
import { sendExpoPush, type ExpoPushMessage } from '../_shared/push.ts';

const BATCH = 500;

/** Bildirim türü → başlık (i18n istemcide; burada kısa Türkçe başlık). */
const TITLES: Record<string, string> = {
  match_request: 'Yeni macera isteği',
  match_accepted: 'Eşleşme kabul edildi',
  message: 'Yeni mesaj',
  like: 'Gönderin beğenildi',
  comment: 'Yeni yorum',
  follow: 'Yeni takipçi',
  booking_request: 'Yeni ders talebi',
  booking_confirmed: 'Ders onaylandı',
  hazard_alert: 'Yakınında tehlike var',
  stream_live: 'Canlı yayın başladı',
  sos_alert: '🆘 ACİL DURUM',
  stay_request: 'Yeni konaklama talebi',
  stay_confirmed: 'Konaklama onaylandı',
  group_message: 'Grup mesajı',
  trip_overdue: '⚠️ Dönüş sözü gecikti',
  certificate_issued: 'Sertifikan hazır',
};

Deno.serve(handler(async (req) => {
  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = body.notificationIds;
  if (!ids) requireCronSecret(req); // toplu tarama yalnızca zamanlayıcıya açık

  const db = serviceClient();

  let query = db
    .from('notifications')
    .select('id, type, message, receiver_id, sender_id, post_id, target_id')
    .is('pushed_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (ids) query = query.in('id', ids);

  const { data: notifications, error } = await query;
  if (error) throw new Error(error.message);
  if (!notifications?.length) return json({ processed: 0, sent: 0 });

  const receiverIds = [...new Set(notifications.map((n) => n.receiver_id))];
  const { data: profiles } = await db
    .from('profiles')
    .select('id, push_tokens, locale')
    .in('id', receiverIds);

  const tokensByUser = new Map<string, string[]>(
    (profiles ?? []).map((p) => [p.id as string, (p.push_tokens as string[]) ?? []]),
  );

  const messages: ExpoPushMessage[] = [];
  for (const n of notifications) {
    for (const token of tokensByUser.get(n.receiver_id as string) ?? []) {
      messages.push({
        to: token,
        title: TITLES[n.type as string] ?? 'Zirtan',
        body: (n.message as string) || '',
        sound: 'default',
        priority: n.type === 'sos_alert' || n.type === 'trip_overdue' ? 'high' : 'default',
        channelId: n.type === 'sos_alert' ? 'emergency' : 'default',
        data: { notificationId: n.id, type: n.type, postId: n.post_id, targetId: n.target_id },
      });
    }
  }

  const result = await sendExpoPush(messages);

  // Gönderilenleri damgala
  await db
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .in('id', notifications.map((n) => n.id));

  // Geçersiz token'ları profillerden temizle
  for (const token of result.invalidTokens) {
    const owner = (profiles ?? []).find((p) => ((p.push_tokens as string[]) ?? []).includes(token));
    if (!owner) continue;
    await db
      .from('profiles')
      .update({ push_tokens: ((owner.push_tokens as string[]) ?? []).filter((t) => t !== token) })
      .eq('id', owner.id);
  }

  return json({ processed: notifications.length, ...result });
}));
