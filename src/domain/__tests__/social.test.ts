import {
  activeToken,
  applyFeedFilter,
  applyReactionChange,
  canDelete,
  matchUsers,
  parseHashtags,
  parseMentions,
  popularPosts,
  postImages,
  postKindOf,
  reactionSummary,
  renderSegments,
  replaceActiveToken,
  suggestedUsers,
  trendingHashtags,
  validateStatusInput,
} from '../social';
import type { Follow, Post, Reaction } from '../types';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-06T12:00:00.000Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const post = (o: Partial<Post> & { id: string; authorId: string }): Post => ({
  imageUrl: null,
  caption: '',
  adventureType: 'hiking',
  difficulty: 'easy',
  altitudeM: 0,
  distanceKm: 0,
  temperatureC: 18,
  windKmh: 0,
  trailCondition: 'good',
  durationMin: 0,
  locationName: 'İstanbul',
  coords: { latitude: 41, longitude: 29 },
  likesCount: 0,
  commentsCount: 0,
  isVerifiedInfo: false,
  routeId: null,
  createdAt: iso(1),
  ...o,
});

const users = [
  { id: 'u_me', username: 'deniz.kaya', displayName: 'Deniz Kaya', followersCount: 10 },
  { id: 'u_elif', username: 'elif.dogan', displayName: 'Elif Doğan', followersCount: 40 },
  { id: 'u_can', username: 'can.yildirim', displayName: 'Can Yıldırım', followersCount: 30 },
];

describe('parseHashtags', () => {
  it('Türkçe karakterli etiketleri küçük harfle ve tekil döner', () => {
    expect(parseHashtags('Zirtan #Kaçkar #KAMPATEŞİ #kaçkar ve #Çığ_riski!')).toEqual([
      'kaçkar',
      'kampateşi',
      'çığ_riski',
    ]);
  });
  it('etiket yoksa boş dizi', () => {
    expect(parseHashtags('sadece metin # boşluk')).toEqual([]);
  });
});

describe('parseMentions', () => {
  it('kullanıcı adlarını kimliğe çevirir, bilinmeyenleri atlar', () => {
    expect(parseMentions('Selam @elif.dogan ve @Can.Yildirim, @yok.biri.', users)).toEqual([
      'u_elif',
      'u_can',
    ]);
  });
  it('sondaki noktayı kullanıcı adına dahil etmez', () => {
    expect(parseMentions('Teşekkürler @elif.dogan.', users)).toEqual(['u_elif']);
  });
});

describe('renderSegments', () => {
  it('metni düz / etiket / bahsetme parçalarına böler', () => {
    expect(renderSegments('Bugün #Kaçkar ile @elif.dogan harika!')).toEqual([
      { kind: 'text', text: 'Bugün ' },
      { kind: 'hashtag', text: '#Kaçkar', tag: 'kaçkar' },
      { kind: 'text', text: ' ile ' },
      { kind: 'mention', text: '@elif.dogan', username: 'elif.dogan' },
      { kind: 'text', text: ' harika!' },
    ]);
  });
  it('düz metin tek parça döner', () => {
    expect(renderSegments('merhaba')).toEqual([{ kind: 'text', text: 'merhaba' }]);
  });
});

describe('activeToken / replaceActiveToken', () => {
  it('imlecin bulunduğu # ya da @ kelimesini bulur', () => {
    expect(activeToken('selam #ka', 9)).toEqual({ kind: 'hashtag', query: 'ka', start: 6 });
    expect(activeToken('selam @el', 9)).toEqual({ kind: 'mention', query: 'el', start: 6 });
    expect(activeToken('selam ka', 8)).toBeNull();
  });
  it('aktif kelimeyi öneriyle değiştirir', () => {
    expect(replaceActiveToken('selam #ka sonra', 9, '#kaçkar')).toEqual({
      text: 'selam #kaçkar  sonra',
      cursor: 14,
    });
  });
});

describe('reactionSummary', () => {
  const reactions: Pick<Reaction, 'type'>[] = [
    { type: 'fire' },
    { type: 'fire' },
    { type: 'love' },
    { type: 'wow' },
    { type: 'wow' },
    { type: 'wow' },
    { type: 'strong' },
  ];
  it('sayılar, toplam ve en çok 3 tür', () => {
    const s = reactionSummary(reactions);
    expect(s.total).toBe(7);
    expect(s.counts).toEqual({ like: 0, love: 1, wow: 3, fire: 2, strong: 1 });
    expect(s.top).toEqual(['wow', 'fire', 'love']);
  });
  it('sayım tablosundan da çalışır ve boş girdiyi tolere eder', () => {
    expect(reactionSummary({ like: 4, fire: 1 }).top).toEqual(['like', 'fire']);
    expect(reactionSummary(null).total).toBe(0);
  });
  it('applyReactionChange iyimser sayaçları günceller', () => {
    const base: Pick<FeedPost, 'myReaction' | 'reactionCounts' | 'likesCount' | 'likedByMe'> = {
      myReaction: null,
      reactionCounts: { like: 2 },
      likesCount: 2,
      likedByMe: false,
    };
    const fired = applyReactionChange(base, 'fire');
    expect(fired.likesCount).toBe(3);
    expect(fired.reactionCounts?.fire).toBe(1);
    expect(fired.likedByMe).toBe(true);
    const switched = applyReactionChange(fired, 'love');
    expect(switched.likesCount).toBe(3);
    expect(switched.reactionCounts?.fire).toBe(0);
    expect(switched.reactionCounts?.love).toBe(1);
    const removed = applyReactionChange(switched, null);
    expect(removed.likesCount).toBe(2);
    expect(removed.myReaction).toBeNull();
  });
});

describe('applyFeedFilter', () => {
  const follows: Follow[] = [{ followerId: 'u_me', followingId: 'u_elif', createdAt: iso(10) }];
  const posts = [
    post({ id: 'a1', authorId: 'u_can', createdAt: iso(0.5) }),
    post({
      id: 's1',
      authorId: 'u_elif',
      kind: 'status',
      hashtags: ['kaçkar'],
      createdAt: iso(0.2),
    }),
    post({ id: 'ph', authorId: 'u_me', kind: 'photo', hashtags: ['kamp'], createdAt: iso(2) }),
    post({ id: 'a2', authorId: 'u_elif', kind: 'adventure', createdAt: iso(3) }),
  ];
  it('tümü tarihe göre azalan', () => {
    expect(applyFeedFilter(posts, { tab: 'all' }, follows, 'u_me').map((p) => p.id)).toEqual([
      's1',
      'a1',
      'ph',
      'a2',
    ]);
  });
  it('takip: takip edilenler ve kendisi', () => {
    expect(applyFeedFilter(posts, { tab: 'following' }, follows, 'u_me').map((p) => p.id)).toEqual([
      's1',
      'ph',
      'a2',
    ]);
  });
  it('maceralar yalnızca kind yok/adventure', () => {
    expect(applyFeedFilter(posts, { tab: 'adventures' }, follows, 'u_me').map((p) => p.id)).toEqual(
      ['a1', 'a2'],
    );
  });
  it('durumlar status+photo', () => {
    expect(applyFeedFilter(posts, { tab: 'status' }, follows, 'u_me').map((p) => p.id)).toEqual([
      's1',
      'ph',
    ]);
  });
  it('etiket filtresi büyük/küçük harf duyarsız', () => {
    expect(
      applyFeedFilter(posts, { tab: 'all', hashtag: '#KAÇKAR' }, follows, 'u_me').map((p) => p.id),
    ).toEqual(['s1']);
  });
});

describe('trendingHashtags', () => {
  it('son 7 gün ağırlıklı sıralar ve trend işaretler', () => {
    const posts = [
      post({ id: '1', authorId: 'a', hashtags: ['kamp'], createdAt: iso(1) }),
      post({ id: '2', authorId: 'a', hashtags: ['kamp', 'dalış'], createdAt: iso(2) }),
      post({ id: '3', authorId: 'a', hashtags: ['kaçkar'], createdAt: iso(20) }),
      post({ id: '4', authorId: 'a', hashtags: ['kaçkar'], createdAt: iso(25) }),
      post({ id: '5', authorId: 'a', hashtags: ['kaçkar'], createdAt: iso(30) }),
      post({ id: '6', authorId: 'a', hashtags: ['dalış'], createdAt: iso(15) }),
    ];
    const result = trendingHashtags(posts, NOW, 10);
    expect(result.map((h) => h.tag)).toEqual(['kamp', 'kaçkar', 'dalış']);
    expect(result.find((h) => h.tag === 'kamp')).toEqual({ tag: 'kamp', count: 2, trending: true });
    expect(result.find((h) => h.tag === 'kaçkar')?.trending).toBe(false);
    expect(result.find((h) => h.tag === 'dalış')?.trending).toBe(true);
  });
  it('limit uygular', () => {
    const posts = [post({ id: '1', authorId: 'a', hashtags: ['a', 'b', 'c'], createdAt: iso(1) })];
    expect(trendingHashtags(posts, NOW, 2)).toHaveLength(2);
  });
});

describe('yardımcılar', () => {
  it('canDelete yalnızca yazar', () => {
    expect(canDelete({ authorId: 'u_me' }, 'u_me')).toBe(true);
    expect(canDelete({ authorId: 'u_elif' }, 'u_me')).toBe(false);
  });
  it('postKindOf ve postImages', () => {
    expect(postKindOf({})).toBe('adventure');
    expect(postKindOf({ kind: 'photo' })).toBe('photo');
    expect(postImages({ imageUrl: 'a', images: [] })).toEqual(['a']);
    expect(postImages({ imageUrl: 'a', images: ['b', 'c'] })).toEqual(['b', 'c']);
    expect(postImages({ imageUrl: null })).toEqual([]);
  });
  it('validateStatusInput', () => {
    expect(validateStatusInput({ caption: '  ', imageUris: [] })).toBe('captionRequired');
    expect(validateStatusInput({ caption: '', imageUris: ['x'] })).toBeNull();
    expect(validateStatusInput({ caption: 'a', imageUris: Array(6).fill('x') })).toBe(
      'photosLimit',
    );
  });
  it('popularPosts etkileşime göre sıralar', () => {
    const a = { id: 'a', likesCount: 2, commentsCount: 0, reactionCounts: { like: 2 } };
    const b = { id: 'b', likesCount: 1, commentsCount: 3, reactionCounts: { like: 1 } };
    expect(popularPosts([a, b], 5).map((p) => p.id)).toEqual(['b', 'a']);
  });
  it('suggestedUsers takip edilmeyenleri gönderi sayısına göre sıralar', () => {
    const follows: Follow[] = [{ followerId: 'u_me', followingId: 'u_elif', createdAt: iso(1) }];
    const posts = [post({ id: '1', authorId: 'u_can' }), post({ id: '2', authorId: 'u_elif' })];
    expect(suggestedUsers(users, posts, follows, 'u_me', 5).map((u) => u.id)).toEqual(['u_can']);
  });
  it('matchUsers ön ek eşleşmesini öne alır', () => {
    expect(matchUsers(users, '@el').map((u) => u.id)).toEqual(['u_elif']);
    expect(matchUsers(users, 'kay').map((u) => u.id)).toEqual(['u_me']);
    expect(matchUsers(users, '', 2)).toHaveLength(2);
  });
});
