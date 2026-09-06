// Ortak yardımcılar — tüm edge fonksiyonları bunu kullanır.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** service_role istemcisi: RLS'i atlar. YALNIZCA sunucu tarafında. */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** İsteği gönderen kullanıcıyı Authorization başlığından çözer. */
export async function requireUser(req: Request): Promise<{ id: string }> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Yetkilendirme başlığı yok');
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Geçersiz oturum');
  return { id: data.user.id };
}

/** Zamanlanmış (cron) çağrıları için paylaşılan gizli anahtar kontrolü. */
export function requireCronSecret(req: Request): void {
  const expected = Deno.env.get('ZIRTAN_CRON_SECRET');
  if (!expected) throw new HttpError(500, 'ZIRTAN_CRON_SECRET tanımlı değil');
  if (req.headers.get('x-zirtan-cron') !== expected) {
    throw new HttpError(401, 'Geçersiz cron anahtarı');
  }
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ZIRTAN_ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zirtan-cron',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Ortak hata sarmalayıcı: HttpError'ı doğru koda çevirir. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    try {
      return await fn(req);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
      console.error(`[hata ${status}]`, message);
      return json({ error: message }, status);
    }
  };
}
