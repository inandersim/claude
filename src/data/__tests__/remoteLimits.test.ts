import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { VARSAYILAN_TAVAN, rows, maybeRow } from '@/data/remote/postgrest';

const REPO_DIR = resolve(__dirname, '../remote/repos');
const repoDosyalari = readdirSync(REPO_DIR).filter((f) => f.endsWith('.ts'));

/** Sahte sorgu kurucusu: hangi sınırın uygulandığını kaydeder. */
function sahteSorgu(veri: unknown[] = []) {
  const cagrilar: { limit: number[]; range: [number, number][] } = { limit: [], range: [] };
  const builder = {
    cagrilar,
    limit(n: number) {
      cagrilar.limit.push(n);
      return builder;
    },
    range(a: number, b: number) {
      cagrilar.range.push([a, b]);
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: veri[0] ?? null, error: null });
    },
    then(çöz: (v: unknown) => unknown) {
      return Promise.resolve({ data: veri, error: null }).then(çöz);
    },
  };
  return builder;
}

describe('liste sorgularının tavanı', () => {
  it('sınır verilmezse varsayılan tavan uygulanır', async () => {
    const q = sahteSorgu([{ id: 1 }]);
    await rows(q as never, 'test');
    expect(q.cagrilar.limit).toEqual([VARSAYILAN_TAVAN]);
  });

  it('açık sınır varsayılanın yerine geçer', async () => {
    const q = sahteSorgu();
    await rows(q as never, 'test', { limit: 40 });
    expect(q.cagrilar.limit).toEqual([40]);
  });

  it('`limit: null` bilinçli sınırsızdır — hiç limit uygulanmaz', async () => {
    const q = sahteSorgu();
    await rows(q as never, 'test', { limit: null });
    expect(q.cagrilar.limit).toEqual([]);
  });

  it('range verilirse limit yerine ofsetli sayfalama kullanılır', async () => {
    const q = sahteSorgu();
    await rows(q as never, 'test', { range: [20, 39] });
    expect(q.cagrilar.range).toEqual([[20, 39]]);
    expect(q.cagrilar.limit).toEqual([]);
  });

  it('maybeRow sınırı zincir yerine seçenekten alır', async () => {
    const q = sahteSorgu([{ id: 7 }]);
    const row = await maybeRow(q as never, 'test', { limit: 1 });
    expect(q.cagrilar.limit).toEqual([1]);
    expect(row).toEqual({ id: 7 });
  });

  it('varsayılan tavan makul bir emniyet ağı — sayfa boyu değil', () => {
    // Ölçülen: akış satırı ~2 KB. Tavan × 2 KB istek başına indirilen en kötü
    // durumdur; büyütmeden önce docs/SCALE.md içindeki hesap güncellenmeli.
    expect(VARSAYILAN_TAVAN).toBeGreaterThanOrEqual(50);
    expect(VARSAYILAN_TAVAN).toBeLessThanOrEqual(200);
  });
});

describe('kural: repository katmanında .limit()/.range() zincirlenmez', () => {
  // Neden kural: sınır zincirde verilirse `rows()` içindeki varsayılan tavan
  // onu **genişletebilir** (zincirdeki 20, tavandaki 200 ile ezilir). Sınırın
  // tek kapıdan geçmesi bu sessiz hatayı imkânsız kılıyor — ve tüm sorguların
  // tavanı tek yerden denetlenebiliyor.
  it.each(repoDosyalari)('%s zincirlenmiş sınır içermiyor', (dosya) => {
    const src = readFileSync(resolve(REPO_DIR, dosya), 'utf8');
    const ihlaller = src
      .split('\n')
      .map((satir, i) => ({ satir: satir.trim(), no: i + 1 }))
      .filter(({ satir }) => /^\.(limit|range)\(/.test(satir) || /\)\.(limit|range)\(/.test(satir));
    expect(ihlaller.map((v) => `${dosya}:${v.no} ${v.satir}`)).toEqual([]);
  });

  it('en az bir repository dosyası tarandı (test boşa dönmesin)', () => {
    expect(repoDosyalari.length).toBeGreaterThan(10);
  });
});
