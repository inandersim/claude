import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  MODULLER,
  V1_KAPSAMI,
  aktifKapsam,
  modulAcik,
  rotaAcik,
  rotaninModulu,
  type Modul,
} from '@/core/flags';

const KOK = resolve(__dirname, '../../..');

describe('kapsam anahtarı', () => {
  it('varsayılan `full` — bayrak bugün hiçbir şeyi gizlemiyor', () => {
    // Mekanizma hazır, daraltma kararı ayrı bir adım. Varsayılan değişirse
    // kullanıcılar bir sürümde modüllerin yarısını kaybeder.
    expect(aktifKapsam({})).toBe('full');
    expect(aktifKapsam({ EXPO_PUBLIC_LAUNCH_SCOPE: '' })).toBe('full');
    expect(aktifKapsam({ EXPO_PUBLIC_LAUNCH_SCOPE: 'tam' })).toBe('full');
    expect(aktifKapsam({ EXPO_PUBLIC_LAUNCH_SCOPE: ' v1 ' })).toBe('v1');
  });

  it('full kapsamda her modül açık', () => {
    for (const modul of MODULLER) expect(modulAcik(modul, 'full')).toBe(true);
  });

  it('v1 kapsamında yalnızca listedekiler açık', () => {
    for (const modul of MODULLER) {
      expect(modulAcik(modul, 'v1')).toBe(V1_KAPSAMI.includes(modul));
    }
  });
});

describe('modül listesi gerçekle uyuşuyor', () => {
  it('src/features altındaki her klasör listede', () => {
    // Yeni modül eklenip listeye yazılmazsa kapsam anahtarı onu hiç görmez.
    const klasorler = readdirSync(resolve(KOK, 'src/features'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect([...MODULLER].sort()).toEqual(klasorler);
  });

  it('v1 listesindeki her modül gerçekten var', () => {
    for (const modul of V1_KAPSAMI) expect(MODULLER).toContain(modul);
  });

  it('v1 çekirdek döngüyü eksiksiz taşıyor', () => {
    // Giriş → harita → iz kaydı → tehlike → birlikte çık → profil.
    for (const gerekli of ['auth', 'maps', 'tracks', 'hazards', 'zmatch', 'profile'] as Modul[]) {
      expect(V1_KAPSAMI).toContain(gerekli);
    }
  });
});

describe('rota eşlemesi', () => {
  it('alt rota modül köküne düşer', () => {
    expect(rotaninModulu('/tracks/record')).toBe('tracks');
    expect(rotaninModulu('/maps/planner')).toBe('maps');
    expect(rotaninModulu('/assistant/vision')).toBe('ai');
    expect(rotaninModulu('/first-aid/contacts')).toBe('firstaid');
  });

  it('sorgu ve çapa yolu bozmuyor', () => {
    expect(rotaninModulu('/tv?tab=live')).toBe('tv');
    expect(rotaninModulu('/kids#bolum')).toBe('kids');
    expect(rotaninModulu('tracks')).toBe('tracks');
  });

  it('tanınmayan yol null döner ve **açık** sayılır', () => {
    // Kapsam bir güvenlik sınırı değil ürün kararı; eşlemesi olmayan yeni bir
    // rota uygulamayı sessizce kırmamalı.
    expect(rotaninModulu('/')).toBeNull();
    expect(rotaninModulu('/settings')).toBeNull();
    expect(rotaAcik('/settings', 'v1')).toBe(true);
  });

  it('v1 kapsamında kapalı modülün rotası engellenir', () => {
    expect(rotaAcik('/tracks/record', 'v1')).toBe(true);
    expect(rotaAcik('/tv', 'v1')).toBe(false);
    expect(rotaAcik('/telemed/doctor/5', 'v1')).toBe(false);
  });
});

describe('gezinme girişleri kapsamla uyumlu', () => {
  it('keşif ızgarasındaki her bağlantı bir modüle eşleniyor', () => {
    // Eşlenemeyen bağlantı, kapsam daraltıldığında ölü bir kutucuk bırakır.
    const src = readFileSync(resolve(KOK, 'src/app/(app)/(tabs)/explore.tsx'), 'utf8');
    const hrefler = [...src.matchAll(/href: '(\/[^']+)'/g)].map((m) => m[1]!);
    expect(hrefler.length).toBeGreaterThan(10);
    for (const href of hrefler) {
      expect({ href, modul: rotaninModulu(href) }).toEqual({ href, modul: expect.any(String) });
    }
  });
});
