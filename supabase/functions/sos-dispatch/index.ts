/**
 * sos-dispatch — SOS bildirimini acil kişilere ve en yakın kurtarma
 * merkezine iletir.
 *
 * Gövde: { "sosEventId": "<uuid>" }  ya da  { "sosSessionId": "<uuid>" }
 * (ilki uygulama içi SOS, ikincisi uydu SOS oturumu).
 *
 * Adımlar:
 *   1. Olayı ve kullanıcıyı oku (service_role → RLS atlanır).
 *   2. En yakın DOĞRULANMIŞ kurtarma merkezini uzamsal olarak bul.
 *   3. Acil kişilere `sos_alert` bildirimi + push gönder.
 *   4. Olayı merkeze bağla ve `dispatched_at` damgala.
 *
 *   supabase functions deploy sos-dispatch
 */
import { handler, json, requireUser, serviceClient, HttpError } from '../_shared/supabase.ts';
import { sendExpoPush, type ExpoPushMessage } from '../_shared/push.ts';

Deno.serve(handler(async (req) => {
  const caller = await requireUser(req);
  const { sosEventId, sosSessionId } = await req.json();
  if (!sosEventId && !sosSessionId) {
    throw new HttpError(400, 'sosEventId veya sosSessionId gerekli');
  }

  const db = serviceClient();
  const table = sosEventId ? 'sos_events' : 'sos_sessions';
  const id = sosEventId ?? sosSessionId;

  const { data: event, error } = await db
    .from(table)
    .select('id, user_id, coords')
    .eq('id', id)
    .single();
  if (error || !event) throw new HttpError(404, 'SOS kaydı bulunamadı');
  // Kendi SOS'unu ya da acil kişisi olduğun birinin SOS'unu sevk edebilirsin.
  if (event.user_id !== caller.id) {
    const { data: allowed } = await db
      .from('emergency_contacts')
      .select('id')
      .eq('user_id', event.user_id)
      .eq('contact_user_id', caller.id)
      .maybeSingle();
    if (!allowed) throw new HttpError(403, 'Bu SOS kaydına erişimin yok');
  }

  // Koordinatı çözmek için RPC (geography → lat/lng)
  const { data: point } = await db.rpc('sos_coordinates', { table_name: table, row_id: id });
  const lat = point?.[0]?.lat ?? 0;
  const lng = point?.[0]?.lng ?? 0;

  // 1) En yakın kurtarma merkezleri
  const { data: centers } = await db.rpc('nearby_emergency_centers', {
    lat, lng, max_rows: 5,
  });
  const rescue = (centers ?? []).find(
    (c: { type: string }) => c.type === 'mountain_rescue' || c.type === 'ambulance',
  ) ?? centers?.[0] ?? null;

  // 2) Kullanıcı ve acil kişileri
  const { data: user } = await db
    .from('profiles')
    .select('id, display_name, username')
    .eq('id', event.user_id)
    .single();

  const { data: contacts } = await db
    .from('emergency_contacts')
    .select('name, phone, contact_user_id')
    .eq('user_id', event.user_id);

  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const message = `${user?.display_name ?? 'Bir kullanıcı'} SOS gönderdi. Son konum: ${mapsUrl}`;

  // 3) Uygulama içi bildirim (yalnızca uygulamada hesabı olan kişilere)
  const inAppContacts = (contacts ?? []).filter((c) => c.contact_user_id);
  if (inAppContacts.length > 0) {
    await db.from('notifications').insert(
      inAppContacts.map((c) => ({
        type: 'sos_alert',
        sender_id: event.user_id,
        receiver_id: c.contact_user_id,
        message,
        target_id: id,
      })),
    );
  }

  // 4) Anında push (fanout beklemeden)
  const { data: targets } = await db
    .from('profiles')
    .select('id, push_tokens')
    .in('id', inAppContacts.map((c) => c.contact_user_id));

  const pushes: ExpoPushMessage[] = (targets ?? []).flatMap((p) =>
    ((p.push_tokens as string[]) ?? []).map((token) => ({
      to: token,
      title: '🆘 ACİL DURUM',
      body: message,
      sound: 'default' as const,
      priority: 'high' as const,
      channelId: 'emergency',
      data: { type: 'sos_alert', targetId: id, lat, lng },
    })),
  );
  const pushResult = await sendExpoPush(pushes);

  // 5) Kaydı güncelle
  const patch: Record<string, unknown> = { notified_contacts: (contacts ?? []).length };
  if (table === 'sos_events') {
    patch.center_id = rescue?.id ?? null;
    patch.dispatched_at = new Date().toISOString();
    await db.from('sos_events').update(patch).eq('id', id);
  } else {
    await db.from('sos_sessions')
      .update({ rescue_center_id: rescue?.id ?? null, stage: 'dispatched' })
      .eq('id', id);
  }

  // 6) SMS/telefon köprüsü (uygulama dışı kişiler) — sağlayıcı entegrasyonu
  const smsWebhook = Deno.env.get('ZIRTAN_SMS_WEBHOOK');
  const offline = (contacts ?? []).filter((c) => !c.contact_user_id);
  if (smsWebhook && offline.length > 0) {
    await fetch(smsWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: offline.map((c) => c.phone), text: message }),
    }).catch((e) => console.error('SMS köprüsü başarısız', e));
  }

  return json({
    dispatched: true,
    rescueCenter: rescue ? { id: rescue.id, name: rescue.name, phone: rescue.phone } : null,
    notifiedContacts: (contacts ?? []).length,
    push: pushResult,
    location: { lat, lng },
  });
}));
