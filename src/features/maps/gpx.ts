import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

import { toGpx, type PlannedRoute } from '@/domain';

export type GpxShareResult = 'shared' | 'copied' | 'failed';

/** Dosya adı için güvenli slug */
function slugify(name: string): string {
  const base = name
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'rota';
}

/** Panoya kopyalama: web'de navigator.clipboard; yerelde expo-clipboard yoksa `false`. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const nav = (
      globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }
    ).navigator;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // pano erişimi yok
  }
  return false;
}

/**
 * Rotayı GPX olarak paylaşır: önbelleğe dosya yazıp sistem paylaşım sayfasını açar;
 * dosya yazılamazsa metin olarak paylaşır; o da olmazsa panoya kopyalar.
 */
export async function shareGpx(planned: PlannedRoute, name: string): Promise<GpxShareResult> {
  const gpx = toGpx(planned, name);
  const fileName = `${slugify(name)}.gpx`;

  if (Platform.OS !== 'web') {
    try {
      const file = new File(Paths.cache, fileName);
      file.write(gpx);
      await Share.share(
        Platform.OS === 'ios' ? { url: file.uri, title: name } : { message: gpx, title: name },
        { dialogTitle: name, subject: fileName },
      );
      return 'shared';
    } catch {
      // dosya sistemi yok ya da paylaşım iptal → aşağıdaki yedeklere düş
    }
  }

  try {
    await Share.share({ message: gpx, title: name });
    return 'shared';
  } catch {
    // web'de Share desteklenmeyebilir
  }
  return (await copyToClipboard(gpx)) ? 'copied' : 'failed';
}
