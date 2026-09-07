/**
 * Nokta tamponunun dosya sistemi uygulaması.
 *
 * Ayrı dosyada çünkü hem kanca (React bağlamı) hem de arka plan görevi (ayrı JS
 * bağlamı) aynı dosyaya yazıyor; ikisinin de `expo-file-system` dışında bir
 * bağımlılığı olmamalı.
 */
import { Directory, File, Paths } from 'expo-file-system';

import type { TrackPoint } from '@/domain';

import { decodePoints, encodePoints, type PointBuffer } from './recorder-buffer';

const DIR = 'iz-kaydi';
const FILE = 'aktif.jsonl';

/**
 * Diskteki tampon. Aynı dosyaya iki bağlam da ekleme yapar; JSON Lines biçimi
 * bunu güvenli kılıyor (satır sonuna ekleme, yarım satır atılıyor).
 */
export function createFileBuffer(dirName = DIR, fileName = FILE): PointBuffer {
  const dir = () => new Directory(Paths.document, dirName);
  const file = () => new File(dir(), fileName);
  const ensure = () => {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true });
  };
  return {
    append(points: TrackPoint[]) {
      if (!points.length) return;
      ensure();
      const f = file();
      const onceki = f.exists ? f.textSync() : '';
      // `expo-file-system` ekleme kipi sunmuyor; dosya kayıt boyunca birkaç yüz
      // KB'ı geçmediği için oku-yaz kabul edilebilir. Yüz binlerce noktaya
      // çıkarsa parçalı dosyaya geçilmeli.
      f.write(onceki + encodePoints(points));
    },
    readAll() {
      const f = file();
      if (!f.exists) return [];
      try {
        return decodePoints(f.textSync());
      } catch {
        return [];
      }
    },
    clear() {
      const f = file();
      if (f.exists) f.delete();
    },
  };
}
