import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseLike } from './postgrest';

/**
 * Supabase istemcisi (React Native / Expo).
 *
 * · Oturum `AsyncStorage`'da saklanır (uygulama yeniden açıldığında korunur).
 * · `detectSessionInUrl: false` — RN'de URL yok; derin bağlantı akışı ayrı ele alınır.
 * · `autoRefreshToken: true` — erişim jetonu arka planda yenilenir.
 * · Realtime olay hızı saniyede 10 olayla sınırlanır (mobil pil/veri dostu).
 */

export interface RemoteConfig {
  url: string;
  anonKey: string;
}

/** Ortam değişkenlerinden yapılandırmayı okur; ikisi de yoksa `null`. */
export function readRemoteConfig(
  env: Record<string, string | undefined> = process.env,
): RemoteConfig | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

let cached: SupabaseClient | null = null;

/** Uygulama genelinde tek Supabase istemcisi. */
export function getSupabaseClient(config: RemoteConfig): SupabaseClient {
  if (!cached) {
    cached = createClient(config.url, config.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // React Native'de tarayıcı URL'si yoktur.
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      realtime: { params: { eventsPerSecond: 10 } },
      global: { headers: { 'x-zirtan-client': 'expo' } },
    });
  }
  return cached;
}

/** Testler ve oturum sıfırlama için önbelleği temizler. */
export function resetSupabaseClient(): void {
  cached = null;
}

/**
 * `SupabaseClient`'ı bu katmanın kullandığı yapısal arayüze indirger.
 *
 * supabase-js'in jenerik tipleri (şema tipleri üretilmediği için) `SupabaseLike`
 * ile birebir eşleşmez; çalışma zamanı yüzeyi ise aynıdır. Dönüşüm tek noktada,
 * burada yapılır — repository'ler yalnızca `SupabaseLike` görür ve böylece
 * testlerde Postgres'e doğrudan bağlanan uyarlayıcıyla değiştirilebilir.
 */
export function asSupabaseLike(client: SupabaseClient): SupabaseLike {
  return client as unknown as SupabaseLike;
}
