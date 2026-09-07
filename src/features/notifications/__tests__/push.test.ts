import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  TOKEN_TAVANI,
  gecerliToken,
  tokenCikar,
  tokenEkle,
  tokenListesiAyni,
} from '@/domain/push';
import { KANALLAR, pushMumkun } from '@/features/notifications/push';

const KOK = resolve(__dirname, '../../../..');
const T = (n: number) => `ExponentPushToken[cihaz-${n}]`;

describe('adres listesi', () => {
  it('yeni adres başa gelir — dağıtım önce en taze cihazı dener', () => {
    expect(tokenEkle([T(1), T(2)], T(3))).toEqual([T(3), T(1), T(2)]);
  });

  it('aynı adres iki kez kaydedilirse yinelenmez, öne taşınır', () => {
    // Uygulama her açılışta kaydediyor; liste şişmemeli.
    expect(tokenEkle([T(1), T(2), T(3)], T(3))).toEqual([T(3), T(1), T(2)]);
  });

  it('tavan aşılmaz — ölü cihazlar sonsuza kadar birikmesin', () => {
    let liste: string[] = [];
    for (let i = 0; i < TOKEN_TAVANI + 4; i += 1) liste = tokenEkle(liste, T(i));
    expect(liste).toHaveLength(TOKEN_TAVANI);
    expect(liste[0]).toBe(T(TOKEN_TAVANI + 3));
  });

  it('boş adres listeyi bozmaz', () => {
    expect(tokenEkle([T(1)], '   ')).toEqual([T(1)]);
  });

  it('çıkarma yalnızca eşleşeni siler', () => {
    expect(tokenCikar([T(1), T(2)], T(1))).toEqual([T(2)]);
    expect(tokenCikar([T(1)], T(9))).toEqual([T(1)]);
  });

  it('liste karşılaştırması gereksiz yazmayı önler', () => {
    expect(tokenListesiAyni([T(1), T(2)], [T(1), T(2)])).toBe(true);
    expect(tokenListesiAyni([T(1), T(2)], [T(2), T(1)])).toBe(false);
    expect(tokenListesiAyni([], [])).toBe(true);
  });
});

describe('adres biçimi', () => {
  it('geçerli Expo adresi kabul edilir', () => {
    expect(gecerliToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
    expect(gecerliToken('  ExponentPushToken[abc]  ')).toBe(true);
  });

  it('bozuk adres reddedilir — dağıtım kuyruğunu her turda hataya sokardı', () => {
    for (const bozuk of ['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[a b]', 'FCM[abc]']) {
      expect(gecerliToken(bozuk)).toBe(false);
    }
  });
});

describe('platform ve kanal', () => {
  it('push yalnızca yerel platformlarda mümkün', () => {
    expect(pushMumkun('ios')).toBe(true);
    expect(pushMumkun('android')).toBe(true);
    expect(pushMumkun('web')).toBe(false);
  });

  it('kanal adları dağıtım fonksiyonuyla birebir aynı', () => {
    // Uyuşmazsa bildirim varsayılan kanala düşer ve acil uyarı sessizce
    // önceliğini kaybeder — çökme yok, sadece SOS titremez.
    const fanout = readFileSync(
      resolve(KOK, 'supabase/functions/push-fanout/index.ts'),
      'utf8',
    );
    expect(fanout).toContain(`'${KANALLAR.acil}'`);
    expect(fanout).toContain(`'${KANALLAR.genel}'`);
  });
});

describe('sunucu sözleşmesi', () => {
  it('dağıtım adresleri ayrı tablodan okuyor — profil sütunundan değil', () => {
    // Sütun `profiles` üzerindeyken RLS satır düzeyinde olduğu için `anon`
    // dahil herkes bütün cihaz adreslerini çekebiliyordu (migration 0036).
    const fanout = readFileSync(
      resolve(KOK, 'supabase/functions/push-fanout/index.ts'),
      'utf8',
    );
    expect(fanout).toContain("from('push_tokens')");
    expect(fanout).not.toContain('push_tokens as string[]');
  });

  it('migration sızıntının kaynağını kaldırıyor ve RLS kuruyor', () => {
    const migration = readFileSync(
      resolve(KOK, 'supabase/migrations/0036_push_tokens.sql'),
      'utf8',
    );
    expect(migration).toContain('ALTER TABLE profiles DROP COLUMN IF EXISTS push_tokens');
    const rls = readFileSync(resolve(KOK, 'supabase/migrations/0100_rls.sql'), 'utf8');
    expect(rls).toContain("rls_owner_all('push_tokens')");
  });
});
