/**
 * payment-webhook — iyzico / Stripe emanet (escrow) durum geçişleri.
 *
 * Akış: pending → authorized → escrow → released | refunded | failed
 * Geçişler `advance_payment()` RPC'siyle yapılır: geri dönüş ve uç
 * durumlardan çıkış veritabanı seviyesinde engellenir.
 *
 * Güvenlik: imza doğrulaması ZORUNLUDUR — sağlayıcı gizli anahtarı
 * `ZIRTAN_STRIPE_WEBHOOK_SECRET` / `ZIRTAN_IYZICO_SECRET` ile gelir.
 * `verify_jwt = false` ile dağıtılmalıdır (bkz. supabase/config.toml).
 *
 *   supabase functions deploy payment-webhook --no-verify-jwt
 */
import { handler, json, serviceClient, HttpError } from '../_shared/supabase.ts';

/** Sabit zamanlı karşılaştırma (zamanlama saldırılarına karşı). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Sağlayıcı olay adı → Zirtan ödeme durumu. */
const STATUS_MAP: Record<string, string> = {
  // Stripe
  'payment_intent.amount_capturable_updated': 'authorized',
  'payment_intent.succeeded': 'escrow',
  'payment_intent.payment_failed': 'failed',
  'charge.refunded': 'refunded',
  'transfer.created': 'released',
  // iyzico
  'PAYMENT_AUTH_SUCCESS': 'authorized',
  'PAYMENT_CAPTURE_SUCCESS': 'escrow',
  'PAYMENT_FAILURE': 'failed',
  'REFUND_SUCCESS': 'refunded',
  'PAYOUT_COMPLETED': 'released',
};

Deno.serve(handler(async (req) => {
  const raw = await req.text();

  // --- İmza doğrulaması -------------------------------------------
  const stripeSig = req.headers.get('stripe-signature');
  const iyzicoSig = req.headers.get('x-iyz-signature-v3');

  if (stripeSig) {
    const secret = Deno.env.get('ZIRTAN_STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new HttpError(500, 'ZIRTAN_STRIPE_WEBHOOK_SECRET tanımlı değil');
    // Stripe biçimi: t=<zaman>,v1=<imza>
    const parts = Object.fromEntries(
      stripeSig.split(',').map((kv) => kv.split('=') as [string, string]),
    );
    const expected = await hmacSha256Hex(secret, `${parts.t}.${raw}`);
    if (!parts.v1 || !safeEqual(parts.v1, expected)) {
      throw new HttpError(401, 'Stripe imzası doğrulanamadı');
    }
    // 5 dakikadan eski olayları reddet (tekrar saldırısı)
    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) {
      throw new HttpError(401, 'Webhook zaman damgası geçersiz');
    }
  } else if (iyzicoSig) {
    const secret = Deno.env.get('ZIRTAN_IYZICO_SECRET');
    if (!secret) throw new HttpError(500, 'ZIRTAN_IYZICO_SECRET tanımlı değil');
    const expected = await hmacSha256Hex(secret, raw);
    if (!safeEqual(iyzicoSig, expected)) {
      throw new HttpError(401, 'iyzico imzası doğrulanamadı');
    }
  } else {
    throw new HttpError(401, 'İmza başlığı yok');
  }

  // --- Olayı çöz ---------------------------------------------------
  const event = JSON.parse(raw);
  const eventType: string = event.type ?? event.status ?? event.iyziEventType ?? '';
  const nextStatus = STATUS_MAP[eventType];
  if (!nextStatus) {
    // Bilinmeyen olay: 200 dön ki sağlayıcı tekrar denemesin.
    return json({ ignored: true, eventType });
  }

  const providerRef: string | undefined =
    event.data?.object?.id ?? event.paymentId ?? event.paymentConversationId;
  const bookingRef: string | undefined =
    event.data?.object?.metadata?.booking_id ?? event.conversationId;

  const db = serviceClient();

  // Ödeme kaydını sağlayıcı referansından ya da rezervasyondan bul
  let paymentId: string | null = null;
  if (providerRef) {
    const { data } = await db
      .from('payments').select('id').eq('provider_ref', providerRef).maybeSingle();
    paymentId = data?.id ?? null;
  }
  if (!paymentId && bookingRef) {
    const { data } = await db
      .from('payments').select('id').eq('booking_id', bookingRef).maybeSingle();
    paymentId = data?.id ?? null;
  }
  if (!paymentId) throw new HttpError(404, 'Eşleşen ödeme kaydı bulunamadı');

  const refundTry: number | null =
    eventType === 'charge.refunded' || eventType === 'REFUND_SUCCESS'
      ? (event.data?.object?.amount_refunded ?? event.price ?? 0) / 100
      : null;

  const { data: updated, error } = await db.rpc('advance_payment', {
    payment: paymentId,
    next_status: nextStatus,
    provider_reference: providerRef ?? null,
    refund_try: refundTry,
  });
  if (error) {
    // Aynı olayın tekrarı: geçiş reddedilir, 200 dönüp sessizce geç.
    if (error.message.includes('Geçersiz ödeme geçişi') ||
        error.message.includes('durumundan çıkarılamaz')) {
      return json({ duplicate: true, paymentId, eventType });
    }
    throw new Error(error.message);
  }

  // Rezervasyon durumunu ödemeye göre hizala
  const bookingStatus =
    nextStatus === 'escrow'   ? 'confirmed' :
    nextStatus === 'refunded' ? 'cancelled' :
    nextStatus === 'failed'   ? 'cancelled' : null;

  if (bookingStatus && updated?.booking_id) {
    await db.from('stay_bookings')
      .update({ status: bookingStatus })
      .eq('id', updated.booking_id);

    // Onay bildirimi
    if (bookingStatus === 'confirmed') {
      const { data: booking } = await db
        .from('stay_bookings')
        .select('guest_id, business_id, businesses(owner_id, name)')
        .eq('id', updated.booking_id)
        .single();
      if (booking) {
        await db.from('notifications').insert({
          type: 'stay_confirmed',
          sender_id: (booking as Record<string, any>).businesses?.owner_id ?? null,
          receiver_id: booking.guest_id,
          message: `${(booking as Record<string, any>).businesses?.name ?? 'Konaklama'} rezervasyonun onaylandı.`,
          target_id: updated.booking_id,
        });
      }
    }
  }

  return json({ paymentId, status: nextStatus, eventType });
}));
