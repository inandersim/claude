import { agHatasiMi, createRemoteContext, kuyrukluYaz } from '../remote/context';
import type { OfflineQueue, QueuedMutation } from '../remote/offline';
import type { SupabaseLike } from '../remote/postgrest';

/**
 * Çevrimdışı yazma kuyruğunun bağlantısı.
 *
 * `createOfflineQueue` — çakışma politikası belgelenmiş, testli, tam bir
 * kuyruk — hiçbir yerden çağrılmıyordu. Dağda şebeke yoktur: kaya düşmesi
 * bildiren ya da patikada çeşme işaretleyen kişi tam da sinyalin olmadığı
 * yerdedir. O kayıtlar hata verip kayboluyordu.
 *
 * Buradaki asıl sınav ayrımın doğruluğu: **ağ hatası** kuyruğa girer,
 * **mantık hatası** girmez. Yanlış sınıflandırma iki yönde de kötü —
 * geçersiz bir yazmayı kuyruğa almak onu sonsuza dek yeniden denetir; ağ
 * hatasını mantık hatası sanmak kullanıcının kaydını kaybeder.
 */
const sahteKuyruk = () => {
  const kayitlar: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts'>[] = [];
  const q: OfflineQueue = {
    enqueue: async (m) => {
      kayitlar.push(m);
      return { ...m, id: 'q1', createdAt: '', attempts: 0 } as QueuedMutation;
    },
    list: async () => [],
    size: async () => kayitlar.length,
    clear: async () => undefined,
    flush: async () => ({ sent: 0, conflicts: 0, rejected: 0, remaining: 0, details: [] }),
  };
  return { q, kayitlar };
};

const ctxKur = (kuyruk: OfflineQueue | null) => {
  const ctx = createRemoteContext({} as SupabaseLike);
  ctx.setKuyruk(kuyruk);
  return ctx;
};

const KAYIT = () => ({ kind: 'insert' as const, target: 'track_pois', payload: { id: 'p1' } });

describe('çevrimdışı yazma kuyruğu bağlantısı', () => {
  it('ağ varken doğrudan yazar, kuyruğa dokunmaz', async () => {
    const { q, kayitlar } = sahteKuyruk();
    const sonuc = await kuyrukluYaz(ctxKur(q), async () => undefined, KAYIT);
    expect(sonuc).toBe('gonderildi');
    expect(kayitlar).toHaveLength(0);
  });

  it('ağ hatasında kuyruğa alır ve kaybetmez', async () => {
    const { q, kayitlar } = sahteKuyruk();
    const sonuc = await kuyrukluYaz(
      ctxKur(q),
      async () => {
        throw new Error('Network request failed');
      },
      KAYIT,
    );
    expect(sonuc).toBe('kuyrukta');
    expect(kayitlar).toEqual([{ kind: 'insert', target: 'track_pois', payload: { id: 'p1' } }]);
  });

  it('mantık hatasını kuyruğa ALMAZ — çağırana fırlatır', async () => {
    // Yetki/doğrulama hatası tekrar denenince de aynı sonucu verir;
    // kuyruğa alınırsa sonsuza dek denenir ve kullanıcı hatayı hiç görmez.
    const { q, kayitlar } = sahteKuyruk();
    await expect(
      kuyrukluYaz(
        ctxKur(q),
        async () => {
          throw new Error('new row violates row-level security policy');
        },
        KAYIT,
      ),
    ).rejects.toThrow('row-level security');
    expect(kayitlar).toHaveLength(0);
  });

  it('kuyruk tanımlı değilse eski davranış: hata çağırana gider', async () => {
    await expect(
      kuyrukluYaz(
        ctxKur(null),
        async () => {
          throw new Error('Network request failed');
        },
        KAYIT,
      ),
    ).rejects.toThrow('Network');
  });
});

describe('ağ hatası ayrımı', () => {
  it('ağ kaynaklı iletileri tanır', () => {
    for (const m of [
      'Network request failed',
      'fetch failed',
      'Failed to fetch',
      'ETIMEDOUT',
      'ECONNRESET',
      'getaddrinfo ENOTFOUND api.example.com',
      'Load failed',
    ]) {
      expect(agHatasiMi(new Error(m))).toBe(true);
    }
  });

  it('mantık hatalarını ağ hatası saymaz', () => {
    for (const m of [
      'new row violates row-level security policy',
      'duplicate key value violates unique constraint',
      'Nokta adı boş olamaz',
      'permission denied for table track_pois',
    ]) {
      expect(agHatasiMi(new Error(m))).toBe(false);
    }
  });

  it('hata nesnesi olmayan girdide çökmez', () => {
    expect(agHatasiMi(null)).toBe(false);
    expect(agHatasiMi(undefined)).toBe(false);
    expect(agHatasiMi('bir şeyler ters gitti')).toBe(false);
  });
});
