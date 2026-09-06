import type { Lang } from '../brand.js';
import type { ChannelId, Post, PostFormat } from '../schemas.js';

/** Kanal başına biçim kuralları — hem istemlere hem biçimlendiriciye girer. */
export interface ChannelSpec {
  id: ChannelId;
  label: string;
  /** Gövde + CTA + hashtag dahil toplam karakter sınırı (platform limiti). */
  maxChars: number;
  /** Önerilen üst sınır (algoritma/okunabilirlik) — aşılırsa uyarı. */
  recommendedChars: number;
  maxHashtags: number;
  /** Bağlantı politikası: bio (tıklanmaz), inline (metne yazılır), none (link yok). */
  linkPolicy: 'bio' | 'inline' | 'none';
  formats: PostFormat[];
  /** Türkiye yerel saatine göre önerilen yayın saatleri. */
  bestTimes: Record<Lang, string[]>;
  tone: string;
  rules: string[];
  /** `post` komutu bu kanalı API ile yayınlayabilir mi? */
  canPublish: boolean;
}

export interface FormattedPost {
  /** Yayına giden nihai metin (başlık hariç). */
  text: string;
  title: string;
  hashtags: string[];
  link: string;
  warnings: string[];
}

/** Planlanan / yapılan HTTP çağrısı (dry-run çıktısı ve test doğrulaması için). */
export interface PlannedRequest {
  method: 'GET' | 'POST';
  url: string;
  /** JSON/form gövdesi; multipart dosya alanları `@dosya` olarak gösterilir. */
  body?: Record<string, string>;
  note: string;
}

export interface PublishContext {
  env: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  dryRun: boolean;
  log: (line: string) => void;
}

export interface PublishResult {
  channel: ChannelId;
  postId: string;
  ok: boolean;
  remoteIds: string[];
  requests: PlannedRequest[];
  error?: string;
}

export interface Publisher {
  publish(post: Post, formatted: FormattedPost, ctx: PublishContext): Promise<PublishResult>;
}

export interface Channel {
  spec: ChannelSpec;
  format(post: Post): FormattedPost;
  publisher?: Publisher;
}

/** Gizli değerleri (token) log çıktısında maskeler. */
export function redact(value: string): string {
  return value
    .replace(/(access_token|token)=([^&\s]{4})[^&\s]*/giu, '$1=$2…')
    .replace(/(bot)(\d+):[A-Za-z0-9_-]+/gu, '$1$2:…');
}
