import type { ID } from '@/domain';
import { MEDYA_CACHE_CONTROL, medyaCdnTabani, medyaUrl } from '@/domain/media';

import type { StorageFileApiLike, SupabaseLike } from './postgrest';

/**
 * Supabase Storage yükleme yardımcıları.
 *
 * Kovalar ve politikalar `supabase/migrations/0300_realtime_storage.sql`
 * içinde tanımlıdır. Yol düzeni **`<kova>/<kullanıcı-kimliği>/<dosya>`**;
 * RLS ilk klasör segmentine bakarak yalnızca kendi klasörüne yazmaya izin verir.
 *
 * ## EXIF temizleme
 * Fotoğrafın GPS/EXIF verisi **cihazda**, yüklemeden önce silinmelidir:
 * `expo-image-picker` ile seçilen görsel `expo-image-manipulator`'dan
 * (`manipulateAsync(uri, [], { compress, format })`) geçirildiğinde çıktı
 * yeniden kodlanır ve EXIF blokları düşer. Bu katman yalnızca **temizlenmiş**
 * baytları alır; ham kamera dosyasını doğrudan `upload*` fonksiyonlarına verme.
 * Sunucu tarafında ek bir temizleme yoktur — sorumluluk çağıran ekrandadır.
 */

export type BucketId =
  | 'avatars'
  | 'covers'
  | 'post-media'
  | 'story-media'
  | 'listing-media'
  | 'article-media'
  | 'species-photos'
  | 'tv-videos'
  | 'heritage-media'
  | 'map-packs'
  | 'gpx-tracks'
  | 'vision-uploads'
  | 'consult-media'
  | 'host-documents';

export interface BucketSpec {
  /** Bayt cinsinden üst sınır (migration ile aynı). */
  maxBytes: number;
  /** İzin verilen MIME türleri (migration ile aynı). */
  mimeTypes: readonly string[];
  /** Açık kova → imzasız genel URL; kapalı kova → imzalı URL gerekir. */
  public: boolean;
}

const MB = 1024 * 1024;
const IMAGE = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Kova tanımları — `0300_realtime_storage.sql` ile birebir aynı olmalıdır. */
export const BUCKETS: Record<BucketId, BucketSpec> = {
  avatars: { maxBytes: 5 * MB, mimeTypes: IMAGE, public: true },
  covers: { maxBytes: 10 * MB, mimeTypes: IMAGE, public: true },
  'post-media': { maxBytes: 25 * MB, mimeTypes: [...IMAGE, 'video/mp4'], public: true },
  'story-media': { maxBytes: 25 * MB, mimeTypes: [...IMAGE, 'video/mp4'], public: true },
  'listing-media': { maxBytes: 15 * MB, mimeTypes: IMAGE, public: true },
  'article-media': { maxBytes: 15 * MB, mimeTypes: IMAGE, public: true },
  'species-photos': { maxBytes: 15 * MB, mimeTypes: IMAGE, public: true },
  'tv-videos': {
    maxBytes: 512 * MB,
    mimeTypes: ['video/mp4', 'video/webm', 'application/vnd.apple.mpegurl'],
    public: true,
  },
  'heritage-media': {
    maxBytes: 25 * MB,
    mimeTypes: [...IMAGE, 'audio/mpeg'],
    public: true,
  },
  'map-packs': {
    maxBytes: 2048 * MB,
    mimeTypes: ['application/octet-stream', 'application/vnd.pmtiles'],
    public: true,
  },
  'gpx-tracks': {
    maxBytes: 10 * MB,
    mimeTypes: ['application/gpx+xml', 'application/xml', 'text/xml'],
    public: false,
  },
  'vision-uploads': { maxBytes: 15 * MB, mimeTypes: IMAGE, public: false },
  'consult-media': { maxBytes: 15 * MB, mimeTypes: IMAGE, public: false },
  'host-documents': {
    maxBytes: 20 * MB,
    mimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    public: false,
  },
};

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageValidationError';
  }
}

export interface UploadInput {
  bucket: BucketId;
  /** Dosya sahibi — yol `<bucket>/<userId>/…` biçiminde kurulur. */
  userId: ID;
  /** Baytlar (EXIF temizlenmiş olmalı, bkz. dosya başı). */
  bytes: Uint8Array | ArrayBuffer | Blob;
  contentType: string;
  /** Kullanıcı klasörü altındaki dosya adı; verilmezse üretilir. */
  fileName?: string;
  /** İç içe klasör (ör. danışma kimliği): `<bucket>/<userId>/<scope>/<file>`. */
  scope?: string;
  upsert?: boolean;
}

export interface UploadResult {
  bucket: BucketId;
  path: string;
  /** Açık kovalarda genel URL; kapalı kovalarda `null` (imzalı URL iste). */
  publicUrl: string | null;
}

/** Bayt uzunluğunu tür bağımsız okur. */
export function byteLength(bytes: UploadInput['bytes']): number {
  if (bytes instanceof ArrayBuffer) return bytes.byteLength;
  if (typeof Blob !== 'undefined' && bytes instanceof Blob) return bytes.size;
  return (bytes as Uint8Array).byteLength;
}

/** MIME türünden dosya uzantısı (bilinmiyorsa `bin`). */
export function extensionFor(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'application/pdf': 'pdf',
    'application/gpx+xml': 'gpx',
    'application/xml': 'xml',
    'text/xml': 'xml',
    'application/vnd.pmtiles': 'pmtiles',
    'application/vnd.apple.mpegurl': 'm3u8',
  };
  return map[contentType] ?? 'bin';
}

/** Boyut ve tür doğrulaması; hata varsa `StorageValidationError` fırlatır. */
export function validateUpload(input: Pick<UploadInput, 'bucket' | 'bytes' | 'contentType'>): void {
  const spec = BUCKETS[input.bucket];
  if (!spec) throw new StorageValidationError(`Bilinmeyen kova: ${input.bucket}`);
  if (!spec.mimeTypes.includes(input.contentType)) {
    throw new StorageValidationError(
      `Bu kova ${input.contentType} kabul etmiyor (izinli: ${spec.mimeTypes.join(', ')}).`,
    );
  }
  const size = byteLength(input.bytes);
  if (size <= 0) throw new StorageValidationError('Dosya boş.');
  if (size > spec.maxBytes) {
    throw new StorageValidationError(
      `Dosya çok büyük: ${Math.round(size / MB)} MB (üst sınır ${Math.round(spec.maxBytes / MB)} MB).`,
    );
  }
}

/** RLS'in beklediği yol: `<userId>/[scope/]<dosya>`. */
export function buildPath(input: UploadInput): string {
  const name =
    input.fileName?.replace(/[^a-zA-Z0-9._-]/g, '_') ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(input.contentType)}`;
  return [input.userId, input.scope, name].filter(Boolean).join('/');
}

function fileApi(client: SupabaseLike, bucket: BucketId): StorageFileApiLike {
  if (!client.storage) throw new StorageValidationError('Storage istemcisi kullanılabilir değil.');
  return client.storage.from(bucket);
}

/** Doğrular, yükler ve (açık kovada) genel URL'yi döner. */
export async function uploadMedia(
  client: SupabaseLike,
  input: UploadInput,
): Promise<UploadResult> {
  validateUpload(input);
  const path = buildPath(input);
  const api = fileApi(client, input.bucket);
  const result = await api.upload(
    path,
    input.bytes instanceof ArrayBuffer ? input.bytes : (input.bytes as Uint8Array),
    {
      contentType: input.contentType,
      upsert: input.upsert ?? false,
      // Dosya adı her yüklemede benzersiz → içerik değişmez. Eski bir saatlik
      // ömür CDN'in işe yaramasını engelliyordu: her saat kaynağa dönülüyordu.
      cacheControl: MEDYA_CACHE_CONTROL,
    },
  );
  if (result.error) throw new Error(`Yükleme başarısız: ${result.error.message}`);
  return {
    bucket: input.bucket,
    path,
    publicUrl: BUCKETS[input.bucket].public
      ? medyaUrl(api.getPublicUrl(path).data.publicUrl, medyaCdnTabani())
      : null,
  };
}

/** Kapalı kovalar için süreli okuma bağlantısı. */
export async function signedUrl(
  client: SupabaseLike,
  bucket: BucketId,
  path: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const result = await fileApi(client, bucket).createSignedUrl(path, expiresInSec);
  if (result.error) throw new Error(`İmzalı bağlantı alınamadı: ${result.error.message}`);
  return result.data?.signedUrl ?? null;
}

export async function removeMedia(
  client: SupabaseLike,
  bucket: BucketId,
  paths: string[],
): Promise<void> {
  if (!paths.length) return;
  const result = await fileApi(client, bucket).remove(paths);
  if (result.error) throw new Error(`Silinemedi: ${result.error.message}`);
}

/* ------------------------------------------------------------------ */
/* Kısayollar                                                          */
/* ------------------------------------------------------------------ */

export const uploadAvatar = (client: SupabaseLike, userId: ID, bytes: UploadInput['bytes'], contentType: string) =>
  uploadMedia(client, { bucket: 'avatars', userId, bytes, contentType, fileName: `avatar.${extensionFor(contentType)}`, upsert: true });

export const uploadPostMedia = (client: SupabaseLike, userId: ID, bytes: UploadInput['bytes'], contentType: string) =>
  uploadMedia(client, { bucket: 'post-media', userId, bytes, contentType });

export const uploadArticleCover = (client: SupabaseLike, userId: ID, bytes: UploadInput['bytes'], contentType: string) =>
  uploadMedia(client, { bucket: 'article-media', userId, bytes, contentType });

export const uploadSpeciesPhoto = (client: SupabaseLike, userId: ID, bytes: UploadInput['bytes'], contentType: string) =>
  uploadMedia(client, { bucket: 'species-photos', userId, bytes, contentType });
