import type { DataProvider } from '@/data/repositories';
import type { ID, User } from '@/domain';

/**
 * Sağlayıcıdan bağımsız sözleşme senaryoları.
 *
 * Aynı senaryolar hem mock sağlayıcıya hem de gerçek Postgres'e bağlı uzak
 * sağlayıcıya karşı çalışır (`mockProvider.contract.test.ts` ve
 * `remoteProvider.contract.test.ts`). Yalnızca `DataProvider` yüzeyini
 * kullanırlar; tablo/şema ayrıntısına girmezler.
 */

export interface ContractHarness {
  /** Test başlığında görünen ad ("mock" / "remote"). */
  label: string;
  provider: DataProvider;
  /**
   * Etkin oturum kullanıcısını değiştirir. Mock'ta anlamsızdır (metotlar
   * kimliği parametre alır); uzak sağlayıcıda RPC'lerdeki `auth.uid()`
   * değerini belirler.
   */
  signIn(userId: ID | null): void | Promise<void>;
}

/** Kullanıcı adından kullanıcıyı çözer (her iki sağlayıcıda da aynı tohum). */
export async function userByUsername(provider: DataProvider, username: string): Promise<User> {
  const found = await provider.users.search(username);
  const user = found.find((u) => u.username === username);
  if (!user) throw new Error(`Tohumda kullanıcı yok: ${username}`);
  return user;
}

/** Gelecekteki bir tarih (rezervasyon senaryoları için, çakışmasız). */
function futureDay(offsetDays: number): string {
  const base = Date.UTC(2031, 4, 1); // 2031-05-01
  return new Date(base + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function runContractScenarios(harness: () => ContractHarness): void {
  const P = () => harness().provider;
  const signIn = async (id: ID | null) => {
    await harness().signIn(id);
  };

  /* ---------------------------------------------------------------- */
  describe('akış', () => {
    it('gönderileri yazarıyla ve yeniden eskiye listeler', async () => {
      const me = await userByUsername(P(), 'deniz.kaya');
      await signIn(me.id);
      const feed = await P().feed.list(me.id);
      expect(feed.length).toBeGreaterThan(0);
      for (const post of feed) {
        expect(post.author.id).toBe(post.authorId);
        expect(typeof post.likedByMe).toBe('boolean');
      }
      const stamps = feed.map((p) => p.createdAt);
      expect([...stamps].sort((a, b) => b.localeCompare(a))).toEqual(stamps);
    });

    it('macera türüne göre süzer', async () => {
      const me = await userByUsername(P(), 'deniz.kaya');
      await signIn(me.id);
      const all = await P().feed.list(me.id);
      const type = all[0]!.adventureType;
      const filtered = await P().feed.list(me.id, { adventureType: type });
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((p) => p.adventureType === type)).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('gönderi oluşturma ve beğenme', () => {
    it('gönderi oluşturur, beğenir, yorum ekler ve bildirim üretir', async () => {
      const me = await userByUsername(P(), 'deniz.kaya');
      const other = await userByUsername(P(), 'elif.dogan');
      await signIn(me.id);

      const before = (await P().users.getById(me.id))!;
      const created = await P().feed.create(me.id, {
        caption: 'Sözleşme testi gönderisi',
        imageUri: null,
        adventureType: 'hiking',
        difficulty: 'moderate',
        trailCondition: 'good',
        altitudeM: 1200,
        distanceKm: 8,
        temperatureC: 14,
        windKmh: 10,
        durationMin: 240,
        locationName: 'Uludağ',
      });
      expect(created.caption).toBe('Sözleşme testi gönderisi');
      expect(created.likesCount).toBe(0);
      expect(created.author.id).toBe(me.id);
      // Yazarın macera sayacı ve toplam mesafesi güncellenir
      expect(created.author.totalAdventures).toBe(before.totalAdventures + 1);
      expect(created.author.totalDistanceKm).toBeCloseTo(before.totalDistanceKm + 8, 1);

      const fetched = await P().feed.getById(me.id, created.id);
      expect(fetched?.id).toBe(created.id);

      await signIn(other.id);
      const liked = await P().feed.toggleLike(other.id, created.id);
      expect(liked).toEqual({ liked: true, likesCount: 1 });
      const unliked = await P().feed.toggleLike(other.id, created.id);
      expect(unliked).toEqual({ liked: false, likesCount: 0 });
      const relike = await P().feed.toggleLike(other.id, created.id);
      expect(relike.liked).toBe(true);

      const comment = await P().feed.addComment(other.id, created.id, 'Harika rota!');
      expect(comment.author.id).toBe(other.id);
      const comments = await P().feed.listComments(created.id);
      expect(comments.map((c) => c.content)).toContain('Harika rota!');

      // Gönderi sahibine beğeni ve yorum bildirimi düşer
      const notifications = await P().notifications.list(me.id);
      const mine = notifications.filter((n) => n.postId === created.id);
      expect(mine.map((n) => n.type)).toEqual(expect.arrayContaining(['like', 'comment']));
      expect(mine[0]!.sender.id).toBe(other.id);
    });

    it('bilinmeyen gönderiyi beğenmeye çalışınca hata verir', async () => {
      const me = await userByUsername(P(), 'deniz.kaya');
      await signIn(me.id);
      await expect(P().feed.toggleLike(me.id, '00000000-0000-4000-8000-000000000000')).rejects.toThrow();
    });
  });

  /* ---------------------------------------------------------------- */
  describe('takip', () => {
    it('takip eder, sayaçları günceller ve geri alır', async () => {
      const me = await userByUsername(P(), 'kerem.aydin');
      const target = await userByUsername(P(), 'nil.erdem');
      await signIn(me.id);

      const initiallyFollowing = await P().users.isFollowing(me.id, target.id);
      if (initiallyFollowing) await P().users.toggleFollow(me.id, target.id);

      const beforeMe = (await P().users.getById(me.id))!;
      const beforeTarget = (await P().users.getById(target.id))!;

      const followed = await P().users.toggleFollow(me.id, target.id);
      expect(followed).toEqual({ following: true });
      expect(await P().users.isFollowing(me.id, target.id)).toBe(true);

      const afterMe = (await P().users.getById(me.id))!;
      const afterTarget = (await P().users.getById(target.id))!;
      expect(afterMe.followingCount).toBe(beforeMe.followingCount + 1);
      expect(afterTarget.followersCount).toBe(beforeTarget.followersCount + 1);

      const unfollowed = await P().users.toggleFollow(me.id, target.id);
      expect(unfollowed).toEqual({ following: false });
      expect(await P().users.isFollowing(me.id, target.id)).toBe(false);
      expect((await P().users.getById(me.id))!.followingCount).toBe(beforeMe.followingCount);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('profil', () => {
    it('bazal nabzı kaydeder; sınır dışı değeri kırpmaz, düşürür', async () => {
      const me = await userByUsername(P(), 'kerem.aydin');
      await signIn(me.id);

      const saved = await P().users.updateProfile(me.id, { baselineRestingHr: 54 });
      expect(saved.baselineRestingHr).toBe(54);
      expect((await P().users.getById(me.id))!.baselineRestingHr).toBe(54);

      // 300 bpm bir ölçüm değil, cihaz hatasıdır. 220'ye kırpmak uydurma bir
      // bazal üretir ve irtifadaki nabız sapmasını her ölçümde sistematik
      // olarak yanıltır; bu yüzden değer düşürülür.
      await P().users.updateProfile(me.id, { baselineRestingHr: 300 });
      expect((await P().users.getById(me.id))!.baselineRestingHr).toBeNull();

      // Alan gönderilmezse dokunulmaz: profilin başka bir alanını düzenlemek
      // bazalı silmemeli.
      await P().users.updateProfile(me.id, { baselineRestingHr: 58 });
      await P().users.updateProfile(me.id, { bio: 'sözleşme testi' });
      const after = (await P().users.getById(me.id))!;
      expect(after.bio).toBe('sözleşme testi');
      expect(after.baselineRestingHr).toBe(58);

      await P().users.updateProfile(me.id, { bio: me.bio, baselineRestingHr: null });
    });
  });

  /* ---------------------------------------------------------------- */
  describe('grup mesajı', () => {
    it('grup kurar, üye alır, mesaj ve anket gönderir', async () => {
      const owner = await userByUsername(P(), 'deniz.kaya');
      const member = await userByUsername(P(), 'can.yildirim');
      await signIn(owner.id);

      const group = await P().groups.create(owner.id, {
        name: 'Sözleşme Grubu',
        kind: 'group',
        privacy: 'public',
        description: 'test',
        adventureTypes: ['hiking'],
        city: 'İstanbul',
      });
      expect(group.membership).toBe('owner');
      expect(group.memberCount).toBe(1);

      await signIn(member.id);
      const joined = await P().groups.join(member.id, group.id);
      expect(joined.membership).toBe('member');
      expect(joined.memberCount).toBe(2);

      const sent = await P().groups.send(member.id, group.id, {
        type: 'text',
        text: `Selam @${owner.username}`,
      });
      expect(sent.sender.id).toBe(member.id);
      expect(sent.type).toBe('text');

      const page = await P().groups.messages(owner.id, group.id);
      expect(page.some((m) => m.id === sent.id)).toBe(true);
      // Sistem mesajları da akışta yer alır (oluşturuldu / katıldı)
      expect(page.some((m) => m.type === 'system')).toBe(true);

      // Etiketlenen sahip bildirim alır
      const notifications = await P().notifications.list(owner.id);
      expect(notifications.some((n) => n.type === 'group_message' && n.targetId === group.id)).toBe(
        true,
      );

      const poll = await P().groups.send(member.id, group.id, {
        type: 'poll',
        text: '',
        poll: { question: 'Nereye?', options: ['Kaçkar', 'Aladağlar'], multi: false },
      });
      const voted = await P().groups.vote(owner.id, group.id, poll.id, ['o1']);
      expect(voted.poll?.options[0]?.votes).toBe(1);
      expect(voted.myVote).toEqual(['o1']);
      // Aynı seçenek tekrar → oy geri çekilir
      const revoked = await P().groups.vote(owner.id, group.id, poll.id, ['o1']);
      expect(revoked.poll?.options[0]?.votes).toBe(0);
      expect(revoked.myVote).toBeNull();

      // Üye olmayan yazamaz
      const outsider = await userByUsername(P(), 'lale.demir');
      await signIn(outsider.id);
      await expect(
        P().groups.send(outsider.id, group.id, { type: 'text', text: 'merhaba' }),
      ).rejects.toThrow(/üyesi değilsin/);

      // Sahip ayrılamaz
      await signIn(owner.id);
      await expect(P().groups.leave(owner.id, group.id)).rejects.toThrow(/sahibi ayrılamaz/);
    });

    it('özel gruba davetsiz katılınamaz, davet koduyla katılınır', async () => {
      const owner = await userByUsername(P(), 'mert.ozturk');
      const guest = await userByUsername(P(), 'selin.arslan');
      await signIn(owner.id);
      const group = await P().groups.create(owner.id, {
        name: 'Gizli Kamp',
        kind: 'group',
        privacy: 'private',
        description: 'özel',
        adventureTypes: ['hiking'],
        city: null,
      });
      await signIn(guest.id);
      await expect(P().groups.join(guest.id, group.id)).rejects.toThrow(/davet kodu gerekli/);
      const byCode = await P().groups.joinByCode(guest.id, group.inviteCode);
      expect(byCode.membership).toBe('member');
    });
  });

  /* ---------------------------------------------------------------- */
  describe('rezervasyon', () => {
    it('teklif verir, rezerve eder, çakışmayı reddeder ve iptalde tarihleri serbest bırakır', async () => {
      const businesses = await P().businesses.list({ staysOnly: true });
      const business = businesses[0]!;
      expect(business).toBeTruthy();

      // Tek kapasiteli birim: çakışma kısıtını görünür kılar
      await signIn(business.ownerId);
      const unit = await P().inventory.upsertUnit(business.ownerId, {
        businessId: business.id,
        name: 'Sözleşme Odası',
        kind: 'room',
        capacity: 2,
        quantity: 1,
        basePriceTry: 1000,
        weekendMultiplier: 1,
        seasons: [],
        amenities: [],
      });
      expect(unit.quantity).toBe(1);

      const input = {
        businessId: business.id,
        unitId: unit.id,
        checkIn: futureDay(0),
        checkOut: futureDay(3),
        guests: 2,
      };

      const guest = await userByUsername(P(), 'zeynep.aksoy');
      const rival = await userByUsername(P(), 'baris.celik');

      await signIn(guest.id);
      const quote = await P().inventory.quote(input);
      expect(quote.nights).toBe(3);
      expect(quote.available).toBe(true);
      expect(quote.totalTry).toBe(quote.subtotalTry + quote.platformFeeTry);

      const availability = await P().inventory.availability(unit.id, input.checkIn, input.checkOut);
      expect(availability).toHaveLength(3);
      expect(availability.every((a) => a.available === 1)).toBe(true);

      const booking = await P().inventory.book(guest.id, input);
      expect(booking.status).toBe('confirmed');
      expect(booking.nights).toBe(3);
      expect(booking.unit?.id).toBe(unit.id);
      expect(booking.payment?.status).toBe('escrow');

      // Tarihler doldu
      const after = await P().inventory.availability(unit.id, input.checkIn, input.checkOut);
      expect(after.every((a) => a.available === 0)).toBe(true);

      // Çakışan ikinci rezervasyon reddedilir
      await signIn(rival.id);
      await expect(P().inventory.book(rival.id, input)).rejects.toThrow(/müsaitlik yok/);

      // Kapasite aşımı ayrı hata verir
      await expect(
        P().inventory.book(rival.id, {
          ...input,
          checkIn: futureDay(10),
          checkOut: futureDay(12),
          guests: 9,
        }),
      ).rejects.toThrow(/kapasitesini aşıyor/);

      // Yalnızca misafir iptal edebilir
      await expect(P().inventory.cancel(rival.id, booking.id)).rejects.toThrow(/sana ait değil/);

      await signIn(guest.id);
      const preview = await P().inventory.refundPreview(guest.id, booking.id);
      expect(preview.refundTry).toBeGreaterThanOrEqual(0);
      expect(preview.refundTry + preview.keptTry).toBe(booking.totalTry);

      const cancelled = await P().inventory.cancel(guest.id, booking.id);
      expect(cancelled.status).toBe('cancelled');

      // İptal sonrası tarihler yeniden satılabilir
      const freed = await P().inventory.availability(unit.id, input.checkIn, input.checkOut);
      expect(freed.every((a) => a.available === 1)).toBe(true);
      await signIn(rival.id);
      const second = await P().inventory.book(rival.id, input);
      expect(second.status).toBe('confirmed');
    });
  });

  /* ---------------------------------------------------------------- */
  describe('tehlike bildirimi', () => {
    it('bildirir, başkası onaylar, yalnızca bildiren çözer', async () => {
      const reporter = await userByUsername(P(), 'emre.sahin');
      const other = await userByUsername(P(), 'ayse.kurt');
      await signIn(reporter.id);

      const hazard = await P().hazards.report(reporter.id, {
        type: 'rockfall',
        severity: 'high',
        title: 'Sözleşme kaya düşmesi',
        description: 'Patika kapalı',
        locationName: 'Test Geçidi',
        coords: { latitude: 40.5, longitude: 30.5 },
        radiusM: 400,
        expiresInHours: null,
      });
      expect(hazard.status).toBe('active');
      expect(hazard.reporter.id).toBe(reporter.id);
      expect(hazard.confirmations).toBe(0);
      expect(hazard.confirmedByMe).toBe(false);

      // Kendi bildirimini onaylayamaz
      await expect(P().hazards.confirm(reporter.id, hazard.id)).rejects.toThrow(/onaylayamazsın/);

      await signIn(other.id);
      const confirmed = await P().hazards.confirm(other.id, hazard.id);
      expect(confirmed.confirmations).toBe(1);
      expect(confirmed.confirmedByMe).toBe(true);
      // Aynı kişi ikinci kez onaylayınca sayaç artmaz
      const again = await P().hazards.confirm(other.id, hazard.id);
      expect(again.confirmations).toBe(1);

      // Çözme yetkisi yalnızca bildirende
      await expect(P().hazards.resolve(other.id, hazard.id)).rejects.toThrow(/bildiren kişi/);

      await signIn(reporter.id);
      const resolved = await P().hazards.resolve(reporter.id, hazard.id);
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedAt).not.toBeNull();

      // Varsayılan listede çözülenler görünmez
      const active = await P().hazards.list(reporter.id, null);
      expect(active.some((h) => h.id === hazard.id)).toBe(false);
      const withResolved = await P().hazards.list(reporter.id, null, undefined, true);
      expect(withResolved.some((h) => h.id === hazard.id)).toBe(true);

      // Mesafe hesabı merkez verildiğinde dolar
      const near = await P().hazards.list(
        reporter.id,
        { latitude: 40.5, longitude: 30.5 },
        50,
        true,
      );
      const found = near.find((h) => h.id === hazard.id);
      expect(found?.distanceKm).not.toBeNull();
      expect(found!.distanceKm!).toBeLessThan(1);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('tırmanış', () => {
    it('rota ekler, sahibi onaylayamaz, başkası onaylayınca sayaç artar', async () => {
      const author = await userByUsername(P(), 'baris.celik');
      const climber = await userByUsername(P(), 'lale.demir');
      await signIn(author.id);

      const crags = await P().climbing.crags({});
      expect(crags.length).toBeGreaterThan(0);
      const crag = crags[0]!;
      const sectors = await P().climbing.sectors(crag.id);
      expect(sectors.length).toBeGreaterThan(0);

      const route = await P().climbing.submitRoute(author.id, {
        cragId: crag.id,
        sectorId: sectors[0]!.id,
        name: 'Sözleşme Rotası',
        type: 'sport',
        grade: '6b',
        gradeSystem: 'french',
        lengthM: 28,
        pitches: 1,
        description: 'test rotası',
      });
      expect(route.verification).toBe('unverified');
      expect(route.confirmations).toBe(0);
      expect(route.submittedBy).toBe(author.id);

      await expect(P().climbing.submitRoute(author.id, {
        cragId: crag.id,
        sectorId: sectors[0]!.id,
        name: 'Geçersiz Derece',
        type: 'sport',
        grade: 'zz9',
        gradeSystem: 'french',
        lengthM: 10,
        pitches: 1,
        description: '',
      })).rejects.toThrow(/Geçersiz derece/);

      await expect(P().climbing.confirmRoute(author.id, route.id)).rejects.toThrow(
        /onaylayamazsın/,
      );

      await signIn(climber.id);
      const confirmed = await P().climbing.confirmRoute(climber.id, route.id);
      expect(confirmed.confirmations).toBe(1);
      await expect(P().climbing.confirmRoute(climber.id, route.id)).rejects.toThrow(
        /onaylayamazsın/,
      );

      const detail = await P().climbing.route(route.id, climber.id);
      expect(detail?.confirmedByMe).toBe(true);
      expect(detail?.crag.id).toBe(crag.id);

      // Çıkış kaydı sayaç artırır ve listede görünür
      const ascent = await P().climbing.logAscent(climber.id, {
        routeId: route.id,
        style: 'redpoint',
        note: 'güzel hat',
      });
      expect(ascent.user.id).toBe(climber.id);
      const ascents = await P().climbing.ascents(route.id);
      expect(ascents.some((a) => a.id === ascent.id)).toBe(true);
      const mine = await P().climbing.myAscents(climber.id);
      expect(mine.some((a) => a.route.id === route.id)).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('XP kazanımı', () => {
    it('günün yarışmasını çözünce XP olayı yazılır ve gün içinde tekrarlanmaz', async () => {
      const me = await userByUsername(P(), 'zeynep.aksoy');
      await signIn(me.id);

      const questions = await P().fun.quiz(me.id);
      expect(questions.length).toBe(5);

      const before = await P().fun.xpHistory(me.id);
      const beforeSummary = await P().fun.summary(me.id);
      const answers = questions.map((q) => ({ questionId: q.id, answerIndex: q.answerIndex }));
      const result = await P().fun.submitQuiz(me.id, answers);
      expect(result.correct).toBe(5);
      expect(result.total).toBe(5);

      const after = await P().fun.xpHistory(me.id);
      if (result.xpEarned > 0) {
        expect(after.length).toBe(before.length + 1);
        expect(after[0]!.source).toBe('quiz');
        expect(after[0]!.amount).toBe(result.xpEarned);
        const afterSummary = await P().fun.summary(me.id);
        expect(afterSummary.level.xp).toBe(beforeSummary.level.xp + result.xpEarned);
      }
      // Günde tek deneme puan verir
      const repeat = await P().fun.submitQuiz(me.id, answers);
      expect(repeat.xpEarned).toBe(0);
      expect((await P().fun.xpHistory(me.id)).length).toBe(after.length);
    });

    it('sıralama ve rozet listesi tutarlı döner', async () => {
      const me = await userByUsername(P(), 'zeynep.aksoy');
      await signIn(me.id);
      const board = await P().fun.leaderboard(me.id, 'global');
      expect(board.length).toBeGreaterThan(0);
      expect(board.map((r) => r.rank)).toEqual(board.map((_, i) => i + 1));
      expect(board.filter((r) => r.isMe).length).toBeLessThanOrEqual(1);
      const xps = board.map((r) => r.xp);
      expect([...xps].sort((a, b) => b - a)).toEqual(xps);

      const badges = await P().fun.badges(me.id);
      expect(badges.length).toBeGreaterThan(0);
      expect(badges.every((b) => b.earnedAt === null || typeof b.earnedAt === 'string')).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('sosyal', () => {
    it('durum paylaşır, tepki verir, kaydeder ve yeniden paylaşır', async () => {
      const me = await userByUsername(P(), 'nil.erdem');
      const other = await userByUsername(P(), 'emre.sahin');
      await signIn(me.id);

      const post = await P().social.createStatus(me.id, {
        caption: 'Sözleşme durumu #sozlesme',
        imageUris: [],
        locationName: 'İzmir',
      });
      expect(post.hashtags).toContain('sozlesme');
      expect(post.kind).toBe('status');

      await signIn(other.id);
      const reacted = await P().social.react(other.id, post.id, 'fire');
      expect(reacted.myReaction).toBe('fire');
      expect(reacted.likesCount).toBe(1);
      expect(reacted.reactionCounts?.fire).toBe(1);

      const cleared = await P().social.react(other.id, post.id, null);
      expect(cleared.myReaction).toBeNull();
      expect(cleared.likesCount).toBe(0);

      const collection = await P().social.createCollection(other.id, 'Sözleşme Koleksiyonu');
      const saved = await P().social.toggleSave(other.id, post.id, collection.id);
      expect(saved.savedByMe).toBe(true);
      const savedList = await P().social.savedPosts(other.id, collection.id);
      expect(savedList.some((p) => p.id === post.id)).toBe(true);

      const repost = await P().social.repost(other.id, post.id, 'buna bayıldım');
      expect(repost.repostOf?.id).toBe(post.id);
      expect(repost.repostOf?.author.id).toBe(me.id);

      const byTag = await P().social.byHashtag(other.id, 'sozlesme');
      expect(byTag.some((p) => p.id === post.id)).toBe(true);

      // Yalnızca yazar silebilir
      await expect(P().social.deletePost(other.id, post.id)).rejects.toThrow(/kendi gönderini/);
      await signIn(me.id);
      await P().social.deletePost(me.id, post.id);
      expect(await P().feed.getById(me.id, post.id)).toBeNull();
    });
  });

  /* ---------------------------------------------------------------- */
  describe('mesajlaşma', () => {
    it('birebir mesaj gönderir ve okundu işaretler', async () => {
      const a = await userByUsername(P(), 'can.yildirim');
      const b = await userByUsername(P(), 'selin.arslan');
      await signIn(a.id);
      const sent = await P().messages.send(a.id, b.id, 'Sözleşme merhaba');
      expect(sent.senderId).toBe(a.id);
      expect(sent.readAt).toBeNull();

      await signIn(b.id);
      const thread = await P().messages.thread(b.id, a.id);
      const found = thread.find((m) => m.id === sent.id);
      expect(found).toBeTruthy();
      expect(found!.readAt).not.toBeNull();
      const stamps = thread.map((m) => m.createdAt);
      expect([...stamps].sort()).toEqual(stamps);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('bildirimler', () => {
    it('okunmamış sayacı ve toplu okundu işaretleme çalışır', async () => {
      const me = await userByUsername(P(), 'ayse.kurt');
      const other = await userByUsername(P(), 'kerem.aydin');
      await signIn(other.id);
      await P().messages.send(other.id, me.id, 'Bildirim tetikleyici');

      await signIn(me.id);
      expect(await P().notifications.unreadCount(me.id)).toBeGreaterThan(0);
      const list = await P().notifications.list(me.id);
      expect(list.every((n) => n.receiverId === me.id)).toBe(true);
      await P().notifications.markRead(me.id, list[0]!.id);
      await P().notifications.markAllRead(me.id);
      expect(await P().notifications.unreadCount(me.id)).toBe(0);
    });
  });
}
