/**
 * return-promise-check — "dönüş sözü" gecikmelerini tarar.
 *
 * Süresi (expectedReturnAt + graceMin) geçmiş ve henüz uyarılmamış
 * planları `overdue` yapar, acil kişilere bildirim + push gönderir.
 * `DestinationRepository.checkOverdue` sözleşmesinin sunucu karşılığıdır.
 *
 * Tetikleme: pg_cron ile 15 dakikada bir.
 *   select cron.schedule('return-promise', '*\/15 * * * *', $$
 *     select net.http_post(
 *       url := '<PROJE>/functions/v1/return-promise-check',
 *       headers := jsonb_build_object('x-zirtan-cron', '<gizli>'))
 *   $$);
 */
import { handler, json, requireCronSecret, serviceClient } from '../_shared/supabase.ts';
import { sendExpoPush, type ExpoPushMessage } from '../_shared/push.ts';

Deno.serve(handler(async (req) => {
  requireCronSecret(req);
  const db = serviceClient();

  const { data: overdue, error } = await db.rpc('overdue_return_plans', { grace_extra_min: 0 });
  if (error) throw new Error(error.message);
  if (!overdue?.length) return json({ checked: 0, alerted: 0 });

  const now = new Date().toISOString();
  const notifications: Record<string, unknown>[] = [];
  const pushes: ExpoPushMessage[] = [];

  for (const plan of overdue as {
    id: string; user_id: string; title: string; contact_ids: string[]; overdue_min: number;
  }[]) {
    // 1) Planı overdue'ya al ve uyarıyı damgala
    await db
      .from('return_plans')
      .update({ status: 'overdue', alert_sent_at: now })
      .eq('id', plan.id);

    // 2) Kullanıcının son bilinen konumu (arama-kurtarma için)
    const { data: lastPing } = await db
      .from('location_pings')
      .select('recorded_at')
      .eq('user_id', plan.user_id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: user } = await db
      .from('profiles')
      .select('display_name')
      .eq('id', plan.user_id)
      .single();

    const hours = Math.floor(plan.overdue_min / 60);
    const body =
      `${user?.display_name ?? 'Bir gezgin'} "${plan.title}" planından ` +
      `${hours > 0 ? `${hours} saat` : `${plan.overdue_min} dakika`} geç kaldı.` +
      (lastPing ? ` Son konum sinyali: ${lastPing.recorded_at}.` : ' Konum sinyali yok.');

    // 3) Plandaki kişiler + profildeki acil kişiler
    const { data: contacts } = await db
      .from('emergency_contacts')
      .select('contact_user_id')
      .eq('user_id', plan.user_id)
      .not('contact_user_id', 'is', null);

    const receivers = [
      ...new Set([...(plan.contact_ids ?? []), ...(contacts ?? []).map((c) => c.contact_user_id)]),
    ].filter(Boolean) as string[];

    for (const receiver of receivers) {
      notifications.push({
        type: 'trip_overdue',
        sender_id: plan.user_id,
        receiver_id: receiver,
        message: body,
        target_id: plan.id,
      });
    }

    const { data: targets } = await db
      .from('profiles')
      .select('push_tokens')
      .in('id', receivers);
    for (const t of targets ?? []) {
      for (const token of ((t.push_tokens as string[]) ?? [])) {
        pushes.push({
          to: token,
          title: '⚠️ Dönüş sözü gecikti',
          body,
          sound: 'default',
          priority: 'high',
          channelId: 'emergency',
          data: { type: 'trip_overdue', planId: plan.id },
        });
      }
    }
  }

  if (notifications.length > 0) {
    await db.from('notifications').insert(notifications);
  }
  const pushResult = await sendExpoPush(pushes);

  return json({
    checked: overdue.length,
    alerted: notifications.length,
    push: pushResult,
  });
}));
