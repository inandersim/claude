#!/usr/bin/env -S npx tsx
/**
 * Zirtan — mock tohum verisini çalıştırılabilir SQL'e çevirir.
 *
 *   npx tsx supabase/seed/export-seed.mjs            → supabase/seed/seed.sql
 *   npx tsx supabase/seed/export-seed.mjs --out x.sql
 *
 * `src/data/mock/seed*.ts` dosyaları KAYNAKTIR; bu betik onları olduğu
 * gibi içe aktarır (tsx TypeScript'i anında derler) ve `TABLES`
 * bildirimine göre INSERT ifadeleri üretir.
 *
 * Kimlikler: mock veri 'u_me', 'p1' gibi metin kimlikler kullanır;
 * şema ise uuid. `uuidFor(tablo, kimlik)` md5 tabanlı DETERMİNİSTİK bir
 * UUIDv5 benzeri üretir — betik her çalıştığında aynı sonucu verir, bu
 * yüzden seed yeniden üretilebilir ve yabancı anahtarlar tutarlıdır.
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as base from '@/data/mock/seed';
import * as extra from '@/data/mock/seed.extra';
import * as ai from '@/data/mock/seed.ai';
import * as climbing from '@/data/mock/seed.climbing';
import * as clubs from '@/data/mock/seed.clubs';
import * as fun from '@/data/mock/seed.fun';
import * as inventory from '@/data/mock/seed.inventory';
import * as maps from '@/data/mock/seed.maps';
import * as satellite from '@/data/mock/seed.satellite';
import * as courses from '@/data/mock/seed.courses';
import * as destinations from '@/data/mock/seed.destinations';
import * as groups from '@/data/mock/seed.groups';
import * as social from '@/data/mock/seed.social';
import * as vision from '@/data/mock/seed.vision';
import * as tracks from '@/data/mock/seed.tracks';
import * as articles from '@/data/mock/seed.articles';
import * as countries from '@/data/mock/seed.countries';
import * as telemed from '@/data/mock/seed.telemed';
import * as wildlife from '@/data/mock/seed.wildlife';
import * as heritage from '@/data/mock/seed.heritage';
import * as kids from '@/data/mock/seed.kids';
import * as tv from '@/data/mock/seed.tv';

/* ------------------------------------------------------------------ */
/* Kimlik ve değer dönüşümleri                                         */
/* ------------------------------------------------------------------ */

/** Mock metin kimliğinden deterministik UUID (v5 benzeri, md5 tabanlı). */
function uuidFor(table, id) {
  const h = createHash('md5').update(`zirtan|${table}|${id}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50; // sürüm 5
  h[8] = (h[8] & 0x3f) | 0x80; // RFC 4122 varyantı
  const hex = h.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const camelToSnake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const qi = (s) => `"${s}"`;

function isGeoPoint(v) {
  return (
    v && typeof v === 'object' && !Array.isArray(v) &&
    typeof v.latitude === 'number' && typeof v.longitude === 'number'
  );
}

function sqlArray(values) {
  // Postgres metin dizisi gösterimi: '{"a","b"}'
  const items = values.map((v) => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  });
  return q(`{${items.join(',')}}`);
}

function sqlJson(value) {
  return `${q(JSON.stringify(value))}::jsonb`;
}

/** Sütun tipi bilgisi olmadan JS değerini SQL sabitine çevirir. */
function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'string') return q(value);
  if (isGeoPoint(value)) return `geo_point(${value.longitude}, ${value.latitude})`;
  if (Array.isArray(value)) {
    if (value.length === 0) return q('{}');
    const primitive = value.every((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v));
    return primitive ? sqlArray(value) : sqlJson(value);
  }
  return sqlJson(value);
}

/* ------------------------------------------------------------------ */
/* Ortak yabancı anahtar sözlüğü                                        */
/* Anahtar: sütun adı (camelCase) · Değer: hedef tablo                  */
/* ------------------------------------------------------------------ */

const COMMON_FK = {
  userId: 'profiles', authorId: 'profiles', senderId: 'profiles', receiverId: 'profiles',
  ownerId: 'profiles', followerId: 'profiles', followingId: 'profiles',
  requesterId: 'profiles', reporterId: 'profiles', guestId: 'profiles',
  studentId: 'profiles', payerId: 'profiles', sellerId: 'profiles', hostId: 'profiles',
  patientId: 'profiles', createdBy: 'profiles', submittedBy: 'profiles',
  blockerId: 'profiles', blockedId: 'profiles', writerUserId: 'profiles',
  invitedBy: 'profiles', contactUserId: 'profiles',
  postId: 'posts', commentId: 'comments', hazardId: 'hazards', listingId: 'listings',
  streamId: 'live_streams', storyId: 'stories', matchId: 'matches',
  businessId: 'businesses', unitId: 'stay_units', bookingId: 'stay_bookings',
  collectionId: 'collections', groupId: 'groups', messageId: 'group_messages',
  clubId: 'clubs', eventId: 'club_events', badgeId: 'badges', challengeId: 'challenges',
  destinationId: 'destinations', courseId: 'courses', lessonId: 'lessons',
  sessionId: 'course_sessions', trackId: 'tracks', poiId: 'track_pois',
  communityTrailId: 'community_trails', trailId: 'community_trails',
  articleId: 'articles', speciesId: 'species', speciesGuessId: 'species',
  doctorId: 'doctors', consultationId: 'consultations', questionId: 'wildlife_questions',
  answerId: 'wildlife_answers', acceptedAnswerId: 'wildlife_answers',
  channelId: 'tv_channels', programId: 'tv_programs', siteId: 'heritage_sites',
  cragId: 'crags', sectorId: 'crag_sectors', deviceId: 'sat_devices',
  regionId: 'map_regions', threadId: 'ai_threads', placeId: 'kid_places',
  rescueCenterId: 'emergency_centers', pinnedMessageId: 'group_messages',
  replyToId: 'group_messages', repostOfId: 'posts', linkedBusinessId: 'businesses',
  linkedTrailId: 'community_trails', linkedDestinationId: 'destinations',
};

/* ------------------------------------------------------------------ */
/* Tablo bildirimleri                                                  */
/* ------------------------------------------------------------------ */

/**
 * table  : hedef SQL tablosu
 * rows   : kaynak dizi
 * idFrom : `id` alanının uuid'i hangi tablo ad alanından üretilecek
 *          (varsayılan: table)
 * fk     : sütun → hedef tablo eşlemesi (COMMON_FK'yi geçersiz kılar)
 * fkArray: uuid dizisi olan sütunlar
 * text   : uuid'e çevrilmeyecek, düz metin kalacak sütunlar
 * rename : camelCase alan → SQL sütunu
 * json   : jsonb'ye zorlanacak alanlar
 * skip   : atlanacak alanlar
 * extra  : (row) => ek sütunlar
 * pk     : ON CONFLICT hedefi (varsayılan: id, yoksa DO NOTHING)
 */
const TABLES = [
  { table: 'profiles', rows: base.seedUsers,
    skip: ['emergencyContacts'],
    extra: (u) => ({ coords: u.coords }) },

  { table: 'emergency_contacts',
    rows: base.seedUsers.flatMap((u) =>
      u.emergencyContacts.map((c, i) => ({
        userId: u.id, name: c.name, phone: c.phone, contactUserId: c.userId, position: i,
      }))),
    noId: true },

  { table: 'follows', rows: base.seedFollows, noId: true },
  { table: 'routes', rows: base.seedRoutes,
    rename: { path: 'path_points' }, json: ['path'] },

  { table: 'posts', rows: [...social.seedStatusPosts, ...base.seedPosts],
    idFrom: 'posts', fk: { routeId: 'routes' }, fkArray: { mentions: 'profiles' } },
  { table: 'comments', rows: base.seedComments },
  { table: 'post_likes', rows: base.seedLikes, noId: true },
  { table: 'reactions', rows: social.seedReactions, noId: true },
  { table: 'collections', rows: social.seedCollections },
  { table: 'saved_posts', rows: social.seedSavedPosts, noId: true },

  { table: 'matches', rows: base.seedMatches },
  { table: 'messages', rows: base.seedMessages },
  { table: 'notifications', rows: base.seedNotifications, text: ['targetId'] },
  { table: 'trending_locations', rows: base.seedLocations },

  { table: 'hazards', rows: base.seedHazards },
  { table: 'hazard_confirmations', rows: base.seedHazardConfirmations, noId: true },

  { table: 'live_streams', rows: [extra.seedDroneStream, ...base.seedStreams],
    idFrom: 'live_streams', json: ['droneTelemetry'] },
  { table: 'stream_messages', rows: base.seedStreamMessages },

  // Mock `Listing`'de satış zamanı yok; kısıt (is_sold ⇔ sold_at) için türetilir.
  { table: 'listings', rows: base.seedListings,
    extra: (l) => ({ sold_at: l.isSold ? l.createdAt : null }) },
  { table: 'listing_favorites', rows: base.seedFavorites, noId: true },

  { table: 'instructors', rows: base.seedInstructors },
  { table: 'instructor_reviews', rows: base.seedInstructorReviews,
    fk: { instructorId: 'instructors' } },
  { table: 'bookings', rows: base.seedBookings, fk: { instructorId: 'instructors' } },

  // Kütüphane: metin kimlikli, veri hattı şemasıyla ortak
  { table: 'places', rows: extra.seedLibrary, textId: true,
    skip: ['image'],
    rename: { elevationM: 'elevation_m', openingHours: 'opening_hours' },
    json: ['names', 'tags'],
    extra: (p) => ({
      group: p.kind,
      dedupe_key: p.id,
      image_url: p.image?.url ?? null,
      image_thumb_url: p.image?.thumbUrl ?? null,
      image_license: p.image?.license ?? null,
      image_author: p.image?.author ?? null,
      image_attribution: p.image?.attribution ?? null,
    }) },

  { table: 'location_shares', rows: extra.seedShares, noId: true },
  { table: 'stories', rows: extra.seedStories },
  { table: 'story_views', rows: extra.seedStoryViews, noId: true },
  { table: 'businesses', rows: extra.seedBusinesses },
  { table: 'stay_bookings', rows: extra.seedStayBookings, idFrom: 'stay_bookings' },
  { table: 'emergency_centers',
    rows: [...extra.seedEmergencyCenters, ...destinations.seedDestinationEmergencyCenters],
    rename: { open24h: 'open_24h' } },

  { table: 'ai_threads', rows: ai.seedAiThreads },
  { table: 'ai_messages', rows: ai.seedAiMessages, json: ['actions'] },

  { table: 'map_regions', rows: maps.seedMapRegions },
  { table: 'trail_nodes',
    rows: maps.seedTrailGraphs.flatMap((g) => g.nodes.map((n) => ({ ...n, regionId: g.regionId }))) },
  { table: 'trail_edges',
    rows: maps.seedTrailGraphs.flatMap((g) =>
      g.edges.map((e) => ({
        id: e.id, regionId: g.regionId, fromNode: e.from, toNode: e.to,
        distanceKm: e.distanceKm, surface: e.surface, profiles: e.profiles, technical: e.technical,
      }))),
    fk: { fromNode: 'trail_nodes', toNode: 'trail_nodes' } },
  { table: 'map_packs', rows: maps.seedMapPacks,
    skip: ['status', 'progress', 'localPath'] },
  { table: 'saved_routes', rows: maps.seedSavedRoutes, json: ['planned'],
    extra: (r) => ({
      distance_km: r.planned?.distanceKm ?? 0,
      ascent_m: Math.round(r.planned?.ascentM ?? 0),
    }) },

  { table: 'crags', rows: climbing.seedCrags },
  { table: 'crag_sectors', rows: climbing.seedSectors },
  { table: 'climbing_routes', rows: climbing.seedClimbingRoutes, idFrom: 'climbing_routes' },
  { table: 'ascents', rows: climbing.seedAscents, fk: { routeId: 'climbing_routes' } },
  { table: 'route_confirmations', rows: climbing.seedRouteConfirmations, noId: true,
    fk: { routeId: 'climbing_routes' } },

  { table: 'sat_devices', rows: satellite.seedSatDevices, skip: ['quotaResetAt'] },
  { table: 'sat_messages', rows: satellite.seedSatMessages },
  { table: 'sos_sessions', rows: satellite.seedSosSessions, json: ['timeline'] },

  { table: 'stay_units', rows: inventory.seedStayUnits, json: ['seasons'] },
  { table: 'stay_bookings', rows: inventory.seedInventoryBookings, idFrom: 'stay_bookings' },
  { table: 'unit_blocks', rows: inventory.seedUnitBlocks,
    skip: ['from', 'to'],
    extra: (b) => ({ during: { raw: `daterange(${q(b.from.slice(0, 10))}::date, ${q(b.to.slice(0, 10))}::date, '[)')` } }) },
  { table: 'payments', rows: inventory.seedPayments, json: ['timeline'] },
  { table: 'stay_reviews', rows: inventory.seedStayReviews },
  { table: 'host_profiles', rows: inventory.seedHostProfiles, noId: true },

  { table: 'clubs', rows: clubs.seedClubs },
  { table: 'club_members', rows: clubs.seedClubMembers, noId: true,
    extra: () => ({ status: 'member' }) },
  { table: 'club_events', rows: clubs.seedClubEvents },
  { table: 'event_rsvps', rows: clubs.seedEventRsvps, noId: true },
  { table: 'student_verifications', rows: clubs.seedStudentVerifications, noId: true },

  { table: 'badges', rows: fun.seedBadges, extra: (b) => ({ code: b.id }) },
  { table: 'earned_badges', rows: fun.seedEarnedBadges, noId: true },
  { table: 'challenges', rows: fun.seedChallenges },
  { table: 'challenge_progress', rows: fun.seedChallengeProgress, noId: true },
  { table: 'xp_events', rows: fun.seedXpEvents },
  { table: 'quiz_questions', rows: fun.seedQuizQuestions },
  { table: 'quiz_attempts', rows: fun.seedQuizAttempts, noId: true,
    rename: { date: 'attempt_date' } },
  { table: 'passport_stamps', rows: fun.seedPassportStamps },

  { table: 'destinations', rows: destinations.seedDestinations,
    skip: ['budgetTry'], json: ['transports', 'permits'],
    extra: (d) => ({ budget_low_try: d.budgetTry.low, budget_high_try: d.budgetTry.high }) },
  { table: 'destination_stages', rows: destinations.seedDestinationStages },
  { table: 'saved_destinations', rows: destinations.seedSavedDestinations, noId: true },
  { table: 'ams_checks', rows: destinations.seedAmsChecks },
  { table: 'return_plans', rows: destinations.seedReturnPlans,
    fkArray: { contactIds: 'profiles' } },

  { table: 'vision_history', rows: vision.seedVisionHistory, json: ['actions'] },

  { table: 'groups', rows: groups.seedGroups },
  { table: 'group_members', rows: groups.seedGroupMembers, noId: true },
  { table: 'group_messages', rows: groups.seedGroupMessages, json: ['poll'],
    fk: { routeId: 'routes' } },
  { table: 'poll_votes', rows: groups.seedPollVotes, noId: true, text: ['optionIds'] },

  { table: 'courses', rows: courses.seedCourses, fk: { instructorId: 'profiles' } },
  { table: 'lessons', rows: courses.seedLessons, json: ['quiz'] },
  { table: 'course_sessions', rows: courses.seedCourseSessions },
  { table: 'enrollments', rows: courses.seedEnrollments,
    fkArray: { completedLessonIds: 'lessons' }, json: ['quizScores'] },
  { table: 'certificates', rows: courses.seedCertificates },
  { table: 'course_reviews', rows: courses.seedCourseReviews },

  { table: 'community_trails', rows: tracks.seedCommunityTrails, json: ['points'] },
  { table: 'tracks', rows: tracks.seedTracks, json: ['points'] },
  { table: 'track_pois', rows: tracks.seedTrackPois, text: ['mediaId'] },
  { table: 'poi_confirmations', rows: tracks.seedPoiConfirmations, noId: true },

  { table: 'country_guides', rows: countries.seedCountryGuides, textId: true,
    idField: 'countryCode', json: ['visa', 'documents'],
    extra: (c) => ({ visa_type: c.visa.type }) },
  { table: 'country_checklists', rows: countries.seedCountryChecklists, noId: true,
    text: ['countryCode'] },

  { table: 'writer_profiles', rows: articles.seedWriters, noId: true },
  { table: 'writer_follows', rows: articles.seedWriterFollows, noId: true },
  { table: 'articles', rows: articles.seedArticles },
  { table: 'article_comments', rows: articles.seedArticleComments },
  { table: 'article_likes', rows: articles.seedArticleLikes, noId: true },
  { table: 'article_saves', rows: articles.seedArticleSaves, noId: true },

  { table: 'species', rows: wildlife.seedSpecies, text: ['firstAidSlug'] },
  { table: 'species_identifications', rows: wildlife.seedIdentifications, json: ['candidates'],
    rename: { imageUri: 'image_uri' } },
  { table: 'wildlife_questions', rows: wildlife.seedWildlifeQuestions },
  { table: 'wildlife_answers', rows: wildlife.seedWildlifeAnswers },
  { table: 'answer_upvotes', rows: wildlife.seedAnswerUpvotes, noId: true },
  { table: 'deterrent_events', rows: wildlife.seedDeterrentEvents },

  { table: 'doctors', rows: telemed.seedDoctors },
  { table: 'consultations', rows: telemed.seedConsultations, text: ['firstAidSlug'] },
  { table: 'consult_messages', rows: telemed.seedConsultMessages },

  { table: 'tv_channels', rows: tv.seedTvChannels },
  { table: 'tv_programs', rows: tv.seedTvPrograms },
  { table: 'tv_schedule', rows: tv.seedTvSchedule },
  { table: 'news_items', rows: tv.seedNews, idFrom: 'news_items' },
  { table: 'watch_progress', rows: tv.seedWatchProgress, noId: true },

  { table: 'heritage_sites', rows: heritage.seedHeritageSites },
  { table: 'audio_guide_stops', rows: heritage.seedAudioGuides },
  { table: 'heritage_tours', rows: heritage.seedHeritageTours,
    fkArray: { siteIds: 'heritage_sites' } },
  { table: 'heritage_visits', rows: heritage.seedHeritageVisits, noId: true,
    rename: { at: 'visited_at' } },

  { table: 'kid_places', rows: kids.seedKidPlaces, text: ['linkedLibraryPlaceId'] },
  { table: 'child_profiles', rows: kids.seedChildren },
  { table: 'hunt_tasks', rows: kids.seedHuntTasks },
  { table: 'hunt_progress', rows: kids.seedHuntProgress, noId: true,
    fkArray: { completedTaskIds: 'hunt_tasks' } },
  { table: 'family_checklist_items', rows: kids.seedFamilyChecklist, textId: true,
    idField: 'key' },
];

/* ------------------------------------------------------------------ */
/* Satır → INSERT                                                      */
/* ------------------------------------------------------------------ */

function buildRow(spec, row) {
  const out = {};
  const fk = { ...COMMON_FK, ...(spec.fk ?? {}) };
  const textCols = new Set(spec.text ?? []);
  const jsonCols = new Set(spec.json ?? []);
  const skip = new Set(spec.skip ?? []);
  const fkArray = spec.fkArray ?? {};
  const idField = spec.idField ?? 'id';

  for (const [key, value] of Object.entries(row)) {
    if (skip.has(key)) continue;
    const col = spec.rename?.[key] ?? camelToSnake(key);

    if (key === idField && !spec.noId) {
      out[col] = spec.textId ? q(value) : q(uuidFor(spec.idFrom ?? spec.table, value));
      continue;
    }
    if (key in fkArray) {
      const target = fkArray[key];
      out[col] = sqlArray((value ?? []).map((v) => uuidFor(target, v)));
      continue;
    }
    if (jsonCols.has(key)) {
      out[col] = value === null || value === undefined ? 'NULL' : sqlJson(value);
      continue;
    }
    // Mock veride bazı zaman alanları boş metin olabilir → sütunu atla,
    // varsayılan (now() ya da NULL) devreye girsin.
    if (value === '' && (/At$/.test(key) || /[Dd]ate$/.test(key))) continue;
    if (!textCols.has(key) && typeof value === 'string' && fk[key]) {
      out[col] = q(uuidFor(fk[key], value));
      continue;
    }
    out[col] = sqlValue(value);
  }

  for (const [col, value] of Object.entries(spec.extra?.(row) ?? {})) {
    out[col] = value && typeof value === 'object' && 'raw' in value ? value.raw : sqlValue(value);
  }
  return out;
}

function buildInsert(spec) {
  const rows = (spec.rows ?? []).filter(Boolean);
  if (rows.length === 0) return `-- ${spec.table}: tohum verisi yok\n`;

  const built = rows.map((r) => buildRow(spec, r));
  // Tüm satırlarda ortak sütun kümesi (eksik alanlar NULL/DEFAULT)
  const columns = [...new Set(built.flatMap((b) => Object.keys(b)))];

  const values = built
    .map((b) => `  (${columns.map((c) => b[c] ?? 'DEFAULT').join(', ')})`)
    .join(',\n');

  return [
    `-- ${spec.table} (${rows.length} satır)`,
    `INSERT INTO ${qi(spec.table)} (${columns.map(qi).join(', ')}) VALUES`,
    values,
    'ON CONFLICT DO NOTHING;',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* auth.users — profillerin dayandığı kimlik satırları                 */
/* ------------------------------------------------------------------ */

function buildAuthUsers() {
  const rows = base.seedUsers.map((u) => {
    const id = uuidFor('profiles', u.id);
    const email = `${u.username.replace(/[^a-z0-9.]/gi, '')}@zirtan.test`;
    const meta = JSON.stringify({ username: u.username, display_name: u.displayName, avatar_url: u.avatarUrl });
    return `  (${q(id)}, ${q(email)}, ${q(meta)}::jsonb, ${q(u.joinedAt)}::timestamptz)`;
  });
  return [
    '-- auth.users — YALNIZCA DEMO. Üretimde kullanıcılar Supabase Auth ile',
    '-- kayıt olur; bu blok yerel geliştirme içindir.',
    'INSERT INTO auth.users (id, email, raw_user_meta_data, created_at) VALUES',
    rows.join(',\n'),
    'ON CONFLICT (id) DO NOTHING;',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Üretim                                                              */
/* ------------------------------------------------------------------ */

const HEADER = `-- =====================================================================
-- Zirtan — DEMO TOHUM VERİSİ (otomatik üretilmiştir, elle düzenlemeyin)
--
--   Kaynak : src/data/mock/seed*.ts
--   Üretim : npx tsx supabase/seed/export-seed.mjs
--   Üretim tarihi: ${new Date().toISOString()}
--
-- Tetikleyiciler tohumlama boyunca kapatılır (session_replication_role):
-- sayaçlar, XP olayları ve sertifika kodları mock veriden geldiği gibi
-- yazılır, sonra tutarlılık için yeniden hesaplanır.
-- =====================================================================

SET search_path = public, extensions;

BEGIN;
-- Tetikleyicileri ve FK kontrollerini geçici olarak devre dışı bırak.
SET LOCAL session_replication_role = replica;
`;

const FOOTER = `
-- --------------------------------------------------------------------
-- Tutarlılık: tetikleyiciler kapalıyken yazılan türetilmiş alanları
-- yeniden hesapla.
-- --------------------------------------------------------------------

-- Var olmayan ilk yardım rehberlerine yapılan atıfları temizle.
UPDATE species       SET first_aid_slug = NULL
 WHERE first_aid_slug IS NOT NULL
   AND first_aid_slug NOT IN (SELECT slug FROM first_aid_guides);
UPDATE consultations SET first_aid_slug = NULL
 WHERE first_aid_slug IS NOT NULL
   AND first_aid_slug NOT IN (SELECT slug FROM first_aid_guides);

-- Toplam XP (profiles.xp) xp_events'ten türetilir.
UPDATE profiles p
   SET xp = coalesce((SELECT sum(e.amount)::integer FROM xp_events e WHERE e.user_id = p.id), 0);

-- Takip sayaçları
UPDATE profiles p SET
  followers_count = (SELECT count(*) FROM follows WHERE following_id = p.id),
  following_count = (SELECT count(*) FROM follows WHERE follower_id  = p.id);

-- Gönderi sayaçları
UPDATE posts x SET
  likes_count    = (SELECT count(*) FROM post_likes  WHERE post_id = x.id),
  comments_count = (SELECT count(*) FROM comments    WHERE post_id = x.id),
  saves_count    = (SELECT count(*) FROM saved_posts WHERE post_id = x.id),
  reposts_count  = (SELECT count(*) FROM posts r     WHERE r.repost_of_id = x.id);

-- Tehlike / rota / nokta onayları
UPDATE hazards h SET confirmations =
  (SELECT count(*) FROM hazard_confirmations WHERE hazard_id = h.id);
UPDATE climbing_routes r SET
  confirmations = (SELECT count(*) FROM route_confirmations WHERE route_id = r.id),
  ascent_count  = (SELECT count(*) FROM ascents             WHERE route_id = r.id);
UPDATE track_pois p SET confirmations =
  (SELECT count(*) FROM poi_confirmations WHERE poi_id = p.id);
UPDATE community_trails t SET verified_count =
  (SELECT count(*) FROM trail_verifications WHERE trail_id = t.id);

-- Üyelik sayaçları
UPDATE groups g SET member_count = (SELECT count(*) FROM group_members WHERE group_id = g.id);
UPDATE clubs  c SET member_count = (SELECT count(*) FROM club_members  WHERE club_id  = c.id);

-- Yazı / makale sayaçları
UPDATE articles a SET
  likes_count    = (SELECT count(*) FROM article_likes    WHERE article_id = a.id),
  comments_count = (SELECT count(*) FROM article_comments WHERE article_id = a.id);
UPDATE writer_profiles w SET
  follower_count = (SELECT count(*) FROM writer_follows WHERE writer_user_id = w.user_id),
  article_count  = (SELECT count(*) FROM articles WHERE author_id = w.user_id AND status <> 'draft');

-- Soru-cevap
UPDATE wildlife_questions q SET answers_count =
  (SELECT count(*) FROM wildlife_answers WHERE question_id = q.id);
UPDATE wildlife_answers a SET upvotes =
  (SELECT count(*) FROM answer_upvotes WHERE answer_id = a.id);

-- Kurs / destinasyon / kaya sayaçları
UPDATE courses c SET
  lesson_count   = (SELECT count(*) FROM lessons     WHERE course_id = c.id),
  enrolled_count = (SELECT count(*) FROM enrollments WHERE course_id = c.id);
UPDATE destinations d SET stage_count =
  (SELECT count(*) FROM destination_stages WHERE destination_id = d.id);
UPDATE crags c SET route_count =
  (SELECT count(*) FROM climbing_routes WHERE crag_id = c.id);
UPDATE crag_sectors s SET route_count =
  (SELECT count(*) FROM climbing_routes WHERE sector_id = s.id);

-- Coğrafi türetmeler (tetikleyiciler kapalıyken atlandı)
UPDATE routes           SET path = geo_linestring(path_points)      WHERE path IS NULL;
UPDATE tracks           SET path = geo_linestring(points)           WHERE path IS NULL;
UPDATE community_trails SET path = geo_linestring(points)           WHERE path IS NULL;
UPDATE saved_routes     SET path = geo_linestring(planned->'points') WHERE path IS NULL;

SET LOCAL session_replication_role = origin;
COMMIT;

ANALYZE;
`;

const outArgIndex = process.argv.indexOf('--out');
const here = dirname(fileURLToPath(import.meta.url));
const outPath = outArgIndex > -1
  ? resolve(process.argv[outArgIndex + 1])
  : resolve(here, 'seed.sql');

const parts = [HEADER, buildAuthUsers()];
let total = 0;
for (const spec of TABLES) {
  parts.push(buildInsert(spec));
  total += (spec.rows ?? []).filter(Boolean).length;
}
parts.push(FOOTER);

writeFileSync(outPath, parts.join('\n'));
console.log(`✓ ${outPath}`);
console.log(`  ${TABLES.length} tablo bildirimi · ${total} satır`);
