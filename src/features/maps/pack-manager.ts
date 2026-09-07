import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { ID, MapPack, MapPackStatus } from '@/domain';

/* ------------------------------------------------------------------ */
/* Yapılandırma                                                        */
/* ------------------------------------------------------------------ */

/** Karo sunucusu kökü; `.env` içinde `EXPO_PUBLIC_TILES_URL` ile verilir. */
export function tilesBaseUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_TILES_URL?.trim();
  return url ? url.replace(/\/+$/, '') : null;
}

/** Paketlerin indirileceği dizin adı (belge dizini altında). */
export const PACK_DIR = 'map-packs';

/** `<paket>.pmtiles` dosya adı — yol geçişine kapalı. */
export function packFileName(packId: ID): string {
  const safe = packId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) throw new Error('Geçersiz paket kimliği');
  return `${safe}.pmtiles`;
}

/** Künye dosyası: sürüm ve boyut çevrimdışı da bilinsin diye yanına yazılır. */
export function packMetaName(packId: ID): string {
  return `${packFileName(packId)}.json`;
}

/**
 * Yükseklik (DEM) dosyası: `<paket>-dem.pmtiles`.
 *
 * Vektör karolardan ayrı tutulur — kabartma ve 3B istemeyen kullanıcı indirmez.
 * Ad karo hattıyla aynı sözleşmeye uyar (`tools/tiles/build-tiles.mjs`).
 */
export function demFileName(packId: ID): string {
  return packFileName(packId).replace(/\.pmtiles$/, '-dem.pmtiles');
}

/** DEM künyesi — vektör künyesinden ayrı, çünkü ayrı indirilip silinebilir. */
export function demMetaName(packId: ID): string {
  return `${demFileName(packId)}.json`;
}

/** Uzak karo adresi. `baseUrl` yoksa paket indirilemez. */
export function packRemoteUrl(packId: ID, baseUrl = tilesBaseUrl()): string | null {
  return baseUrl ? `${baseUrl}/tiles/${packFileName(packId)}` : null;
}

/** Uzak DEM adresi. */
export function demRemoteUrl(packId: ID, baseUrl = tilesBaseUrl()): string | null {
  return baseUrl ? `${baseUrl}/tiles/${demFileName(packId)}` : null;
}

/**
 * İki dosyanın ortak ilerlemesini 0..1 aralığına indirger.
 *
 * Boyutlar biliniyorsa bayta göre ağırlıklandırılır; bilinmiyorsa vektör
 * paketine %80 pay verilir. Bu bir tahmindir ve **öyle olduğu görünür**:
 * ilerleme çubuğu geri gitmez, ama DEM payı gerçekte farklıysa çubuk son
 * dilimde hızlanır ya da yavaşlar. Alternatif (iki ayrı çubuk) ekranı
 * karmaşıklaştırırdı.
 */
export function combinedProgress(
  tileRatio: number,
  demRatio: number,
  sizes: { tileBytes?: number; demBytes?: number } = {},
): number {
  const t = Math.min(1, Math.max(0, tileRatio));
  const d = Math.min(1, Math.max(0, demRatio));
  const tileBytes = sizes.tileBytes ?? 0;
  const demBytes = sizes.demBytes ?? 0;
  const weight = tileBytes > 0 && demBytes > 0 ? tileBytes / (tileBytes + demBytes) : 0.8;
  return Math.min(1, Math.max(0, t * weight + d * (1 - weight)));
}

/* ------------------------------------------------------------------ */
/* Sürüm karşılaştırma                                                 */
/* ------------------------------------------------------------------ */

/**
 * `2026.09`, `1.4.2` gibi noktalı sürümleri sayısal olarak karşılaştırır.
 * Dönüş: a<b → -1, a==b → 0, a>b → 1.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split(/[.\-+]/).map((s) => parseInt(s, 10));
  const pb = b.split(/[.\-+]/).map((s) => parseInt(s, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = Number.isFinite(pa[i]) ? (pa[i] as number) : 0;
    const y = Number.isFinite(pb[i]) ? (pb[i] as number) : 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** Cihazdaki sürüm sunucudakinden eskiyse `true`. */
export function isOutdated(localVersion: string | null, remoteVersion: string): boolean {
  if (!localVersion) return false;
  return compareVersions(localVersion, remoteVersion) < 0;
}

/* ------------------------------------------------------------------ */
/* Durum makinesi                                                      */
/* ------------------------------------------------------------------ */

export type PackEvent =
  | { type: 'download' }
  | { type: 'progress'; progress: number }
  | { type: 'complete'; version: string; sizeMb: number; localPath: string; at: string }
  | { type: 'cancel' }
  | { type: 'fail' }
  | { type: 'remove' }
  | { type: 'remote-version'; version: string };

/**
 * Paket durum makinesi — saf fonksiyon, dosya sistemi bilmez.
 *
 * ```
 * available ──download──▶ downloading ──complete──▶ downloaded
 *      ▲                      │  ▲                      │
 *      └── cancel/fail ───────┘  └──── download ────────┤ (yeni sürüm)
 *      └────────────── remove ───────────────────────────┘
 * downloaded ──remote-version (daha yeni)──▶ update_available
 * ```
 */
export function packReducer(pack: MapPack, event: PackEvent): MapPack {
  switch (event.type) {
    case 'download':
      if (pack.status === 'downloading') return pack;
      return { ...pack, status: 'downloading', progress: 0, localPath: null };
    case 'progress': {
      if (pack.status !== 'downloading') return pack;
      const progress = Math.min(1, Math.max(0, event.progress));
      if (Math.abs(progress - pack.progress) < 0.005) return pack;
      return { ...pack, progress };
    }
    case 'complete':
      return {
        ...pack,
        status: 'downloaded',
        progress: 1,
        version: event.version,
        sizeMb: event.sizeMb,
        localPath: event.localPath,
        updatedAt: event.at,
      };
    case 'cancel':
    case 'fail':
      if (pack.status !== 'downloading') return pack;
      return { ...pack, status: 'available', progress: 0, localPath: null };
    case 'remove':
      return { ...pack, status: 'available', progress: 0, localPath: null };
    case 'remote-version':
      if (pack.status !== 'downloaded') return pack;
      return isOutdated(pack.version, event.version)
        ? { ...pack, status: 'update_available' }
        : pack;
    default:
      return pack;
  }
}

/** Yalnızca durum adı gereken yerler için kısayol. */
export function nextStatus(pack: MapPack, event: PackEvent): MapPackStatus {
  return packReducer(pack, event).status;
}

/* ------------------------------------------------------------------ */
/* Depolama katmanı (test edilebilir olsun diye arayüz)                */
/* ------------------------------------------------------------------ */

export interface PackMeta {
  version: string;
  sizeMb: number;
  updatedAt: string;
}

export interface PackStorage {
  /** Paket dizinini oluşturur (varsa dokunmaz). */
  ensure(): void;
  exists(fileName: string): boolean;
  /** Bayt cinsinden dosya boyutu; yoksa 0. */
  size(fileName: string): number;
  uri(fileName: string): string;
  remove(fileName: string): void;
  list(): string[];
  readMeta(fileName: string): PackMeta | null;
  writeMeta(fileName: string, meta: PackMeta): void;
  download(
    url: string,
    fileName: string,
    options: { onProgress?: (received: number, total: number) => void; signal?: AbortSignal },
  ): Promise<number>;
}

/** `expo-file-system` tabanlı gerçek depolama. */
export function createFileSystemStorage(dirName = PACK_DIR): PackStorage {
  const dir = () => new Directory(Paths.document, dirName);
  const file = (name: string) => new File(dir(), name);
  return {
    ensure() {
      const d = dir();
      if (!d.exists) d.create({ intermediates: true });
    },
    exists: (name) => file(name).exists,
    size: (name) => {
      const f = file(name);
      return f.exists ? f.size : 0;
    },
    uri: (name) => file(name).uri,
    remove(name) {
      const f = file(name);
      if (f.exists) f.delete();
    },
    list() {
      const d = dir();
      if (!d.exists) return [];
      return d
        .list()
        .filter((entry): entry is File => entry instanceof File)
        .map((entry) => entry.name);
    },
    readMeta(name) {
      const f = file(name);
      if (!f.exists) return null;
      try {
        return JSON.parse(f.textSync()) as PackMeta;
      } catch {
        return null;
      }
    },
    writeMeta(name, meta) {
      const f = file(name);
      f.write(JSON.stringify(meta));
    },
    async download(url, name, options) {
      this.ensure();
      const target = file(name);
      await File.downloadFileAsync(url, target, {
        idempotent: true,
        signal: options.signal,
        onProgress: ({ bytesWritten, totalBytes }) =>
          options.onProgress?.(bytesWritten, totalBytes),
      });
      return target.exists ? target.size : 0;
    },
  };
}

/**
 * Bellek içi depolama — testler ve dosya sistemi olmayan ortamlar (web) için.
 * `expo-file-system` web'de boş bir gölge uygulamadır; web'de paketler kalıcı olmaz,
 * harita karoları doğrudan sunucudan (HTTP Range) okunur.
 */
export function createMemoryStorage(
  fetchImpl: typeof fetch = fetch,
  chunkSize = 4,
): PackStorage & { files: Map<string, number> } {
  const files = new Map<string, number>();
  const metas = new Map<string, PackMeta>();
  const urls = new Map<string, string>();
  return {
    files,
    ensure() {},
    exists: (name) => files.has(name),
    size: (name) => files.get(name) ?? 0,
    uri: (name) => urls.get(name) ?? `memory://${name}`,
    remove(name) {
      files.delete(name);
      metas.delete(name);
      urls.delete(name);
    },
    list: () => [...files.keys()],
    readMeta: (name) => metas.get(name) ?? null,
    writeMeta(name, meta) {
      metas.set(name, meta);
    },
    async download(url, name, options) {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(`İndirme başarısız (${response.status})`);
      const declared = Number(response.headers?.get?.('content-length') ?? 0);
      const buffer = await response.arrayBuffer();
      const total = buffer.byteLength || declared;
      const step = Math.max(1, Math.ceil(total / chunkSize));
      for (let sent = step; sent < total; sent += step) {
        if (options.signal?.aborted) throw new AbortErrorLike();
        options.onProgress?.(sent, total);
      }
      if (options.signal?.aborted) throw new AbortErrorLike();
      options.onProgress?.(total, total);
      files.set(name, total);
      urls.set(name, url);
      return total;
    },
  };
}

/** Platforma göre varsayılan depolama (yerelde dosya sistemi, web'de bellek). */
export function createDefaultStorage(): PackStorage {
  return Platform.OS === 'web' ? createMemoryStorage() : createFileSystemStorage();
}

/** `DOMException` her ortamda yok; iptal hatası için taşınabilir eşdeğeri. */
class AbortErrorLike extends Error {
  override name = 'AbortError';
}

/* ------------------------------------------------------------------ */
/* Yönetici                                                            */
/* ------------------------------------------------------------------ */

export interface DownloadHandle {
  packId: ID;
  cancel: () => void;
}

export interface PackManagerOptions {
  storage?: PackStorage;
  baseUrl?: string | null;
  /** İlerleme bildirimi (0..1) */
  onProgress?: (packId: ID, progress: number) => void;
}

/**
 * Çevrimdışı harita paketi yöneticisi: indir (ilerleme bildirimli), iptal et,
 * sürüm karşılaştır, sil, disk kullanımını ölç. `MapPack` sözleşmesini korur;
 * durum geçişleri `packReducer` üzerinden yapılır.
 */
export class MapPackManager {
  private readonly storage: PackStorage;
  private readonly baseUrl: string | null;
  private readonly onProgress?: (packId: ID, progress: number) => void;
  private readonly running = new Map<ID, AbortController>();
  private readonly listeners = new Set<(packId: ID, progress: number) => void>();

  constructor(options: PackManagerOptions = {}) {
    this.storage = options.storage ?? createDefaultStorage();
    this.baseUrl = options.baseUrl ?? tilesBaseUrl();
    this.onProgress = options.onProgress;
  }

  /** İlerleme dinleyicisi ekler; dönüş değeri aboneliği kaldırır. */
  addProgressListener(listener: (packId: ID, progress: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(packId: ID, progress: number) {
    this.onProgress?.(packId, progress);
    for (const listener of this.listeners) listener(packId, progress);
  }

  /** Paket cihazda mı? */
  isInstalled(packId: ID): boolean {
    return this.storage.exists(packFileName(packId));
  }

  /** İndirilmiş paketin yerel dosya adresi; yoksa null. */
  localPath(packId: ID): string | null {
    const name = packFileName(packId);
    return this.storage.exists(name) ? this.storage.uri(name) : null;
  }

  /** Cihazdaki sürüm (künye dosyasından); yoksa null. */
  installedVersion(packId: ID): string | null {
    return this.storage.readMeta(packMetaName(packId))?.version ?? null;
  }

  /** Yükseklik dosyası cihazda mı? (kabartma ve 3B bunu ister) */
  hasDem(packId: ID): boolean {
    return this.storage.exists(demFileName(packId));
  }

  /** İndirilmiş DEM'in yerel adresi; yoksa null. */
  demPath(packId: ID): string | null {
    const name = demFileName(packId);
    return this.storage.exists(name) ? this.storage.uri(name) : null;
  }

  /** Cihazdaki paketlerin toplam boyutu (bayt). */
  diskUsageBytes(): number {
    return this.storage
      .list()
      .filter((name) => name.endsWith('.pmtiles'))
      .reduce((total, name) => total + this.storage.size(name), 0);
  }

  /** Cihazdaki paketlerin toplam boyutu (MB, tek ondalık). */
  diskUsageMb(): number {
    return Math.round((this.diskUsageBytes() / 1024 / 1024) * 10) / 10;
  }

  /** Sunucudaki sürümle karşılaştırıp güncel durumu döndürür. */
  reconcile(pack: MapPack, remoteVersion = pack.version): MapPack {
    if (!this.isInstalled(pack.id)) {
      return pack.status === 'downloading' ? pack : packReducer(pack, { type: 'remove' });
    }
    const local = this.installedVersion(pack.id) ?? pack.version;
    const meta = this.storage.readMeta(packMetaName(pack.id));
    const installed: MapPack = {
      ...pack,
      status: 'downloaded',
      progress: 1,
      version: local,
      sizeMb: meta?.sizeMb ?? pack.sizeMb,
      localPath: this.localPath(pack.id),
      updatedAt: meta?.updatedAt ?? pack.updatedAt,
    };
    return packReducer(installed, { type: 'remote-version', version: remoteVersion });
  }

  /**
   * Paketi indirir; her ilerleme adımında `onProgress` çağrılır.
   * Aynı paket zaten iniyorsa mevcut indirme korunur.
   *
   * Dosya her zaman **uygulamadaki paket kimliğiyle** saklanır; sunucudaki dosya
   * adı farklı olabileceği için adres `options.url` ile verilebilir.
   */
  async download(
    pack: MapPack,
    options: {
      version?: string;
      url?: string;
      /**
       * Yükseklik dosyasının adresi. Verilirse vektör paketten **sonra** indirilir
       * ve kabartma/3B çevrimdışı da çalışır. Sunucu DEM sunmuyorsa boş bırakılır.
       */
      demUrl?: string | null;
      /** İlerlemeyi bayta göre ağırlıklandırmak için sunucudan gelen boyutlar */
      tileBytes?: number;
      demBytes?: number;
    } = {},
  ): Promise<MapPack> {
    const remoteVersion = options.version ?? pack.version;
    const url = options.url ?? packRemoteUrl(pack.id, this.baseUrl);
    if (!url) throw new Error('Karo sunucusu adresi tanımlı değil (EXPO_PUBLIC_TILES_URL)');
    if (this.running.has(pack.id)) return packReducer(pack, { type: 'download' });

    const controller = new AbortController();
    this.running.set(pack.id, controller);
    const fileName = packFileName(pack.id);
    const demName = demFileName(pack.id);
    const sizes = { tileBytes: options.tileBytes, demBytes: options.demBytes };
    const wantsDem = Boolean(options.demUrl);
    try {
      const bytes = await this.storage.download(url, fileName, {
        signal: controller.signal,
        onProgress: (received, total) => {
          const ratio = total > 0 ? received / total : 0;
          this.emit(pack.id, wantsDem ? combinedProgress(ratio, 0, sizes) : ratio);
        },
      });

      // DEM ikinci sırada: vektör paket olmadan harita zaten çizilemez, bu yüzden
      // önce onu tamamlamak yarıda kesilen indirmede daha çok işe yarar.
      let demBytes = 0;
      if (options.demUrl) {
        try {
          demBytes = await this.storage.download(options.demUrl, demName, {
            signal: controller.signal,
            onProgress: (received, total) => {
              const ratio = total > 0 ? received / total : 0;
              this.emit(pack.id, combinedProgress(1, ratio, sizes));
            },
          });
        } catch (demError) {
          // İptal ise dışarıdaki catch'e devret; değilse DEM'i **sessizce**
          // atlama: paket yine kullanılabilir ama kabartma olmaz, bu yüzden
          // yarım dosya silinir ve kullanıcı katmanı kapalı görür.
          if ((demError as Error)?.name === 'AbortError') throw demError;
          this.storage.remove(demName);
          demBytes = 0;
        }
      }

      const sizeMb = Math.round(((bytes + demBytes) / 1024 / 1024) * 10) / 10;
      const at = new Date().toISOString();
      this.storage.writeMeta(packMetaName(pack.id), {
        version: remoteVersion,
        sizeMb,
        updatedAt: at,
      });
      if (demBytes > 0) {
        this.storage.writeMeta(demMetaName(pack.id), {
          version: remoteVersion,
          sizeMb: Math.round((demBytes / 1024 / 1024) * 10) / 10,
          updatedAt: at,
        });
      }
      this.emit(pack.id, 1);
      return packReducer(pack, {
        type: 'complete',
        version: remoteVersion,
        sizeMb,
        localPath: this.storage.uri(fileName),
        at,
      });
    } catch (error) {
      const aborted = (error as Error)?.name === 'AbortError';
      this.storage.remove(fileName);
      this.storage.remove(demName);
      this.storage.remove(demMetaName(pack.id));
      return packReducer({ ...pack, status: 'downloading' }, { type: aborted ? 'cancel' : 'fail' });
    } finally {
      this.running.delete(pack.id);
    }
  }

  /** Süren indirmeyi iptal eder; indirme yoksa `false`. */
  cancel(packId: ID): boolean {
    const controller = this.running.get(packId);
    if (!controller) return false;
    controller.abort();
    this.running.delete(packId);
    return true;
  }

  /** Paketi ve künyesini siler; sürerken çağrılırsa önce iptal eder. */
  async remove(pack: MapPack): Promise<MapPack> {
    this.cancel(pack.id);
    this.storage.remove(packFileName(pack.id));
    this.storage.remove(packMetaName(pack.id));
    // DEM ayrı dosyadır; silinmezse disk kullanımı yalan söyler ve kullanıcı
    // "sildim ama yer açılmadı" der.
    this.storage.remove(demFileName(pack.id));
    this.storage.remove(demMetaName(pack.id));
    return packReducer(pack, { type: 'remove' });
  }

  /** Süren indirme var mı? */
  isDownloading(packId: ID): boolean {
    return this.running.has(packId);
  }
}

/** Uygulama genelinde tek yönetici (ekranlar ve depo bunu kullanır). */
let shared: MapPackManager | null = null;
export function getPackManager(options?: PackManagerOptions): MapPackManager {
  if (options) {
    shared = new MapPackManager(options);
    return shared;
  }
  if (!shared) shared = new MapPackManager();
  return shared;
}

/** Testler için tekil yöneticiyi sıfırlar. */
export function resetPackManager() {
  shared = null;
}
