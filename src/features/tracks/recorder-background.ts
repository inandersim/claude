/**
 * Arka planda iz kaydı — ekran kapalıyken de nokta toplar.
 *
 * Sorun: `Location.watchPositionAsync` yalnızca uygulama önplandayken çalışır.
 * Yürüyüşçü telefonu cebine koyunca kayıt sessizce duruyordu; bir yürüyüş
 * uygulamasının en temel işlevi buydu.
 *
 * Çözüm: `expo-location`'ın görev tabanlı akışı. `startLocationUpdatesAsync`
 * bir **ön plan servisi** açar (kalıcı bildirim) ve konumları
 * `expo-task-manager` görevine iletir. Ön plan servisi bilinçli bir tercih:
 * Android'de `ACCESS_BACKGROUND_LOCATION` istemek Play tarafında ayrı bir
 * politika incelemesi (video, gerekçe) gerektirir; kalıcı bildirimli servis ise
 * kullanıcıya kaydın açık olduğunu **görünür** kılar. Gizli takip yok.
 *
 * Görev ayrı bir JS bağlamında çalışır ve React durumuna yazamaz; noktaları
 * `recorder-buffer` üzerinden diske ekler, kancalar oradan okur.
 *
 * Her şey hataya dayanıklı: modül yoksa (Expo Go, web), izin verilmediyse ya da
 * servis açılamadıysa `false` döner ve kayıt bugünkü ön plan davranışına düşer.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import type { TrackPoint } from '@/domain';

import { createFileBuffer } from './recorder-store';

/** Görev adı kalıcıdır: işletim sistemi uygulamayı bu adla yeniden uyandırır. */
export const TRACK_TASK = 'zirtan-iz-kaydi';

/** Konum örnekleme ayarları — ön plan dinleyicisiyle aynı olmalı. */
export const KAYIT_AYARI = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 5,
  timeInterval: 2000,
} as const;

interface KonumOlayi {
  locations?: {
    coords: { latitude: number; longitude: number; altitude: number | null };
    timestamp: number;
  }[];
}

/** Ham görev verisini `TrackPoint` dizisine çevirir (saf — test edilebilir). */
export function olaydanNoktalar(veri: unknown): TrackPoint[] {
  const olay = veri as KonumOlayi | null;
  if (!olay?.locations?.length) return [];
  return olay.locations
    .filter((l) => Number.isFinite(l?.coords?.latitude) && Number.isFinite(l?.coords?.longitude))
    .map((l) => ({
      latitude: l.coords.latitude,
      longitude: l.coords.longitude,
      elevationM: l.coords.altitude ?? null,
      t: l.timestamp,
    }));
}

/**
 * Görevi tanımlar.
 *
 * **Modül yüklenirken** çağrılmak zorunda: işletim sistemi uygulamayı soğuk
 * başlattığında görev daha React ağacı kurulmadan tetiklenebilir. Bu yüzden
 * dosyanın altında bir kez çalıştırılıyor, kanca içinde değil.
 */
function goreviTanimla() {
  if (Platform.OS === 'web') return;
  try {
    if (TaskManager.isTaskDefined(TRACK_TASK)) return;
    TaskManager.defineTask(TRACK_TASK, async ({ data, error }) => {
      if (error) return;
      const noktalar = olaydanNoktalar(data);
      if (!noktalar.length) return;
      try {
        createFileBuffer().append(noktalar);
      } catch {
        // Disk yazılamıyorsa kayıt ön planda sürüyor; görevi çökertmenin
        // anlamı yok.
      }
    });
  } catch {
    // `expo-task-manager` yerel modülü yok (Expo Go): arka plan kaydı kapalı.
  }
}

goreviTanimla();

/** Arka plan kaydı bu ortamda mümkün mü? */
export async function arkaPlanMumkun(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await Location.hasServicesEnabledAsync().then(
      (acik) => acik && TaskManager.isTaskDefined(TRACK_TASK),
    );
  } catch {
    return false;
  }
}

export async function arkaPlanCalisiyor(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TRACK_TASK);
  } catch {
    return false;
  }
}

/**
 * Bu platformda arka plan kaydı ayrı bir "her zaman" konum izni ister mi?
 *
 * **Android: hayır.** Kalıcı bildirimli ön plan servisi yeterli;
 * `ACCESS_BACKGROUND_LOCATION` bilerek istenmiyor (Play tarafında ayrı politika
 * incelemesi açıyor). Üstelik izin manifestte tanımlı olmadığı için
 * `requestBackgroundPermissionsAsync` burada **reddedilmiş** döner — çağırmak
 * özelliği sessizce kapatırdı.
 *
 * **iOS: evet.** Arka planda konum yalnızca "Her zaman" izniyle mümkün
 * (`UIBackgroundModes: location` ile birlikte).
 */
export function ayriIzinGerekir(platform: string = Platform.OS): boolean {
  return platform === 'ios';
}

export interface ArkaPlanMetni {
  /** Kalıcı bildirimin başlığı (ör. "Zirtan iz kaydı") */
  baslik: string;
  /** Bildirim gövdesi — kaydın açık olduğunu açıkça söylemeli */
  govde: string;
}

/**
 * Arka plan kaydını başlatır. Başarısızlıkta `false` döner; çağıran ön plan
 * dinleyicisiyle devam eder.
 */
export async function arkaPlaniBaslat(metin: ArkaPlanMetni): Promise<boolean> {
  if (!(await arkaPlanMumkun())) return false;
  try {
    if (await arkaPlanCalisiyor()) return true;
    if (ayriIzinGerekir()) {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') return false;
    }
    await Location.startLocationUpdatesAsync(TRACK_TASK, {
      ...KAYIT_AYARI,
      // Kalıcı bildirim: kullanıcı kaydın açık olduğunu her an görür ve
      // buradan uygulamaya dönebilir.
      foregroundService: {
        notificationTitle: metin.baslik,
        notificationBody: metin.govde,
        killServiceOnDestroy: false,
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** Arka plan kaydını durdurur; çalışmıyorsa sessizce geçer. */
export async function arkaPlaniDurdur(): Promise<void> {
  try {
    if (await arkaPlanCalisiyor()) await Location.stopLocationUpdatesAsync(TRACK_TASK);
  } catch {
    /* zaten durmuş */
  }
}
