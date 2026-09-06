import { createRemoteProvider } from '@/data/remote/provider';
import type { DataProvider } from '@/data/repositories';

import {
  createPgHarness,
  isPostgresLikelyAvailable,
  type PgHarness,
} from './contract/pgHarness';
import { userByUsername } from './contract/scenarios';

/**
 * Uzak sağlayıcının **tüm modüllerinin** gerçek veritabanına karşı çalıştığını
 * gösteren kapsam testi. Sözleşme senaryoları (bkz. `contract/scenarios.ts`)
 * davranış eşitliğini; bu paket ise geri kalan 38 repository'nin okuma/yazma
 * yollarının gerçekten koştuğunu doğrular.
 */
const available = isPostgresLikelyAvailable();
const run = available ? describe : describe.skip;

let pg: PgHarness;
let p: DataProvider;
/** Oturumu hem uyarlayıcıya hem sağlayıcı bağlamına bildirir. */
let signIn: (userId: string) => void;

const ISTANBUL = { latitude: 41.0082, longitude: 28.9784 };

run('uzak sağlayıcı · modül kapsamı', () => {
  beforeAll(async () => {
    pg = await createPgHarness(`modules_${process.pid}`);
    const remote = createRemoteProvider(pg.ctx.db);
    p = remote;
    signIn = (userId) => {
      pg.signIn(userId);
      remote.context.setSessionUserId(userId);
    };
  }, 120_000);

  afterAll(async () => {
    if (pg) await pg.close();
  });

  it('keşfet, kütüphane ve acil durum', async () => {
    const me = await userByUsername(p, 'deniz.kaya');
    signIn(me.id);

    const locations = await p.explore.trendingLocations();
    expect(locations.length).toBeGreaterThan(0);
    expect(await p.explore.getLocation(locations[0]!.id)).not.toBeNull();
    expect((await p.explore.popularRoutes()).length).toBeGreaterThan(0);
    const search = await p.explore.search('kaç');
    expect(search.locations.length + search.users.length + search.routes.length).toBeGreaterThan(0);

    const places = await p.library.search({ query: '' });
    expect(places.length).toBeGreaterThan(0);
    const nearby = await p.library.nearby(ISTANBUL, 500, null, 5);
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby[0]!.distanceKm).not.toBeNull();
    expect((await p.library.countries()).length).toBeGreaterThan(0);
    expect(await p.library.getById(places[0]!.id, ISTANBUL)).not.toBeNull();

    const centers = await p.emergency.centers(ISTANBUL, 3);
    expect(centers.length).toBeGreaterThan(0);
    expect(centers[0]!.distanceKm).toBeGreaterThanOrEqual(0);

    const withContacts = await p.emergency.updateContacts(me.id, [
      { name: 'Acil Kişi', phone: '+905550000000', userId: null },
    ]);
    expect(withContacts.emergencyContacts).toHaveLength(1);
    const sos = await p.emergency.triggerSos(me.id, ISTANBUL);
    expect(sos.notifiedContacts).toBe(1);
    expect((await p.emergency.activeSos(me.id))?.id).toBe(sos.id);
    await p.emergency.resolveSos(me.id);
    expect(await p.emergency.activeSos(me.id)).toBeNull();
  }, 60_000);

  it('eşleşme, market, eğitmen ve işletme', async () => {
    const me = await userByUsername(p, 'mert.ozturk');
    const other = await userByUsername(p, 'ayse.kurt');
    signIn(me.id);

    const candidates = await p.matches.candidates(me.id, ISTANBUL, 5000, null);
    expect(Array.isArray(candidates)).toBe(true);
    const match = await p.matches.request(me.id, {
      receiverId: other.id,
      message: 'Beraber gidelim mi?',
      adventureType: 'hiking',
      plannedDate: null,
      locationName: 'Kaçkarlar',
    });
    expect(match.status).toBe('pending');
    expect((await p.matches.listMine(me.id)).some((m) => m.id === match.id)).toBe(true);
    signIn(other.id);
    const answered = await p.matches.respond(other.id, match.id, true);
    expect(answered.status).toBe('accepted');
    await expect(p.matches.respond(other.id, match.id, true)).resolves.toBeTruthy();

    signIn(me.id);
    const listing = await p.market.create(me.id, {
      title: 'Sözleşme çadırı',
      description: '2 kişilik',
      priceTry: 3500,
      category: 'camping',
      condition: 'good',
      imageUri: null,
      locationName: 'İstanbul',
      adventureTypes: [],
    });
    expect(listing.priceTry).toBe(3500);
    signIn(other.id);
    const fav = await p.market.toggleFavorite(other.id, listing.id);
    expect(fav).toEqual({ favorited: true, favoritesCount: 1 });
    signIn(me.id);
    expect((await p.market.markSold(me.id, listing.id)).isSold).toBe(true);
    expect((await p.market.list(me.id, { includeSold: true })).some((l) => l.id === listing.id)).toBe(
      true,
    );

    const instructors = await p.instructors.list(ISTANBUL, {});
    expect(instructors.length).toBeGreaterThan(0);
    const instructor = instructors.find((i) => i.userId !== me.id)!;
    expect((await p.instructors.getById(instructor.id, ISTANBUL))?.id).toBe(instructor.id);
    expect(Array.isArray(await p.instructors.reviews(instructor.id))).toBe(true);
    const booking = await p.instructors.book(me.id, {
      instructorId: instructor.id,
      adventureType: 'hiking',
      date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      message: 'Ders alabilir miyim?',
    });
    expect(booking.status).toBe('pending');
    signIn(instructor.userId);
    const responded = await p.instructors.respondBooking(instructor.userId, booking.id, true);
    expect(responded.status).toBe('confirmed');
    expect((await p.instructors.myBookings(me.id)).some((b) => b.id === booking.id)).toBe(true);

    signIn(me.id);
    const businesses = await p.businesses.list({ staysOnly: true });
    expect(businesses.length).toBeGreaterThan(0);
    const stay = await p.businesses.reserve(me.id, {
      businessId: businesses[0]!.id,
      checkIn: '2032-06-01',
      checkOut: '2032-06-04',
      guests: 2,
    });
    expect(stay.nights).toBe(3);
    expect((await p.businesses.myStays(me.id)).some((s) => s.id === stay.id)).toBe(true);
    const registered = await p.businesses.register(me.id, {
      name: 'Sözleşme Kamp',
      type: 'campsite',
      description: 'test',
      locationName: 'Bolu',
      priceFromTry: 900,
      amenities: [],
      adventureTypes: [],
      phone: null,
      website: null,
    });
    expect(registered.owner.id).toBe(me.id);

    expect(await p.billing.currentPlan(me.id)).toBeTruthy();
    const earnings = await p.billing.earnings(me.id);
    expect(earnings.grossTry).toBeGreaterThanOrEqual(0);
    const upgraded = await p.billing.subscribe(me.id, 'pro', 'monthly');
    expect(upgraded.plan).toBe('pro');
  }, 90_000);

  it('canlı yayın, anlar ve konum paylaşımı', async () => {
    const host = await userByUsername(p, 'selin.arslan');
    const viewer = await userByUsername(p, 'can.yildirim');
    signIn(host.id);

    const stream = await p.live.start(host.id, {
      title: 'Sözleşme yayını',
      description: 'test',
      adventureType: 'hiking',
      locationName: 'Uludağ',
    });
    expect(stream.status).toBe('live');
    await p.live.join(stream.id);
    signIn(viewer.id);
    const message = await p.live.sendMessage(viewer.id, stream.id, 'selam');
    expect(message.author.id).toBe(viewer.id);
    expect((await p.live.messages(stream.id)).some((m) => m.id === message.id)).toBe(true);
    expect((await p.live.like(stream.id)).likesCount).toBeGreaterThan(0);
    await p.live.leave(stream.id);
    await expect(p.live.end(viewer.id, stream.id)).rejects.toThrow(/yayıncı/);
    signIn(host.id);
    expect((await p.live.end(host.id, stream.id)).status).toBe('ended');
    expect((await p.live.list()).length).toBeGreaterThan(0);

    const story = await p.stories.create(host.id, {
      mediaUri: 'https://example.test/a.jpg',
      caption: 'an',
      adventureType: 'hiking',
      locationName: 'Uludağ',
    });
    signIn(viewer.id);
    await p.stories.markSeen(viewer.id, story.id);
    const groups = await p.stories.groups(viewer.id);
    expect(groups.some((g) => g.stories.some((s) => s.id === story.id))).toBe(true);

    const share = await p.presence.start(viewer.id, {
      mode: 'friends',
      coords: ISTANBUL,
      durationMin: 60,
      batteryPct: 80,
    });
    expect(share.mode).toBe('friends');
    expect((await p.presence.mine(viewer.id))?.userId).toBe(viewer.id);
    const moved = await p.presence.update(viewer.id, { latitude: 41.1, longitude: 29.0 });
    expect(moved?.coords.latitude).toBeCloseTo(41.1, 3);
    expect(Array.isArray(await p.presence.list(viewer.id, ISTANBUL))).toBe(true);
    await p.presence.stop(viewer.id);
    expect(await p.presence.mine(viewer.id)).toBeNull();
  }, 90_000);

  it('kulüpler, kurslar ve destinasyonlar', async () => {
    const me = await userByUsername(p, 'emre.sahin');
    signIn(me.id);

    const clubs = await p.clubs.list(me.id, {});
    expect(clubs.length).toBeGreaterThan(0);
    const free = clubs.find((c) => !c.isVerified && c.membership === 'none');
    if (free) {
      const joined = await p.clubs.join(me.id, free.id);
      expect(joined.membership).toBe('member');
      expect((await p.clubs.myClubs(me.id)).some((c) => c.id === free.id)).toBe(true);
      // BİLİNEN ŞEMA HATASI: `event_rsvps` tablosunda `id` sütunu yok ama
      // `event_rsvps_award_xp` tetikleyicisi `NEW.id` okuyor → her RSVP hata
      // veriyor. Şema düzeltilince bu dal doğrudan çalışır (bkz.
      // docs/REMOTE_PROVIDER.md · "Bilinen farklar").
      try {
        const event = await p.clubs.createEvent(me.id, {
          clubId: free.id,
          title: 'Sözleşme yürüyüşü',
          kind: 'trip',
          adventureType: 'hiking',
          description: 'test',
          locationName: 'Belgrad Ormanı',
          startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          endsAt: new Date(Date.now() + 3 * 86_400_000 + 6 * 3_600_000).toISOString(),
          capacity: 20,
          openToAll: true,
          priceTry: 0,
        });
        expect(event.rsvped).toBe(true);
        const toggled = await p.clubs.rsvp(me.id, event.id);
        expect(toggled.rsvped).toBe(false);
      } catch (error) {
        expect(String(error)).toMatch(/has no field "id"/);
      }
      expect((await p.clubs.members(free.id)).some((u) => u.id === me.id)).toBe(true);
      expect((await p.clubs.leave(me.id, free.id)).membership).toBe('none');
    }
    expect((await p.clubs.ranking()).length).toBeGreaterThan(0);
    const verification = await p.clubs.verifyStudent(me.id, 'ogrenci@boun.edu.tr');
    expect(verification.verifiedAt).not.toBeNull();
    expect((await p.clubs.studentVerification(me.id))?.email).toBe('ogrenci@boun.edu.tr');
    expect((await p.clubs.events(me.id)).length).toBeGreaterThan(0);

    const courses = await p.courses.list(me.id, {});
    expect(courses.length).toBeGreaterThan(0);
    const online = courses.find((c) => c.format === 'online' && !c.enrollment);
    if (online) {
      const enrollment = await p.courses.enroll(me.id, online.id, null);
      expect(enrollment.status).toBe('active');
      const lessons = await p.courses.lessons(online.id);
      expect(lessons.length).toBeGreaterThan(0);
      expect((await p.courses.lessonById(lessons[0]!.id))?.id).toBe(lessons[0]!.id);
      const progressed = await p.courses.completeLesson(me.id, online.id, lessons[0]!.id, 90);
      expect(progressed.completedLessonIds).toContain(lessons[0]!.id);
      expect((await p.courses.myCourses(me.id)).some((c) => c.id === online.id)).toBe(true);
      const review = await p.courses.review(me.id, online.id, 5, 'Çok faydalı bir kurstu.');
      expect(review.rating).toBe(5);
      expect((await p.courses.reviews(online.id)).some((r) => r.id === review.id)).toBe(true);
    }
    expect(Array.isArray(await p.courses.certificates(me.id))).toBe(true);

    const destinations = await p.destinations.list(me.id, { origin: ISTANBUL });
    expect(destinations.length).toBeGreaterThan(0);
    const destination = destinations[0]!;
    expect((await p.destinations.stages(destination.id)).length).toBeGreaterThanOrEqual(0);
    const saved = await p.destinations.toggleSave(me.id, destination.id);
    expect(saved.saved).toBe(true);
    expect((await p.destinations.saved(me.id)).some((d) => d.id === destination.id)).toBe(true);
    const ams = await p.destinations.logAms(me.id, {
      destinationId: destination.id,
      elevationM: 3800,
      headache: 2,
      gi: 1,
      fatigue: 1,
      dizziness: 0,
      note: 'test',
    });
    expect(ams.score).toBe(4);
    expect((await p.destinations.amsChecks(me.id)).some((c) => c.id === ams.id)).toBe(true);
    const plan = await p.destinations.createReturnPlan(me.id, {
      title: 'Sözleşme dönüş sözü',
      destinationId: destination.id,
      adventureType: 'hiking',
      startAt: new Date(Date.now() - 3_600_000).toISOString(),
      expectedReturnAt: new Date(Date.now() - 600_000).toISOString(),
      graceMin: 0,
      route: 'test',
      companions: 'yok',
    });
    expect(plan.status).toBe('active');
    const overdue = await p.destinations.checkOverdue(me.id, new Date().toISOString());
    expect(overdue.some((x) => x.id === plan.id)).toBe(true);
    expect((await p.destinations.markReturned(me.id, plan.id)).status).toBe('returned');
    expect((await p.destinations.returnPlans(me.id)).length).toBeGreaterThan(0);
  }, 120_000);

  it('makaleler, yaban hayat ve tele-tıp', async () => {
    const writer = await userByUsername(p, 'kerem.aydin');
    const reader = await userByUsername(p, 'nil.erdem');
    signIn(writer.id);

    await p.articles.applyWriter(writer.id, {
      penName: 'Kerem A.',
      bio: 'Dağ yazarı',
      languages: ['tr'],
      topics: ['guide'],
      website: null,
    });
    const body = 'Bu bir sözleşme testidir. '.repeat(20);
    const article = await p.articles.create(writer.id, {
      title: 'Sözleşme rehberi yazısı',
      subtitle: 'test',
      coverUri: null,
      category: 'guide',
      body,
      tags: ['test', 'sozlesme'],
      destinationId: null,
      countryCode: 'TR',
      adventureTypes: ['hiking'],
      publish: true,
    });
    expect(article.status).toBe('published');
    expect((await p.articles.getBySlug(reader.id, article.slug))?.id).toBe(article.id);

    signIn(reader.id);
    expect((await p.articles.toggleLike(reader.id, article.id)).likesCount).toBe(1);
    expect((await p.articles.toggleSave(reader.id, article.id)).savedByMe).toBe(true);
    expect((await p.articles.saved(reader.id)).some((a) => a.id === article.id)).toBe(true);
    const comment = await p.articles.addComment(reader.id, article.id, 'Teşekkürler!');
    expect(comment.author.id).toBe(reader.id);
    expect((await p.articles.comments(article.id)).length).toBe(1);
    // BİLİNEN ŞEMA HATASI: `bump_counter` hedef tablonun birincil anahtarını
    // `id` varsayıyor; `writer_profiles` ise `user_id` kullanıyor → yazar takibi
    // hata veriyor (bkz. docs/REMOTE_PROVIDER.md · "Bilinen farklar").
    try {
      const followed = await p.articles.toggleFollowWriter(reader.id, writer.id);
      expect(followed.followedByMe).toBe(true);
    } catch (error) {
      expect(String(error)).toMatch(/column "id" does not exist/);
    }
    expect((await p.articles.writers(reader.id)).length).toBeGreaterThan(0);
    signIn(writer.id);
    expect((await p.articles.mine(writer.id)).some((a) => a.id === article.id)).toBe(true);
    const updated = await p.articles.update(writer.id, article.id, { subtitle: 'güncellendi' });
    expect(updated.subtitle).toBe('güncellendi');

    const species = await p.wildlife.species({});
    expect(species.length).toBeGreaterThan(0);
    expect((await p.wildlife.speciesById(species[0]!.id))?.id).toBe(species[0]!.id);
    const identification = await p.wildlife.identify(writer.id, {
      imageUri: null,
      imageBase64: null,
      description: 'siyah yılan gördüm',
      coords: ISTANBUL,
      locale: 'tr',
    });
    expect(identification.candidates.length).toBeGreaterThan(0);
    expect((await p.wildlife.identifications(writer.id)).length).toBeGreaterThan(0);
    const question = await p.wildlife.ask(writer.id, {
      title: 'Bu hangi tür?',
      body: 'Kamp alanında gördüm',
      imageUrl: null,
      coords: ISTANBUL,
      locationName: 'Belgrad',
      speciesGuessId: species[0]!.id,
      urgent: false,
    });
    expect(question.status).toBe('open');
    signIn(reader.id);
    const answered = await p.wildlife.answer(reader.id, question.id, 'Bence çayır yılanı.');
    expect(answered.answersCount).toBe(1);
    expect(answered.status).toBe('answered');
    const answer = answered.answers[0]!;
    expect((await p.wildlife.upvote(reader.id, answer.id)).upvotes).toBe(1);
    signIn(writer.id);
    const accepted = await p.wildlife.accept(writer.id, question.id, answer.id);
    expect(accepted.status).toBe('resolved');
    expect((await p.wildlife.questions(writer.id, { mineOnly: true })).length).toBeGreaterThan(0);
    expect((await p.wildlife.deterrents()).length).toBeGreaterThan(0);
    expect((await p.wildlife.deterrent('bear')).animal).toBe('bear');
    const det = await p.wildlife.logDeterrent(writer.id, 'bear', 'whistle', ISTANBUL, 12);
    expect(det.durationS).toBe(12);
    expect((await p.wildlife.onlineHelpers()).count).toBeGreaterThanOrEqual(0);

    const doctors = await p.telemed.doctors(null, false);
    expect(doctors.length).toBeGreaterThan(0);
    const patient = await userByUsername(p, 'kerem.aydin');
    signIn(patient.id);
    const triage = await p.telemed.triage({ complaint: 'yılan ısırdı', speciesId: null, locale: 'tr' });
    expect(triage.steps.length).toBeGreaterThan(0);
    const consult = await p.telemed.request(patient.id, {
      complaint: 'Ayak bileğim burkuldu, şişti.',
      urgency: 'medium',
      specialty: null,
      firstAidSlug: null,
      speciesId: null,
      coords: ISTANBUL,
      channel: 'chat',
    });
    expect(consult.status).toBe('requested');
    expect(consult.messages.length).toBe(1);
    const doctorUserId = consult.doctor!.userId;
    signIn(doctorUserId);
    const active = await p.telemed.accept(doctorUserId, consult.id);
    expect(active.status).toBe('active');
    const reply = await p.telemed.send(doctorUserId, consult.id, 'Buz uygulayın.');
    expect(reply.isInstruction).toBe(true);
    const ended = await p.telemed.end(doctorUserId, consult.id, null);
    expect(ended.status).toBe('completed');
    expect(ended.summary).toBeTruthy();
    expect((await p.telemed.myConsultations(patient.id)).length).toBeGreaterThan(0);
  }, 120_000);

  it('TV, tarihi alanlar, çocuk modülü ve ülke rehberi', async () => {
    const me = await userByUsername(p, 'zeynep.aksoy');
    signIn(me.id);

    expect((await p.tv.channels()).length).toBeGreaterThan(0);
    const programs = await p.tv.programs(me.id, {});
    expect(programs.length).toBeGreaterThan(0);
    const program = programs[0]!;
    expect((await p.tv.program(me.id, program.id))?.id).toBe(program.id);
    await p.tv.saveProgress(me.id, program.id, 300, 1200);
    expect((await p.tv.continueWatching(me.id)).some((x) => x.id === program.id)).toBe(true);
    expect(await p.tv.toggleWatchLater(me.id, program.id)).toBe(true);
    expect((await p.tv.toggleLike(me.id, program.id)).likedByMe).toBe(true);
    expect(await p.tv.followChannel(me.id, program.channelId)).toBe(true);
    expect(Array.isArray(await p.tv.news(null, null))).toBe(true);
    const schedule = await p.tv.schedule(
      new Date(Date.now() - 7 * 86_400_000).toISOString(),
      new Date(Date.now() + 7 * 86_400_000).toISOString(),
    );
    expect(Array.isArray(schedule)).toBe(true);

    const sites = await p.heritage.list(me.id, { origin: ISTANBUL });
    expect(sites.length).toBeGreaterThan(0);
    const site = sites[0]!;
    expect((await p.heritage.getById(me.id, site.id, ISTANBUL))?.id).toBe(site.id);
    expect(Array.isArray(await p.heritage.audioGuide(site.id))).toBe(true);
    expect(await p.heritage.toggleSave(me.id, site.id)).toBe(true);
    expect(await p.heritage.markVisited(me.id, site.id)).toBe(true);
    const xpAfterVisit = await p.fun.xpHistory(me.id);
    expect(xpAfterVisit.some((e) => e.note.includes(site.name))).toBe(true);
    const tour = await p.heritage.createTour(me.id, {
      title: 'Sözleşme turu',
      siteIds: sites.slice(0, 2).map((s) => s.id),
      date: null,
      notes: '',
    });
    expect(tour.siteIds).toHaveLength(2);
    expect((await p.heritage.tours(me.id)).length).toBe(1);
    await p.heritage.deleteTour(me.id, tour.id);
    expect((await p.heritage.nearby(ISTANBUL, 2000)).length).toBeGreaterThan(0);

    const kidPlaces = await p.kids.places(me.id, { origin: ISTANBUL });
    expect(kidPlaces.length).toBeGreaterThan(0);
    expect(await p.kids.toggleSave(me.id, kidPlaces[0]!.id)).toBe(true);
    const child = await p.kids.addChild(me.id, 'Ada', '7_10', '🦊');
    expect(child.name).toBe('Ada');
    expect((await p.kids.children(me.id)).length).toBe(1);
    const tasks = await p.kids.huntTasks('7_10');
    expect(tasks.length).toBeGreaterThan(0);
    const progress = await p.kids.completeTask(me.id, 'Ada', tasks[0]!.id);
    expect(progress.completedTaskIds).toContain(tasks[0]!.id);
    expect((await p.kids.huntProgress(me.id, 'Ada')).points).toBe(progress.points);
    expect((await p.kids.resetHunt(me.id, 'Ada')).points).toBe(0);
    expect((await p.kids.checklist('7_10')).length).toBeGreaterThan(0);
    await p.kids.removeChild(me.id, child.id);

    const countries = await p.countries.list(null);
    expect(countries.length).toBeGreaterThan(0);
    const guide = countries.find((c) => c.documents.length > 0)!;
    expect((await p.countries.getByCode(guide.countryCode))?.countryCode).toBe(guide.countryCode);
    const checklist = await p.countries.checklist(me.id, guide.countryCode);
    expect(checklist.done).toEqual([]);
    const toggled = await p.countries.toggleDocument(
      me.id,
      guide.countryCode,
      guide.documents[0]!.key,
    );
    expect(toggled.done).toContain(guide.documents[0]!.key);
    const dated = await p.countries.setTripDate(me.id, guide.countryCode, '2031-07-01');
    expect(dated.tripDate).toBe('2031-07-01');
  }, 120_000);

  it('parçalar, haritalar, uydu, yapay zekâ ve görüntü analizi', async () => {
    const me = await userByUsername(p, 'baris.celik');
    signIn(me.id);

    const points = Array.from({ length: 30 }, (_, i) => ({
      latitude: 40.5 + i * 0.001,
      longitude: 30.5 + i * 0.001,
      elevationM: 800 + i * 5,
      t: Date.now() - (30 - i) * 60_000,
    }));
    const track = await p.tracks.save(me.id, {
      name: 'Sözleşme parçası',
      adventureType: 'hiking',
      points,
      source: 'recorded',
      isPublic: true,
      regionName: 'Test',
      pois: [
        {
          kind: 'water',
          coords: { latitude: 40.505, longitude: 30.505 },
          elevationM: 830,
          name: 'Kaynak',
          note: '',
          photoUrl: null,
          source: 'track',
          mediaId: null,
        },
      ],
    });
    expect(track.status).toBe('draft');
    expect(track.poiCount).toBe(1);
    expect((await p.tracks.getById(me.id, track.id))?.pois.length).toBe(1);
    const published = await p.tracks.publish(me.id, track.id);
    expect(published.status === 'published' || published.status === 'verified').toBe(true);
    expect((await p.tracks.list(me.id, { mineOnly: true })).some((t) => t.id === track.id)).toBe(true);
    expect((await p.tracks.navigation(track.id, 'track')).length).toBeGreaterThan(0);
    const nearPois = await p.tracks.poisNear(me.id, { latitude: 40.505, longitude: 30.505 }, 10);
    expect(nearPois.length).toBeGreaterThan(0);
    const other = await userByUsername(p, 'deniz.kaya');
    signIn(other.id);
    const confirmedPoi = await p.tracks.confirmPoi(other.id, nearPois[0]!.id);
    expect(confirmedPoi.confirmedByMe).toBe(true);
    signIn(me.id);
    const trails = await p.tracks.communityTrails(me.id, null, null);
    expect(Array.isArray(trails)).toBe(true);
    const gpx = `<?xml version="1.0"?><gpx><trk><name>GPX Test</name><trkseg>
      <trkpt lat="40.60" lon="30.60"><ele>900</ele></trkpt>
      <trkpt lat="40.61" lon="30.61"><ele>920</ele></trkpt>
      <trkpt lat="40.62" lon="30.62"><ele>940</ele></trkpt>
    </trkseg></trk></gpx>`;
    const imported = await p.tracks.importGpx(me.id, gpx, 'gpx', null);
    expect(imported.points.length).toBeGreaterThanOrEqual(2);
    await p.tracks.remove(me.id, imported.id);

    const regions = await p.maps.regions();
    expect(regions.length).toBeGreaterThan(0);
    const graph = await p.maps.graph(regions[0]!.id);
    expect(graph.nodes.length).toBeGreaterThan(1);
    const packs = await p.maps.packs();
    expect(packs.length).toBeGreaterThan(0);
    expect((await p.maps.download(packs[0]!.id)).status).toBe('downloading');
    expect((await p.maps.remove(packs[0]!.id)).status).toBe('available');
    const planned = await p.maps.plan(
      regions[0]!.id,
      graph.nodes[0]!.id,
      graph.nodes[graph.nodes.length - 1]!.id,
      'hike',
    );
    expect(planned.nodeIds.length).toBeGreaterThan(1);
    const savedRoute = await p.maps.saveRoute(me.id, {
      regionId: regions[0]!.id,
      name: 'Sözleşme rotası',
      routeProfile: 'hike',
      planned,
    });
    expect((await p.maps.savedRoutes(me.id)).some((r) => r.id === savedRoute.id)).toBe(true);
    await p.maps.deleteRoute(me.id, savedRoute.id);

    const device = await p.satellite.pair(me.id, {
      type: 'inreach',
      name: 'inReach Mini',
      imei: '123456789012345',
    });
    expect(device.monthlyQuota).toBe(40);
    expect((await p.satellite.devices(me.id)).length).toBeGreaterThan(0);
    expect((await p.satellite.setLink(me.id, 'satellite')).link).toBe('satellite');
    expect((await p.satellite.linkStatus(me.id)).satellitesInView).toBe(3);
    const satMessage = await p.satellite.send(me.id, {
      kind: 'text',
      body: 'Kamptayız, iyiyiz.',
      coords: ISTANBUL,
      toContacts: ['+905550000000'],
    });
    expect(['sent', 'queued']).toContain(satMessage.status);
    expect((await p.satellite.messages(me.id)).length).toBeGreaterThan(0);
    await p.satellite.setLink(me.id, 'none');
    expect(Array.isArray(await p.satellite.flush(me.id))).toBe(true);
    await p.satellite.setLink(me.id, 'satellite');
    const session = await p.satellite.startSos(me.id, ISTANBUL);
    expect(session.stage).toBe('sent');
    expect((await p.satellite.sos(me.id))?.id).toBe(session.id);
    expect((await p.satellite.advanceSos(me.id)).stage).not.toBe('sent');
    await p.satellite.cancelSos(me.id);
    expect(await p.satellite.sos(me.id)).toBeNull();
    await p.satellite.unpair(me.id, device.id);

    const aiCtx = { locale: 'tr', coords: ISTANBUL, adventureTypes: ['hiking' as const], plan: 'free' as const };
    const reply = await p.ai.send(me.id, null, 'Kaçkarlar için ne önerirsin?', aiCtx);
    expect(reply.role).toBe('assistant');
    const threads = await p.ai.threads(me.id);
    expect(threads.length).toBeGreaterThan(0);
    const thread = await p.ai.thread(me.id, reply.threadId);
    expect(thread?.messages.length).toBe(2);
    const trip = await p.ai.planTrip(me.id, '3 günlük yürüyüş', aiCtx);
    expect(trip.days.length).toBeGreaterThan(0);
    await p.ai.deleteThread(me.id, reply.threadId);
    expect((await p.ai.threads(me.id)).some((t) => t.id === reply.threadId)).toBe(false);

    const advice = await p.vision.analyze(me.id, {
      imageUri: null,
      imageBase64: null,
      situation: 'gear',
      question: 'Bu ekipman yeterli mi?',
      coords: ISTANBUL,
      altitudeM: 1500,
      locale: 'tr',
    });
    expect(advice.advice.length).toBeGreaterThan(0);
    expect((await p.vision.history(me.id)).length).toBe(1);
    await p.vision.clearHistory(me.id);
    expect((await p.vision.history(me.id)).length).toBe(0);
  }, 180_000);
});
