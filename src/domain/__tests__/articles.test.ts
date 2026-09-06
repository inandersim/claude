import {
  canEdit,
  excerpt,
  filterArticles,
  normalizeTags,
  parseArticleBody,
  parseTagInput,
  rankFeatured,
  readMinutes,
  relatedArticles,
  slugifyTitle,
  uniqueSlug,
  validateArticle,
  validateWriterApplication,
  wordCount,
  writerBadge,
} from '../articles';
import type { Article } from '../types';

const article = (o: Partial<Article>): Article => ({
  id: 'a',
  authorId: 'u_1',
  slug: 'a',
  title: 'Başlık',
  subtitle: '',
  coverUrl: null,
  category: 'guide',
  body: '',
  tags: [],
  destinationId: null,
  countryCode: null,
  adventureTypes: ['hiking'],
  readMinutes: 1,
  status: 'published',
  likesCount: 0,
  commentsCount: 0,
  viewsCount: 0,
  locale: 'tr',
  publishedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...o,
});

describe('slugifyTitle', () => {
  it('Türkçe karakterleri sadeleştirir ve noktalama temizler', () => {
    expect(slugifyTitle("Kaçkar'da kış geçişi: ekipman listesi")).toBe(
      'kackar-da-kis-gecisi-ekipman-listesi',
    );
    expect(slugifyTitle('İlk uzun bisiklet turum — Kapadokya!')).toBe(
      'ilk-uzun-bisiklet-turum-kapadokya',
    );
    expect(slugifyTitle('ÇĞIİÖŞÜ çğıiöşü')).toBe('cgiiosu-cgiiosu');
  });

  it('uniqueSlug çakışmada sayı ekler', () => {
    expect(uniqueSlug('ebc', ['x'])).toBe('ebc');
    expect(uniqueSlug('ebc', ['ebc'])).toBe('ebc-2');
    expect(uniqueSlug('ebc', ['ebc', 'ebc-2'])).toBe('ebc-3');
  });
});

describe('readMinutes / wordCount', () => {
  it('200 kelime/dk, en az 1', () => {
    expect(readMinutes('')).toBe(1);
    expect(readMinutes('kelime '.repeat(199))).toBe(1);
    expect(readMinutes('kelime '.repeat(500))).toBe(3);
    expect(wordCount('# Başlık\n\nbir iki üç\n- dört')).toBe(5);
  });
});

describe('parseArticleBody', () => {
  it('başlık, paragraf, liste, alıntı ve görsel bloklarını ayırır', () => {
    const body = [
      '# Ana başlık',
      '',
      'İlk paragraf birinci satır',
      'ikinci satır aynı paragraf',
      '',
      '## Alt başlık',
      '- madde bir',
      '- madde iki',
      '> alıntı bir',
      '> alıntı iki',
      '',
      '![Zirve](https://example.com/a.jpg)',
      'Son paragraf',
    ].join('\n');
    expect(parseArticleBody(body)).toEqual([
      { type: 'h1', text: 'Ana başlık' },
      { type: 'p', text: 'İlk paragraf birinci satır ikinci satır aynı paragraf' },
      { type: 'h2', text: 'Alt başlık' },
      { type: 'li', text: 'madde bir' },
      { type: 'li', text: 'madde iki' },
      { type: 'quote', text: 'alıntı bir alıntı iki' },
      { type: 'img', text: 'Zirve', url: 'https://example.com/a.jpg' },
      { type: 'p', text: 'Son paragraf' },
    ]);
  });

  it('CRLF ve boş gövdeyi tolere eder', () => {
    expect(parseArticleBody('')).toEqual([]);
    expect(parseArticleBody('a\r\n\r\nb')).toEqual([
      { type: 'p', text: 'a' },
      { type: 'p', text: 'b' },
    ]);
  });
});

describe('excerpt', () => {
  it('ilk paragrafı alır, uzunsa kelime sınırında keser', () => {
    expect(excerpt('# Başlık\n\nKısa özet.')).toBe('Kısa özet.');
    const long = 'kelime '.repeat(60).trim();
    const out = excerpt(long, 50);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out).not.toContain('kelim…');
  });
});

describe('filterArticles / rankFeatured', () => {
  const list = [
    article({ id: '1', title: 'Everest günlükleri', tags: ['nepal'], countryCode: 'NP' }),
    article({
      id: '2',
      title: 'Kaş dalış',
      category: 'trip_report',
      tags: ['Kaş'],
      authorId: 'u_2',
    }),
    article({ id: '3', title: 'Çığ', category: 'safety', status: 'featured', likesCount: 1 }),
  ];

  it('arama Türkçe küçük harfe duyarsız, etiket ve kategori filtreleri çalışır', () => {
    expect(filterArticles(list, { query: 'EVEREST' }).map((a) => a.id)).toEqual(['1']);
    expect(filterArticles(list, { tag: '#kaş' }).map((a) => a.id)).toEqual(['2']);
    expect(filterArticles(list, { category: 'safety' }).map((a) => a.id)).toEqual(['3']);
    expect(filterArticles(list, { authorId: 'u_2' }).map((a) => a.id)).toEqual(['2']);
    expect(filterArticles(list, { countryCode: 'NP' }).map((a) => a.id)).toEqual(['1']);
    expect(filterArticles(list, { featuredOnly: true }).map((a) => a.id)).toEqual(['3']);
  });

  it('öne çıkanlar önce, sonra beğeni + görüntülenme', () => {
    const ranked = rankFeatured([
      article({ id: 'a', likesCount: 10, viewsCount: 0 }),
      article({ id: 'b', status: 'featured', likesCount: 0 }),
      article({ id: 'c', likesCount: 0, viewsCount: 100 }),
    ]);
    expect(ranked.map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('relatedArticles', () => {
  it('aynı destinasyon/ülke/etiket puanlanır, taslak ve kendisi elenir', () => {
    const base = article({ id: 'base', destinationId: 'd1', countryCode: 'NP', tags: ['nepal'] });
    const all = [
      base,
      article({ id: 'same-dest', destinationId: 'd1', countryCode: 'NP' }),
      article({ id: 'same-country', countryCode: 'NP' }),
      article({ id: 'tag', tags: ['NEPAL'], category: 'gear' }),
      article({ id: 'none', category: 'gear' }),
      article({ id: 'draft', destinationId: 'd1', status: 'draft' }),
    ];
    expect(relatedArticles(base, all, 3).map((a) => a.id)).toEqual([
      'same-dest',
      'same-country',
      'tag',
    ]);
    expect(relatedArticles(base, all, 1)).toHaveLength(1);
  });
});

describe('validateArticle / canEdit / tags / writerBadge', () => {
  it('başlık ≥ 8, gövde ≥ 300', () => {
    expect(validateArticle({ title: 'Kısa', body: 'x'.repeat(300) })).toEqual({
      title: 'titleShort',
    });
    expect(validateArticle({ title: 'Yeterince uzun', body: 'x'.repeat(299) })).toEqual({
      body: 'bodyShort',
    });
    expect(validateArticle({ title: 'Yeterince uzun', body: 'x'.repeat(300) })).toEqual({});
  });

  it('yazar başvurusu doğrulaması', () => {
    expect(validateWriterApplication({ penName: 'ab', bio: 'kısa', topics: [] })).toEqual({
      penName: true,
      bio: true,
      topics: true,
    });
    expect(
      validateWriterApplication({ penName: 'Elif', bio: 'x'.repeat(40), topics: ['guide'] }),
    ).toEqual({});
  });

  it('canEdit yalnızca sahibi', () => {
    expect(canEdit({ authorId: 'u_1' }, 'u_1')).toBe(true);
    expect(canEdit({ authorId: 'u_1' }, 'u_2')).toBe(false);
  });

  it('etiketler normalize edilir ve sınırlandırılır', () => {
    expect(normalizeTags(['#Nepal', ' yüksek irtifa ', 'nepal', ''])).toEqual([
      'nepal',
      'yüksek-irtifa',
    ]);
    expect(parseTagInput('a, b,c\nd')).toEqual(['a', 'b', 'c', 'd']);
    expect(normalizeTags(Array.from({ length: 12 }, (_, i) => `t${i}`))).toHaveLength(8);
  });

  it('writerBadge öncelik sırası', () => {
    expect(writerBadge({ approvedAt: null, isVerified: true, followerCount: 5000 })).toBe(
      'pending',
    );
    expect(writerBadge({ approvedAt: 'x', isVerified: true, followerCount: 0 })).toBe('verified');
    expect(writerBadge({ approvedAt: 'x', isVerified: false, followerCount: 1000 })).toBe('top');
    expect(writerBadge({ approvedAt: 'x', isVerified: false, followerCount: 10 })).toBe('writer');
  });
});
