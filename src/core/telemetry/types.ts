/**
 * Telemetri olay sözleşmesi — `agents/selfheal/telemetry.schema.json` (v1) ile birebir.
 *
 * Gizlilik ilkesi: bu katmandan **kişisel veri geçmez**. Kullanıcı kimliği yalnızca
 * geri döndürülemez `sessionHash` olarak taşınır; konum, mesaj içeriği, e-posta,
 * telefon ve medya hiçbir olayda yer almaz. Serbest metin yalnızca hata mesajı ve
 * yığın izidir; ikisi de gönderilmeden önce temizlenir (`scrub.ts`).
 */

export const TELEMETRY_KINDS = [
  'crash',
  'error',
  'slow_screen',
  'failed_request',
  'flow_abandon',
  'empty_screen',
  'i18n_missing',
] as const;

export type TelemetryKind = (typeof TELEMETRY_KINDS)[number];

export type TelemetryPlatform = 'ios' | 'android' | 'web';

export interface TelemetryApp {
  version: string;
  runtimeVersion?: string;
  channel?: 'development' | 'preview' | 'production';
  /** OTA güncelleme kimliği; kanarya değerlendirmesi bunu kullanır. */
  updateId?: string;
}

export interface CrashDetail {
  message: string;
  stack?: string;
  screen?: string;
  fatal?: boolean;
  jsEngine?: string;
}

export interface ErrorDetail {
  message: string;
  stack?: string;
  screen?: string;
  /** Hatayı kimin yakaladığı: hata sınırı, sorgu katmanı, elle. */
  handledBy?: string;
}

export interface SlowScreenDetail {
  screen: string;
  ms: number;
  budgetMs?: number;
  queries?: number;
}

export interface FailedRequestDetail {
  /** Yol şablonu — kimlikler gizlenmiş olmalı (`/v1/posts/[id]`). */
  endpoint: string;
  status: number;
  method?: string;
  ms?: number;
  errorCode?: string;
}

export interface FlowAbandonDetail {
  flow: string;
  step: string;
  stepIndex?: number;
  totalSteps?: number;
  completions?: number;
}

export interface EmptyScreenDetail {
  screen: string;
  reason?: string;
  /** Ekranda anlamlı bir boş durum bileşeni var mıydı? */
  hasEmptyState?: boolean;
}

export interface I18nMissingDetail {
  key: string;
  locale: string;
  screen?: string;
}

export type TelemetryDetail =
  | CrashDetail
  | ErrorDetail
  | SlowScreenDetail
  | FailedRequestDetail
  | FlowAbandonDetail
  | EmptyScreenDetail
  | I18nMissingDetail;

/** Tür ile ayrıntı şeklini eşleyen tablo — `track()` bunu kullanır. */
export interface TelemetryDetailMap {
  crash: CrashDetail;
  error: ErrorDetail;
  slow_screen: SlowScreenDetail;
  failed_request: FailedRequestDetail;
  flow_abandon: FlowAbandonDetail;
  empty_screen: EmptyScreenDetail;
  i18n_missing: I18nMissingDetail;
}

export interface TelemetryEvent<K extends TelemetryKind = TelemetryKind> {
  id: string;
  ts: string;
  kind: K;
  app: TelemetryApp;
  platform: TelemetryPlatform;
  locale?: string;
  /** Rota şablonu, gerçek kimlikler gizlenmiş: `/post/[id]`. */
  route?: string;
  /** Oturumun geri döndürülemez özeti; aynı oturumdaki olayları gruplar. */
  sessionHash?: string;
  /** Aynı imzadan kaç kez oluştuğu (cihazda toplulaştırılır). */
  count?: number;
  detail?: TelemetryDetailMap[K];
}

export interface TelemetryConfig {
  /** Toplama açık mı — kullanıcı ayarlardan kapatabilir (KVKK/GDPR). */
  enabled: boolean;
  /** Olayların gönderileceği uç; boşsa yalnızca yerel tampon tutulur. */
  endpoint: string | null;
  /** Tamponda tutulacak en fazla olay sayısı. */
  maxBuffer: number;
  /** Otomatik gönderim aralığı (ms). */
  flushIntervalMs: number;
  /** Tek gönderimde en fazla olay. */
  batchSize: number;
}

export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: true,
  endpoint: null,
  maxBuffer: 200,
  flushIntervalMs: 60_000,
  batchSize: 50,
};
