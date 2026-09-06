/**
 * Telemetri istemcisi — olayları toplar, cihazda toplulaştırır, tamponlar ve gönderir.
 *
 * Tasarım kararları:
 * - **Asla çökmez.** Telemetri bir yan işlevdir; her yol try/catch içindedir ve
 *   hata durumunda sessizce vazgeçer. Ölçüm aracı uygulamayı bozmamalıdır.
 * - **Çevrimdışı öncelikli.** Dağda şebeke yoktur; olaylar `AsyncStorage`'da
 *   tamponlanır ve bağlantı gelince gönderilir.
 * - **Cihazda toplulaştırma.** Aynı imzalı olaylar tek kayıtta `count` ile
 *   birleşir; bir döngüde bin kez tekrarlayan hata bin istek üretmez.
 * - **Varsayılan sessiz.** `endpoint` verilmedikçe hiçbir ağ isteği yapılmaz;
 *   olaylar yalnızca yerel tamponda kalır ve geliştirici inceleyebilir.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { eventSignature, scrubRoute, scrubStack, scrubText, sessionHash } from './scrub';
import {
  DEFAULT_TELEMETRY_CONFIG,
  type TelemetryApp,
  type TelemetryConfig,
  type TelemetryDetailMap,
  type TelemetryEvent,
  type TelemetryKind,
  type TelemetryPlatform,
} from './types';

const STORAGE_KEY = 'zirtan.telemetry.v1';
const CONSENT_KEY = 'zirtan.telemetry.consent';

const platform = (): TelemetryPlatform => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return 'web';
};

export interface TelemetryClientOptions extends Partial<TelemetryConfig> {
  app?: TelemetryApp;
  locale?: string;
  /** Testler için enjekte edilebilir. */
  now?: () => number;
  fetchImpl?: typeof fetch;
  storage?: Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
}

export class TelemetryClient {
  private config: TelemetryConfig;
  private app: TelemetryApp;
  private locale: string | undefined;
  private buffer: TelemetryEvent[] = [];
  private bySignature = new Map<string, TelemetryEvent>();
  private route: string | undefined;
  private session: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private loaded = false;
  private readonly now: () => number;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: TelemetryClientOptions['storage'];

  constructor(options: TelemetryClientOptions = {}) {
    const { app, locale, now, fetchImpl, storage, ...config } = options;
    this.config = { ...DEFAULT_TELEMETRY_CONFIG, ...config };
    this.app = app ?? { version: '0.0.0' };
    this.locale = locale;
    this.now = now ?? Date.now;
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
    this.storage = storage ?? AsyncStorage;
    this.session = sessionHash(`${this.now()}-${Math.random()}`);
  }

  /** Kullanıcının onay tercihini okur ve tamponu geri yükler. */
  async init(): Promise<void> {
    try {
      const consent = await this.storage?.getItem(CONSENT_KEY);
      if (consent === 'off') this.config.enabled = false;
      const raw = await this.storage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) this.buffer = parsed.slice(-this.config.maxBuffer);
      }
    } catch {
      // Bozuk tampon telemetriyi durdurmaz.
    }
    this.loaded = true;
    this.startTimer();
  }

  /** Kullanıcı ayarlardan toplamayı açıp kapatır (KVKK/GDPR). */
  async setEnabled(enabled: boolean): Promise<void> {
    this.config.enabled = enabled;
    try {
      await this.storage?.setItem(CONSENT_KEY, enabled ? 'on' : 'off');
      if (!enabled) {
        this.buffer = [];
        this.bySignature.clear();
        await this.storage?.removeItem(STORAGE_KEY);
      }
    } catch {
      // Yoksay.
    }
    if (enabled) this.startTimer();
    else this.stopTimer();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Gönderim ucunu çalışma anında ayarlar (gerçek sunucu geldiğinde). */
  configure(patch: Partial<TelemetryConfig> & { app?: TelemetryApp; locale?: string }): void {
    const { app, locale, ...rest } = patch;
    this.config = { ...this.config, ...rest };
    if (app) this.app = app;
    if (locale) this.locale = locale;
  }

  /** Geçerli rotayı bildirir; sonraki olaylar bu rotayla etiketlenir. */
  setRoute(route: string | null | undefined): void {
    this.route = scrubRoute(route);
  }

  /** Tampondaki olayları döndürür (test ve geliştirici paneli için). */
  pending(): readonly TelemetryEvent[] {
    return this.buffer;
  }

  /**
   * Olay kaydeder. Aynı imzalı olay tamponda varsa sayacı artırır.
   * Her zaman senkron döner; kalıcılık arka planda yapılır.
   */
  track<K extends TelemetryKind>(kind: K, detail: TelemetryDetailMap[K]): void {
    if (!this.config.enabled) return;
    try {
      const clean = this.scrubDetail(kind, detail);
      const signature = eventSignature(
        kind,
        this.route,
        this.signatureKey(kind, clean as unknown as Record<string, unknown>),
      );
      const existing = this.bySignature.get(signature);
      if (existing) {
        existing.count = (existing.count ?? 1) + 1;
        existing.ts = new Date(this.now()).toISOString();
        void this.persist();
        return;
      }
      const event: TelemetryEvent<K> = {
        id: signature,
        ts: new Date(this.now()).toISOString(),
        kind,
        app: this.app,
        platform: platform(),
        locale: this.locale,
        route: this.route,
        sessionHash: this.session,
        count: 1,
        detail: clean,
      };
      this.buffer.push(event as TelemetryEvent);
      this.bySignature.set(signature, event as TelemetryEvent);
      if (this.buffer.length > this.config.maxBuffer) {
        const dropped = this.buffer.splice(0, this.buffer.length - this.config.maxBuffer);
        for (const d of dropped) this.bySignature.delete(d.id);
      }
      void this.persist();
    } catch {
      // Telemetri hiçbir koşulda çağıranı bozmaz.
    }
  }

  /** Tampondaki olayları gönderir; uç tanımlı değilse hiçbir şey yapmaz. */
  async flush(): Promise<{ sent: number; ok: boolean }> {
    if (!this.config.enabled || !this.config.endpoint || this.buffer.length === 0) {
      return { sent: 0, ok: true };
    }
    const batch = this.buffer.slice(0, this.config.batchSize);
    try {
      const res = await this.fetchImpl(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
      if (!res.ok) return { sent: 0, ok: false };
      this.buffer = this.buffer.slice(batch.length);
      for (const e of batch) this.bySignature.delete(e.id);
      await this.persist();
      return { sent: batch.length, ok: true };
    } catch {
      // Ağ yok: olaylar tamponda kalır, sonraki denemede gönderilir.
      return { sent: 0, ok: false };
    }
  }

  /** Zamanlayıcıyı durdurur (uygulama kapanışı, test temizliği). */
  stop(): void {
    this.stopTimer();
  }

  private startTimer(): void {
    if (this.timer || !this.config.enabled || !this.config.flushIntervalMs) return;
    this.timer = setInterval(() => void this.flush(), this.config.flushIntervalMs);
    // Node/test ortamında süreci canlı tutmasın.
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async persist(): Promise<void> {
    if (!this.loaded) return;
    try {
      await this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.buffer));
    } catch {
      // Depolama dolu ya da erişilemez: bellekte tutmaya devam.
    }
  }

  /** Aynı sorunun tekrarını tanımlayan anahtar. */
  private signatureKey(kind: TelemetryKind, detail: Record<string, unknown>): string {
    switch (kind) {
      case 'crash':
      case 'error':
        return String(detail.message ?? '').slice(0, 120);
      case 'slow_screen':
      case 'empty_screen':
        return String(detail.screen ?? '');
      case 'failed_request':
        return `${detail.endpoint ?? ''}|${detail.status ?? ''}`;
      case 'flow_abandon':
        return `${detail.flow ?? ''}|${detail.step ?? ''}`;
      case 'i18n_missing':
        return `${detail.key ?? ''}|${detail.locale ?? ''}`;
      default:
        return '';
    }
  }

  /** Ayrıntıyı türüne göre temizler — serbest metin buradan geçmeden çıkmaz. */
  private scrubDetail<K extends TelemetryKind>(
    kind: K,
    detail: TelemetryDetailMap[K],
  ): TelemetryDetailMap[K] {
    const d = detail as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = { ...d };
    if (typeof d.message === 'string') out.message = scrubText(d.message, 300);
    if (typeof d.stack === 'string') out.stack = scrubStack(d.stack);
    if (typeof d.screen === 'string') out.screen = scrubRoute(d.screen) ?? d.screen;
    if (typeof d.endpoint === 'string') out.endpoint = scrubText(d.endpoint, 120);
    if (typeof d.reason === 'string') out.reason = scrubText(d.reason, 120);
    if (kind === 'i18n_missing' && typeof d.key === 'string') {
      // Çeviri anahtarı kişisel veri içermez; yalnızca uzunluk sınırı.
      out.key = d.key.slice(0, 120);
    }
    return out as unknown as TelemetryDetailMap[K];
  }
}

/** Uygulama genelinde tek örnek. */
export const telemetry = new TelemetryClient();
