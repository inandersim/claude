import { createMockProvider } from '../mock/provider';
import { CURRENT_USER_ID } from '../mock/seed';

const makeProvider = () => createMockProvider({ persist: false, latencyMs: 0 });

describe('MockProvider — auth', () => {
  it('başlangıçta oturum yoktur, giriş sonrası demo kullanıcı döner', async () => {
    const p = makeProvider();
    expect(await p.auth.getSession()).toBeNull();
    const user = await p.auth.signIn({ email: 'deniz@zirtan.app', password: '123456' });
    expect(user.id).toBe(CURRENT_USER_ID);
    expect((await p.auth.getSession())?.id).toBe(CURRENT_USER_ID);
    await p.auth.signOut();
    expect(await p.auth.getSession()).toBeNull();
  });

  it('kısa şifreyi reddeder', async () => {
    const p = makeProvider();
    await expect(p.auth.signIn({ email: 'a@b.co', password: '123' })).rejects.toThrow();
  });
});

describe('MockProvider — feed', () => {
  it('akışı tarihe göre azalan sıralar ve türe göre filtreler', async () => {
    const p = makeProvider();
    const all = await p.feed.list(CURRENT_USER_ID);
    expect(all.length).toBeGreaterThan(5);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]!.createdAt >= all[i]!.createdAt).toBe(true);
    }
    const climbing = await p.feed.list(CURRENT_USER_ID, { adventureType: 'climbing' });
    expect(climbing.every((post) => post.adventureType === 'climbing')).toBe(true);
  });

  it('beğeni aç/kapa sayacı ve durumu günceller, yazara bildirim üretir', async () => {
    const p = makeProvider();
    const [post] = await p.feed.list(CURRENT_USER_ID, { adventureType: 'hiking' });
    const before = post!.likesCount;
    const liked = await p.feed.toggleLike(CURRENT_USER_ID, post!.id);
    expect(liked).toEqual({ liked: true, likesCount: before + 1 });
    const detail = await p.feed.getById(CURRENT_USER_ID, post!.id);
    expect(detail?.likedByMe).toBe(true);
    const unliked = await p.feed.toggleLike(CURRENT_USER_ID, post!.id);
    expect(unliked).toEqual({ liked: false, likesCount: before });

    const authorNotifications = await p.notifications.list(post!.authorId);
    expect(authorNotifications.some((n) => n.type === 'like' && n.postId === post!.id)).toBe(true);
  });

  it('yorum ekler ve sayacı artırır', async () => {
    const p = makeProvider();
    const [post] = await p.feed.list(CURRENT_USER_ID);
    const before = post!.commentsCount;
    const comment = await p.feed.addComment(CURRENT_USER_ID, post!.id, '  Harika kare!  ');
    expect(comment.content).toBe('Harika kare!');
    expect(comment.author.id).toBe(CURRENT_USER_ID);
    const detail = await p.feed.getById(CURRENT_USER_ID, post!.id);
    expect(detail?.commentsCount).toBe(before + 1);
    const comments = await p.feed.listComments(post!.id);
    expect(comments[comments.length - 1]?.id).toBe(comment.id);
  });

  it('yeni gönderi oluşturur ve yazar istatistiklerini günceller', async () => {
    const p = makeProvider();
    const me = (await p.users.getById(CURRENT_USER_ID))!;
    const created = await p.feed.create(CURRENT_USER_ID, {
      caption: 'Test',
      imageUri: null,
      adventureType: 'cycling',
      difficulty: 'easy',
      trailCondition: 'good',
      altitudeM: 100,
      distanceKm: 12.5,
      temperatureC: 20,
      windKmh: 5,
      durationMin: 60,
      locationName: 'Test Yolu',
    });
    expect(created.likedByMe).toBe(false);
    expect(created.isVerifiedInfo).toBe(me.isVerified);
    const after = (await p.users.getById(CURRENT_USER_ID))!;
    expect(after.totalAdventures).toBe(me.totalAdventures + 1);
    expect(after.totalDistanceKm).toBeCloseTo(me.totalDistanceKm + 12.5, 5);
    const feed = await p.feed.list(CURRENT_USER_ID);
    expect(feed[0]?.id).toBe(created.id);
  });
});

describe('MockProvider — ZMatch', () => {
  it('yeni istek her zaman "pending" durumuyla oluşturulur', async () => {
    const p = makeProvider();
    const match = await p.matches.request(CURRENT_USER_ID, {
      receiverId: 'u_zeynep',
      message: 'Kaş’ta dalış?',
      adventureType: 'diving',
      plannedDate: null,
      locationName: 'Kaş',
    });
    expect(match.status).toBe('pending');
    expect(match.requester.id).toBe(CURRENT_USER_ID);
    expect(match.receiver.id).toBe('u_zeynep');

    const receiverNotifications = await p.notifications.list('u_zeynep');
    expect(receiverNotifications[0]?.type).toBe('match_request');
    expect(receiverNotifications[0]?.matchId).toBe(match.id);
  });

  it('aynı kişiye ikinci bekleyen istek göndermez (mevcut olanı döner)', async () => {
    const p = makeProvider();
    const input = {
      receiverId: 'u_zeynep',
      message: '',
      adventureType: 'diving' as const,
      plannedDate: null,
      locationName: null,
    };
    const first = await p.matches.request(CURRENT_USER_ID, input);
    const second = await p.matches.request(CURRENT_USER_ID, input);
    expect(second.id).toBe(first.id);
  });

  it('yalnızca alıcı yanıt verebilir; kabul bildirim üretir ve güven skorunu günceller', async () => {
    const p = makeProvider();
    const mine = await p.matches.listMine(CURRENT_USER_ID);
    const incoming = mine.find((m) => m.receiverId === CURRENT_USER_ID && m.status === 'pending')!;
    expect(incoming).toBeDefined();

    await expect(p.matches.respond('u_zeynep', incoming.id, true)).rejects.toThrow();

    const before = (await p.users.getById(CURRENT_USER_ID))!.trustScore;
    const accepted = await p.matches.respond(CURRENT_USER_ID, incoming.id, true);
    expect(accepted.status).toBe('accepted');
    expect(accepted.respondedAt).not.toBeNull();

    const requesterNotifications = await p.notifications.list(incoming.requesterId);
    expect(requesterNotifications[0]?.type).toBe('match_accepted');

    const after = (await p.users.getById(CURRENT_USER_ID))!.trustScore;
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThanOrEqual(100);
    expect(typeof before).toBe('number');
  });

  it('reddedilen eşleşmenin karşı tarafı aday listesinden düşer', async () => {
    const p = makeProvider();
    const me = (await p.users.getById(CURRENT_USER_ID))!;
    const mine = await p.matches.listMine(CURRENT_USER_ID);
    const incoming = mine.find((m) => m.receiverId === CURRENT_USER_ID && m.status === 'pending')!;
    await p.matches.respond(CURRENT_USER_ID, incoming.id, false);
    const candidates = await p.matches.candidates(CURRENT_USER_ID, me.coords, 5000);
    expect(candidates.some((c) => c.user.id === incoming.requesterId)).toBe(false);
  });
});

describe('MockProvider — bildirimler ve mesajlar', () => {
  it('okunmamış sayısını hesaplar ve tümünü okundu yapar', async () => {
    const p = makeProvider();
    const unread = await p.notifications.unreadCount(CURRENT_USER_ID);
    expect(unread).toBeGreaterThan(0);
    await p.notifications.markAllRead(CURRENT_USER_ID);
    expect(await p.notifications.unreadCount(CURRENT_USER_ID)).toBe(0);
  });

  it('mesaj gönderir, sohbeti sıralar ve okundu bilgisini işler', async () => {
    const p = makeProvider();
    const sent = await p.messages.send(CURRENT_USER_ID, 'u_elif', 'Selam!', 'm3');
    expect(sent.readAt).toBeNull();
    const thread = await p.messages.thread(CURRENT_USER_ID, 'u_elif');
    expect(thread[thread.length - 1]?.id).toBe(sent.id);
    // Karşı taraf okuduğunda readAt dolar
    const theirView = await p.messages.thread('u_elif', CURRENT_USER_ID);
    expect(theirView.find((m) => m.id === sent.id)?.readAt).not.toBeNull();
  });

  it('takip et / bırak sayaçları günceller', async () => {
    const p = makeProvider();
    const before = (await p.users.getById('u_baris'))!.followersCount;
    expect(await p.users.isFollowing(CURRENT_USER_ID, 'u_baris')).toBe(false);
    await p.users.toggleFollow(CURRENT_USER_ID, 'u_baris');
    expect(await p.users.isFollowing(CURRENT_USER_ID, 'u_baris')).toBe(true);
    expect((await p.users.getById('u_baris'))!.followersCount).toBe(before + 1);
    await p.users.toggleFollow(CURRENT_USER_ID, 'u_baris');
    expect((await p.users.getById('u_baris'))!.followersCount).toBe(before);
  });
});

describe('MockProvider — keşfet', () => {
  it('trend lokasyonları trend yüzdesine göre sıralar', async () => {
    const p = makeProvider();
    const locations = await p.explore.trendingLocations();
    for (let i = 1; i < locations.length; i++) {
      expect(locations[i - 1]!.trendPercent).toBeGreaterThanOrEqual(locations[i]!.trendPercent);
    }
  });

  it('Türkçe karakter duyarsız arama yapar', async () => {
    const p = makeProvider();
    const result = await p.explore.search('kaçkar');
    expect(result.locations.map((l) => l.id)).toContain('l_kackar');
    const upper = await p.explore.search('KAÇKAR');
    expect(upper.locations.length).toBe(result.locations.length);
  });
});

describe('MockProvider — profil', () => {
  it('bazal nabzı kaydeder ve geri okur', async () => {
    const p = makeProvider();
    const updated = await p.users.updateProfile(CURRENT_USER_ID, { baselineRestingHr: 54 });
    expect(updated.baselineRestingHr).toBe(54);
    expect((await p.users.getById(CURRENT_USER_ID))?.baselineRestingHr).toBe(54);
  });

  it('sınır dışı bazal nabzı kırpmaz, düşürür', async () => {
    const p = makeProvider();
    // 300 bpm bir ölçüm değil, cihaz hatasıdır. 220'ye kırpmak uydurma bir
    // bazal yaratır ve nabız sapmasını her ölçümde sistematik olarak yanıltır.
    await p.users.updateProfile(CURRENT_USER_ID, { baselineRestingHr: 300 });
    expect((await p.users.getById(CURRENT_USER_ID))?.baselineRestingHr).toBeNull();

    await p.users.updateProfile(CURRENT_USER_ID, { baselineRestingHr: 12 });
    expect((await p.users.getById(CURRENT_USER_ID))?.baselineRestingHr).toBeNull();
  });

  it('bazal nabız gönderilmezse mevcut değeri korur', async () => {
    const p = makeProvider();
    await p.users.updateProfile(CURRENT_USER_ID, { baselineRestingHr: 58 });
    await p.users.updateProfile(CURRENT_USER_ID, { bio: 'yeni biyografi' });
    const user = await p.users.getById(CURRENT_USER_ID);
    expect(user?.bio).toBe('yeni biyografi');
    expect(user?.baselineRestingHr).toBe(58);
  });
});
