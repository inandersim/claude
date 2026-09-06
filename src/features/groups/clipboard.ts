import { Share } from 'react-native';

/**
 * Panoya kopyalama: web'de `navigator.clipboard`; yerelde pano modülü yoksa
 * paylaşım sayfasına düşer. Başarıyla kopyalandıysa `true` döner.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    const nav = (
      globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }
    ).navigator;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // web panosu erişilemez olabilir
  }
  try {
    await Share.share({ message: text });
  } catch {
    // paylaşım desteklenmiyor olabilir
  }
  return false;
}
