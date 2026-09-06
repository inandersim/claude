import type {
  AiMessage,
  AiThread,
  AmsCheck,
  Article,
  ArticleComment,
  Ascent,
  AudioGuideStop,
  Availability,
  AvalancheBulletin,
  Badge,
  Booking,
  Business,
  Certificate,
  Challenge,
  ChallengeProgress,
  ChildProfile,
  ClimbingRoute,
  Club,
  ClubEvent,
  Collection,
  Comment,
  CommunityTrail,
  Consultation,
  ConsultMessage,
  CountryChecklist,
  CountryGuide,
  Course,
  CourseReview,
  CourseSession,
  Crag,
  CragSector,
  Destination,
  DestinationStage,
  DeterrentEvent,
  DeterrentProfile,
  Doctor,
  EmergencyCenter,
  EmergencyContact,
  Enrollment,
  FamilyChecklistItem,
  GeoPoint,
  Group,
  GroupMember,
  GroupMessage,
  HazardZone,
  HeritageSite,
  HeritageTour,
  HostProfile,
  HuntProgress,
  HuntTask,
  ID,
  ISODate,
  Instructor,
  InstructorReview,
  KidPlace,
  Lesson,
  LibraryPlace,
  Listing,
  LiveStream,
  LocationShare,
  MapPack,
  Message,
  NewsItem,
  Notification,
  PassportStamp,
  Payment,
  Post,
  QuizQuestion,
  ReturnPlan,
  Route,
  SatDevice,
  SatMessage,
  SavedRoute,
  SosEvent,
  SosSession,
  Species,
  SpeciesIdentification,
  StayBooking,
  StayReview,
  StayUnit,
  Story,
  StreamMessage,
  StudentVerification,
  Track,
  TrackPoi,
  TrackPoint,
  TrailEdge,
  TrailNode,
  TrendingLocation,
  TvChannel,
  TvProgram,
  TvSchedule,
  UnitBlock,
  User,
  VisionHistoryItem,
  WildlifeAnswer,
  WildlifeQuestion,
  WriterProfile,
  XpEvent,
  ZMatch,
} from '@/domain';

import type { Row } from './postgrest';

/* ------------------------------------------------------------------ */
/* İlkel dönüştürücüler                                                */
/* ------------------------------------------------------------------ */

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

export function strOrNull(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : String(value);
}

/**
 * `numeric` sütunları PostgREST'te JSON sayısı, `pg` sürücüsünde metin olarak
 * gelebilir; ikisini de tek biçime indirger.
 */
export function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = num(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 't') return true;
  if (value === 'false' || value === 'f') return false;
  return fallback;
}

/** Zaman damgalarını her iki sağlayıcıda da aynı biçime (`…Z`) çeker. */
export function iso(value: unknown, fallback: ISODate = new Date(0).toISOString()): ISODate {
  const parsed = isoOrNull(value);
  return parsed ?? fallback;
}

export function isoOrNull(value: unknown): ISODate | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  if (!text) return null;
  // Yalnızca gün (date sütunu) → günün başlangıcı, UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00.000Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** `date` sütunları için YYYY-MM-DD biçimi. */
export function dayKey(value: unknown): string {
  const text = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = isoOrNull(value);
  return parsed ? parsed.slice(0, 10) : '';
}

export function strArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => str(v));
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    // Postgres dizi metni (yalnızca uyarlayıcı tip çözümlemesi devre dışıysa)
    const inner = value.slice(1, -1);
    return inner ? inner.split(',').map((v) => v.replace(/^"|"$/g, '')) : [];
  }
  return [];
}

export function numArray(value: unknown): number[] {
  return strArray(value)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
}

/** `<T>` dizilerinin (enum dizileri) tipli hâli. */
export function enumArray<T extends string>(value: unknown): T[] {
  return strArray(value) as T[];
}

export function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/* ------------------------------------------------------------------ */
/* Coğrafi nokta                                                       */
/* ------------------------------------------------------------------ */

const ZERO_POINT: GeoPoint = { latitude: 0, longitude: 0 };

/** IEEE-754 double okur (little/big endian). */
function readDouble(hex: string, offset: number, little: boolean): number {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = parseInt(hex.slice(offset + i * 2, offset + i * 2 + 2), 16);
  }
  const view = new DataView(bytes.buffer);
  return view.getFloat64(0, little);
}

function readUint32(hex: string, offset: number, little: boolean): number {
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    bytes[i] = parseInt(hex.slice(offset + i * 2, offset + i * 2 + 2), 16);
  }
  return new DataView(bytes.buffer).getUint32(0, little);
}

/**
 * PostGIS `geography(Point)` sütununun onaltılık EWKB gösterimini çözer.
 * Örn. `0101000020E6100000...` → { latitude, longitude }.
 */
export function parseEwkbPoint(hex: string): GeoPoint | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) return null;
  const little = hex.slice(0, 2) === '01';
  let offset = 2;
  const rawType = readUint32(hex, offset, little);
  offset += 8;
  const hasSrid = (rawType & 0x20000000) !== 0;
  const hasZ = (rawType & 0x80000000) !== 0;
  const hasM = (rawType & 0x40000000) !== 0;
  if ((rawType & 0xffff) !== 1) return null; // yalnızca Point
  if (hasSrid) offset += 8;
  const lng = readDouble(hex, offset, little);
  const lat = readDouble(hex, offset + 16, little);
  if (hasZ || hasM) {
    /* Z/M bileşenleri yok sayılır. */
  }
  return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
}

/**
 * Coğrafi noktayı domain biçimine çevirir. Kaynak; EWKB onaltılık metin
 * (PostgREST/`pg` varsayılanı), GeoJSON nesnesi, WKT metni ya da
 * `{lat,lng}` benzeri bir nesne olabilir.
 */
export function toGeoPoint(value: unknown, fallback: GeoPoint | null = null): GeoPoint | null {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const text = value.trim();
    const wkt = /POINT\s*\(\s*(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s*\)/i.exec(text);
    if (wkt?.[1] && wkt[2]) {
      return { latitude: Number(wkt[2]), longitude: Number(wkt[1]) };
    }
    return parseEwkbPoint(text.replace(/^SRID=\d+;/i, '')) ?? fallback;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.coordinates)) {
      const [lng, lat] = obj.coordinates as unknown[];
      const latitude = num(lat, Number.NaN);
      const longitude = num(lng, Number.NaN);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    }
    const latitude = obj.latitude ?? obj.lat;
    const longitude = obj.longitude ?? obj.lng ?? obj.lon;
    if (latitude != null && longitude != null) {
      return { latitude: num(latitude), longitude: num(longitude) };
    }
  }
  return fallback;
}

/** Zorunlu koordinat alanları için (0,0)'a düşer. */
export function requireGeoPoint(value: unknown): GeoPoint {
  return toGeoPoint(value, ZERO_POINT) ?? ZERO_POINT;
}

/** Domain noktasını PostGIS'in kabul ettiği WKT metnine çevirir. */
export function fromGeoPoint(point: GeoPoint | null | undefined): string | null {
  if (!point) return null;
  return `SRID=4326;POINT(${point.longitude} ${point.latitude})`;
}

/** LineString yazımı (rota/parça yolları). */
export function fromGeoLine(points: { latitude: number; longitude: number }[]): string | null {
  if (points.length < 2) return null;
  const body = points.map((p) => `${p.longitude} ${p.latitude}`).join(',');
  return `SRID=4326;LINESTRING(${body})`;
}

/** `[lng,lat]` çiftlerinden oluşan jsonb yol noktalarını domain'e çevirir. */
export function toGeoPath(value: unknown): GeoPoint[] {
  const raw = json<unknown[]>(value, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => toGeoPoint(p)).filter((p): p is GeoPoint => p !== null);
}

/** Domain noktalarını jsonb yol biçimine çevirir. */
export function fromGeoPath(points: GeoPoint[]): { latitude: number; longitude: number }[] {
  return points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
}

/** `daterange` metnini `[from, to)` gün anahtarlarına ayırır. */
export function parseDateRange(value: unknown): { from: string; to: string } {
  const text = String(value ?? '');
  const match = /^[[(]"?(\d{4}-\d{2}-\d{2})"?,"?(\d{4}-\d{2}-\d{2})"?[\])]$/.exec(text);
  if (!match?.[1] || !match[2]) return { from: '', to: '' };
  return { from: match[1], to: match[2] };
}

export function toDateRange(from: string, to: string): string {
  return `[${dayKey(from)},${dayKey(to)})`;
}

/* ------------------------------------------------------------------ */
/* Çekirdek                                                            */
/* ------------------------------------------------------------------ */

export function toEmergencyContact(row: Row): EmergencyContact {
  return {
    name: str(row.name),
    phone: str(row.phone),
    userId: strOrNull(row.contact_user_id),
  };
}

/**
 * `profiles` satırını `User`'a çevirir. Acil kişiler ayrı tabloda tutulur;
 * gömülü seçimle (`emergency_contacts(*)`) geldiyse doldurulur.
 */
export function toUser(row: Row): User {
  const contacts = Array.isArray(row.emergency_contacts)
    ? (row.emergency_contacts as Row[])
        .slice()
        .sort((a, b) => num(a.position) - num(b.position))
        .map(toEmergencyContact)
    : [];
  return {
    id: str(row.id),
    username: str(row.username),
    displayName: str(row.display_name),
    avatarUrl: strOrNull(row.avatar_url),
    coverUrl: strOrNull(row.cover_url),
    bio: str(row.bio),
    locationName: str(row.location_name),
    coords: requireGeoPoint(row.coords),
    isVerified: bool(row.is_verified),
    totalDistanceKm: num(row.total_distance_km),
    totalAdventures: num(row.total_adventures),
    followersCount: num(row.followers_count),
    followingCount: num(row.following_count),
    trustScore: num(row.trust_score),
    favoriteTypes: enumArray<User['favoriteTypes'][number]>(row.favorite_types),
    joinedAt: iso(row.joined_at ?? row.created_at),
    plan: (str(row.plan, 'free') as User['plan']) ?? 'free',
    emergencyContacts: contacts,
  };
}

export function toPost(row: Row): Post {
  return {
    id: str(row.id),
    authorId: str(row.author_id),
    imageUrl: strOrNull(row.image_url),
    caption: str(row.caption),
    adventureType: str(row.adventure_type, 'hiking') as Post['adventureType'],
    difficulty: str(row.difficulty, 'easy') as Post['difficulty'],
    altitudeM: num(row.altitude_m),
    distanceKm: num(row.distance_km),
    temperatureC: num(row.temperature_c),
    windKmh: num(row.wind_kmh),
    trailCondition: str(row.trail_condition, 'good') as Post['trailCondition'],
    durationMin: num(row.duration_min),
    locationName: str(row.location_name),
    coords: requireGeoPoint(row.coords),
    likesCount: num(row.likes_count),
    commentsCount: num(row.comments_count),
    isVerifiedInfo: bool(row.is_verified_info),
    routeId: strOrNull(row.route_id),
    createdAt: iso(row.created_at),
    kind: str(row.kind, 'adventure') as Post['kind'],
    images: strArray(row.images),
    hashtags: strArray(row.hashtags),
    mentions: strArray(row.mentions),
    repostOfId: strOrNull(row.repost_of_id),
    savesCount: num(row.saves_count),
    repostsCount: num(row.reposts_count),
  };
}

export function toComment(row: Row): Comment {
  return {
    id: str(row.id),
    postId: str(row.post_id),
    authorId: str(row.author_id),
    content: str(row.content),
    createdAt: iso(row.created_at),
  };
}

export function toRoute(row: Row): Route {
  return {
    id: str(row.id),
    name: str(row.name),
    adventureType: str(row.adventure_type, 'hiking') as Route['adventureType'],
    difficulty: str(row.difficulty, 'easy') as Route['difficulty'],
    distanceKm: num(row.distance_km),
    elevationGainM: num(row.elevation_gain_m),
    locationName: str(row.location_name),
    path: toGeoPath(row.path_points),
  };
}

export function toTrendingLocation(row: Row): TrendingLocation {
  return {
    id: str(row.id),
    name: str(row.name),
    region: str(row.region),
    description: str(row.description),
    imageUrl: strOrNull(row.image_url),
    adventureTypes: enumArray<TrendingLocation['adventureTypes'][number]>(row.adventure_types),
    difficulty: str(row.difficulty, 'easy') as TrendingLocation['difficulty'],
    postsCount: num(row.posts_count),
    coords: requireGeoPoint(row.coords),
    bestSeason: str(row.best_season),
    trendPercent: num(row.trend_percent),
  };
}

export function toMatch(row: Row): ZMatch {
  return {
    id: str(row.id),
    requesterId: str(row.requester_id),
    receiverId: str(row.receiver_id),
    status: str(row.status, 'pending') as ZMatch['status'],
    message: str(row.message),
    plannedDate: isoOrNull(row.planned_date),
    locationName: strOrNull(row.location_name),
    adventureType: str(row.adventure_type, 'hiking') as ZMatch['adventureType'],
    createdAt: iso(row.created_at),
    respondedAt: isoOrNull(row.responded_at),
  };
}

export function toMessage(row: Row): Message {
  return {
    id: str(row.id),
    senderId: str(row.sender_id),
    receiverId: str(row.receiver_id),
    content: str(row.content),
    matchId: strOrNull(row.match_id),
    createdAt: iso(row.created_at),
    readAt: isoOrNull(row.read_at),
  };
}

export function toNotification(row: Row): Notification {
  return {
    id: str(row.id),
    type: str(row.type, 'like') as Notification['type'],
    senderId: str(row.sender_id),
    receiverId: str(row.receiver_id),
    message: str(row.message),
    isRead: bool(row.is_read),
    postId: strOrNull(row.post_id),
    matchId: strOrNull(row.match_id),
    targetId: strOrNull(row.target_id),
    createdAt: iso(row.created_at),
  };
}

export function toHazard(row: Row): HazardZone {
  return {
    id: str(row.id),
    type: str(row.type, 'other') as HazardZone['type'],
    severity: str(row.severity, 'low') as HazardZone['severity'],
    status: str(row.status, 'active') as HazardZone['status'],
    title: str(row.title),
    description: str(row.description),
    locationName: str(row.location_name),
    coords: requireGeoPoint(row.coords),
    radiusM: num(row.radius_m),
    reporterId: str(row.reporter_id),
    confirmations: num(row.confirmations),
    createdAt: iso(row.created_at),
    expiresAt: isoOrNull(row.expires_at),
    resolvedAt: isoOrNull(row.resolved_at),
  };
}

export function toLiveStream(row: Row): LiveStream {
  return {
    id: str(row.id),
    hostId: str(row.host_id),
    title: str(row.title),
    description: str(row.description),
    adventureType: str(row.adventure_type, 'hiking') as LiveStream['adventureType'],
    status: str(row.status, 'live') as LiveStream['status'],
    locationName: str(row.location_name),
    coords: requireGeoPoint(row.coords),
    viewerCount: num(row.viewer_count),
    peakViewers: num(row.peak_viewers),
    likesCount: num(row.likes_count),
    thumbnailUrl: strOrNull(row.thumbnail_url),
    playbackUrl: strOrNull(row.playback_url),
    scheduledAt: isoOrNull(row.scheduled_at),
    startedAt: isoOrNull(row.started_at),
    endedAt: isoOrNull(row.ended_at),
    altitudeM: numOrNull(row.altitude_m),
    source: str(row.source, 'camera') as LiveStream['source'],
    droneTelemetry: json<LiveStream['droneTelemetry']>(row.drone_telemetry, null),
  };
}

export function toStreamMessage(row: Row): StreamMessage {
  return {
    id: str(row.id),
    streamId: str(row.stream_id),
    authorId: str(row.author_id),
    content: str(row.content),
    createdAt: iso(row.created_at),
  };
}

export function toListing(row: Row): Listing {
  return {
    id: str(row.id),
    sellerId: str(row.seller_id),
    title: str(row.title),
    description: str(row.description),
    priceTry: num(row.price_try),
    category: str(row.category, 'other') as Listing['category'],
    condition: str(row.condition, 'good') as Listing['condition'],
    imageUrls: strArray(row.image_urls),
    locationName: str(row.location_name),
    coords: requireGeoPoint(row.coords),
    adventureTypes: enumArray<Listing['adventureTypes'][number]>(row.adventure_types),
    isSold: bool(row.is_sold),
    favoritesCount: num(row.favorites_count),
    createdAt: iso(row.created_at),
  };
}

export function toInstructor(row: Row): Instructor {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    headline: str(row.headline),
    bio: str(row.bio),
    specialties: enumArray<Instructor['specialties'][number]>(row.specialties),
    certifications: strArray(row.certifications),
    rating: num(row.rating),
    reviewCount: num(row.review_count),
    pricePerSessionTry: num(row.price_per_session_try),
    sessionDurationMin: num(row.session_duration_min),
    languages: strArray(row.languages),
    yearsExperience: num(row.years_experience),
    locationName: str(row.location_name),
    coords: requireGeoPoint(row.coords),
    availableDays: numArray(row.available_days),
    studentsCount: num(row.students_count),
  };
}

export function toInstructorReview(row: Row): InstructorReview {
  return {
    id: str(row.id),
    instructorId: str(row.instructor_id),
    authorId: str(row.author_id),
    rating: num(row.rating),
    content: str(row.content),
    createdAt: iso(row.created_at),
  };
}

export function toBooking(row: Row): Booking {
  return {
    id: str(row.id),
    instructorId: str(row.instructor_id),
    studentId: str(row.student_id),
    adventureType: str(row.adventure_type, 'hiking') as Booking['adventureType'],
    date: iso(row.date),
    message: str(row.message),
    status: str(row.status, 'pending') as Booking['status'],
    priceTry: num(row.price_try),
    createdAt: iso(row.created_at),
    respondedAt: isoOrNull(row.responded_at),
  };
}

export function toLibraryPlace(row: Row): LibraryPlace {
  const imageUrl = strOrNull(row.image_url);
  return {
    id: str(row.id),
    source: str(row.source, 'curated') as LibraryPlace['source'],
    kind: str(row.kind, 'peak') as LibraryPlace['kind'],
    name: str(row.name),
    names: json<Record<string, string>>(row.names, {}),
    adventureTypes: enumArray<LibraryPlace['adventureTypes'][number]>(row.adventure_types),
    lat: num(row.lat),
    lng: num(row.lng),
    elevationM: numOrNull(row.elevation_m),
    description: strOrNull(row.description),
    website: strOrNull(row.website),
    phone: strOrNull(row.phone),
    openingHours: strOrNull(row.opening_hours),
    countryCode: strOrNull(row.country_code),
    tags: json<Record<string, string>>(row.tags, {}),
    wikidataId: strOrNull(row.wikidata_id),
    image: imageUrl
      ? {
          url: imageUrl,
          thumbUrl: str(row.image_thumb_url, imageUrl),
          license: str(row.image_license),
          author: str(row.image_author),
          attribution: str(row.image_attribution),
        }
      : null,
    license: str(row.license),
    attribution: str(row.attribution),
    updatedAt: iso(row.updated_at),
  };
}

export function toLocationShare(row: Row): LocationShare {
  return {
    userId: str(row.user_id),
    coords: requireGeoPoint(row.coords),
    mode: str(row.mode, 'friends') as LocationShare['mode'],
    startedAt: iso(row.started_at),
    expiresAt: isoOrNull(row.expires_at),
    updatedAt: iso(row.updated_at),
    batteryPct: numOrNull(row.battery_pct),
    altitudeM: numOrNull(row.altitude_m),
    speedKmh: numOrNull(row.speed_kmh),
  };
}

export function toStory(row: Row): Story {
  return {
    id: str(row.id),
    authorId: str(row.author_id),
    mediaUrl: strOrNull(row.media_url),
    mediaType: str(row.media_type, 'image') as Story['mediaType'],
    caption: str(row.caption),
    adventureType: str(row.adventure_type, 'hiking') as Story['adventureType'],
    locationName: str(row.location_name),
    coords: requireGeoPoint(row.coords),
    altitudeM: numOrNull(row.altitude_m),
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    viewsCount: num(row.views_count),
  };
}

export function toBusiness(row: Row): Business {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    name: str(row.name),
    type: str(row.type, 'other') as Business['type'],
    description: str(row.description),
    locationName: str(row.location_name),
    coords: requireGeoPoint(row.coords),
    imageUrl: strOrNull(row.image_url),
    rating: num(row.rating),
    reviewCount: num(row.review_count),
    isVerified: bool(row.is_verified),
    priceFromTry: numOrNull(row.price_from_try),
    amenities: strArray(row.amenities),
    adventureTypes: enumArray<Business['adventureTypes'][number]>(row.adventure_types),
    website: strOrNull(row.website),
    phone: strOrNull(row.phone),
    plan: str(row.plan, 'free') as Business['plan'],
    isFeatured: bool(row.is_featured),
    createdAt: iso(row.created_at),
  };
}

export function toStayBooking(row: Row): StayBooking {
  return {
    id: str(row.id),
    businessId: str(row.business_id),
    unitId: strOrNull(row.unit_id),
    guestId: str(row.guest_id),
    checkIn: iso(row.check_in),
    checkOut: iso(row.check_out),
    guests: num(row.guests),
    nights: num(row.nights),
    totalTry: num(row.total_try),
    platformFeeTry: num(row.platform_fee_try),
    status: str(row.status, 'pending') as StayBooking['status'],
    createdAt: iso(row.created_at),
  };
}

export function toEmergencyCenter(row: Row): EmergencyCenter {
  return {
    id: str(row.id),
    name: str(row.name),
    type: str(row.type, 'other') as EmergencyCenter['type'],
    coords: requireGeoPoint(row.coords),
    locationName: str(row.location_name),
    phone: strOrNull(row.phone),
    open24h: bool(row.open_24h),
    countryCode: str(row.country_code),
  };
}

export function toSosEvent(row: Row): SosEvent {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    coords: requireGeoPoint(row.coords),
    createdAt: iso(row.created_at),
    resolvedAt: isoOrNull(row.resolved_at),
    notifiedContacts: num(row.notified_contacts),
  };
}

/* ------------------------------------------------------------------ */
/* Yapay zekâ, harita, tırmanış, uydu                                  */
/* ------------------------------------------------------------------ */

export function toAiThread(row: Row): AiThread {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    title: str(row.title),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toAiMessage(row: Row): AiMessage {
  return {
    id: str(row.id),
    threadId: str(row.thread_id),
    role: str(row.role, 'assistant') as AiMessage['role'],
    content: str(row.content),
    intent: (strOrNull(row.intent) as AiMessage['intent']) ?? null,
    actions: json<AiMessage['actions']>(row.actions, []),
    createdAt: iso(row.created_at),
  };
}

export function toTrailNode(row: Row): TrailNode {
  return {
    id: str(row.id),
    coords: requireGeoPoint(row.coords),
    elevationM: num(row.elevation_m),
    name: strOrNull(row.name),
  };
}

export function toTrailEdge(row: Row): TrailEdge {
  return {
    id: str(row.id),
    from: str(row.from_node),
    to: str(row.to_node),
    distanceKm: num(row.distance_km),
    surface: str(row.surface, 'trail') as TrailEdge['surface'],
    profiles: enumArray<TrailEdge['profiles'][number]>(row.profiles),
    technical: num(row.technical),
  };
}

export function toMapPack(row: Row): MapPack {
  const download = (row.map_pack_downloads ?? row.download) as Row | Row[] | undefined;
  const state = Array.isArray(download) ? download[0] : download;
  return {
    id: str(row.id),
    name: str(row.name),
    countryCode: str(row.country_code),
    bbox: (numArray(row.bbox).slice(0, 4) as MapPack['bbox']) ?? [0, 0, 0, 0],
    sizeMb: num(row.size_mb),
    version: str(row.version),
    format: 'pmtiles',
    status: str(state?.status, 'idle') as MapPack['status'],
    progress: num(state?.progress),
    updatedAt: iso(row.updated_at),
    localPath: state && str(state.status) === 'ready' ? `/packs/${str(row.id)}.pmtiles` : null,
  };
}

export function toSavedRoute(row: Row): SavedRoute {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    regionId: str(row.region_id),
    name: str(row.name),
    routeProfile: str(row.route_profile, 'hike') as SavedRoute['routeProfile'],
    planned: json<SavedRoute['planned']>(row.planned, {
      nodeIds: [],
      points: [],
      distanceKm: 0,
      ascentM: 0,
      descentM: 0,
      durationMin: 0,
      maxElevationM: 0,
      minElevationM: 0,
      profile: [],
      surfaces: {},
    }),
    createdAt: iso(row.created_at),
  };
}

export function toCrag(row: Row): Crag {
  return {
    id: str(row.id),
    name: str(row.name),
    locationName: str(row.location_name),
    countryCode: str(row.country_code),
    coords: requireGeoPoint(row.coords),
    rockType: str(row.rock_type),
    description: str(row.description),
    imageUrl: strOrNull(row.image_url),
    climbTypes: enumArray<Crag['climbTypes'][number]>(row.climb_types),
    routeCount: num(row.route_count),
    verification: str(row.verification, 'unverified') as Crag['verification'],
    seasons: numArray(row.seasons),
    approachMin: num(row.approach_min),
    updatedAt: iso(row.updated_at),
  };
}

export function toCragSector(row: Row): CragSector {
  return {
    id: str(row.id),
    cragId: str(row.crag_id),
    name: str(row.name),
    orientation: str(row.orientation),
    routeCount: num(row.route_count),
  };
}

export function toClimbingRoute(row: Row): ClimbingRoute {
  return {
    id: str(row.id),
    cragId: str(row.crag_id),
    sectorId: str(row.sector_id),
    name: str(row.name),
    type: str(row.type, 'sport') as ClimbingRoute['type'],
    grade: str(row.grade),
    gradeSystem: str(row.grade_system, 'french') as ClimbingRoute['gradeSystem'],
    lengthM: numOrNull(row.length_m),
    pitches: num(row.pitches, 1),
    bolts: numOrNull(row.bolts),
    stars: num(row.stars),
    firstAscent: strOrNull(row.first_ascent),
    description: str(row.description),
    verification: str(row.verification, 'unverified') as ClimbingRoute['verification'],
    confirmations: num(row.confirmations),
    ascentCount: num(row.ascent_count),
    submittedBy: strOrNull(row.submitted_by),
    createdAt: iso(row.created_at),
  };
}

export function toAscent(row: Row): Ascent {
  return {
    id: str(row.id),
    routeId: str(row.route_id),
    userId: str(row.user_id),
    style: str(row.style, 'redpoint') as Ascent['style'],
    date: iso(row.date),
    note: str(row.note),
    feltGrade: strOrNull(row.felt_grade),
  };
}

export function toSatDevice(row: Row): SatDevice {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    type: str(row.type, 'inreach') as SatDevice['type'],
    name: str(row.name),
    imei: strOrNull(row.imei),
    batteryPct: numOrNull(row.battery_pct),
    pairedAt: iso(row.paired_at),
    lastSeenAt: isoOrNull(row.last_seen_at),
    monthlyQuota: num(row.monthly_quota),
    usedThisMonth: num(row.used_this_month),
  };
}

export function toSatMessage(row: Row): SatMessage {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    deviceId: strOrNull(row.device_id),
    kind: str(row.kind, 'text') as SatMessage['kind'],
    body: str(row.body),
    coords: toGeoPoint(row.coords),
    toContacts: strArray(row.to_contacts),
    status: str(row.status, 'queued') as SatMessage['status'],
    link: str(row.link, 'none') as SatMessage['link'],
    createdAt: iso(row.created_at),
    deliveredAt: isoOrNull(row.delivered_at),
    attempts: num(row.attempts),
  };
}

export function toSosSession(row: Row): SosSession {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    stage: str(row.stage, 'idle') as SosSession['stage'],
    coords: requireGeoPoint(row.coords),
    startedAt: iso(row.started_at),
    updatedAt: iso(row.updated_at),
    timeline: json<SosSession['timeline']>(row.timeline, []),
    rescueCenterId: strOrNull(row.rescue_center_id),
    link: str(row.link, 'satellite') as SosSession['link'],
  };
}

/* ------------------------------------------------------------------ */
/* Envanter & konaklama                                                */
/* ------------------------------------------------------------------ */

export function toStayUnit(row: Row): StayUnit {
  return {
    id: str(row.id),
    businessId: str(row.business_id),
    name: str(row.name),
    kind: str(row.kind, 'room') as StayUnit['kind'],
    capacity: num(row.capacity, 1),
    quantity: num(row.quantity, 1),
    basePriceTry: num(row.base_price_try),
    weekendMultiplier: num(row.weekend_multiplier, 1),
    seasons: json<StayUnit['seasons']>(row.seasons, []),
    amenities: strArray(row.amenities),
  };
}

export function toUnitBlock(row: Row): UnitBlock {
  const range = parseDateRange(row.during);
  return {
    id: str(row.id),
    unitId: str(row.unit_id),
    from: range.from,
    to: range.to,
    reason: str(row.reason, 'owner') as UnitBlock['reason'],
    bookingId: strOrNull(row.booking_id),
  };
}

export function toAvailability(unitId: ID, row: Row): Availability {
  return {
    unitId,
    date: dayKey(row.date),
    available: num(row.available),
    priceTry: num(row.price_try),
  };
}

export function toPayment(row: Row): Payment {
  return {
    id: str(row.id),
    bookingId: str(row.booking_id),
    payerId: str(row.payer_id),
    amountTry: num(row.amount_try),
    platformFeeTry: num(row.platform_fee_try),
    status: str(row.status, 'pending') as Payment['status'],
    provider: str(row.provider, 'mock') as Payment['provider'],
    createdAt: iso(row.created_at),
    releasedAt: isoOrNull(row.released_at),
    refundedTry: num(row.refunded_try),
    timeline: json<Payment['timeline']>(row.timeline, []).map((entry) => ({
      status: entry.status,
      at: iso(entry.at),
    })),
  };
}

export function toStayReview(row: Row): StayReview {
  return {
    id: str(row.id),
    businessId: str(row.business_id),
    bookingId: str(row.booking_id),
    authorId: str(row.author_id),
    rating: num(row.rating),
    text: str(row.text),
    verifiedStay: bool(row.verified_stay, true),
    createdAt: iso(row.created_at),
  };
}

export function toHostProfile(row: Row): HostProfile {
  return {
    businessId: str(row.business_id),
    verification: str(row.verification, 'none') as HostProfile['verification'],
    cancellationPolicy: str(
      row.cancellation_policy,
      'moderate',
    ) as HostProfile['cancellationPolicy'],
    responseRatePct: num(row.response_rate_pct),
    responseTimeMin: num(row.response_time_min),
    payoutIban: strOrNull(row.payout_iban),
    pendingPayoutTry: num(row.pending_payout_try),
    paidOutTry: num(row.paid_out_try),
  };
}

/* ------------------------------------------------------------------ */
/* Kulüpler & oyunlaştırma                                             */
/* ------------------------------------------------------------------ */

export function toClub(row: Row): Club {
  return {
    id: str(row.id),
    name: str(row.name),
    university: str(row.university),
    city: str(row.city),
    countryCode: str(row.country_code),
    description: str(row.description),
    logoUrl: strOrNull(row.logo_url),
    coverUrl: strOrNull(row.cover_url),
    adventureTypes: enumArray<Club['adventureTypes'][number]>(row.adventure_types),
    memberCount: num(row.member_count),
    foundedYear: numOrNull(row.founded_year),
    isVerified: bool(row.is_verified),
    seasonXp: num(row.season_xp),
    contactEmail: strOrNull(row.contact_email),
    instagram: strOrNull(row.instagram),
    createdAt: iso(row.created_at),
  };
}

export function toClubEvent(row: Row): ClubEvent {
  return {
    id: str(row.id),
    clubId: str(row.club_id),
    title: str(row.title),
    kind: str(row.kind, 'trip') as ClubEvent['kind'],
    adventureType: str(row.adventure_type, 'hiking') as ClubEvent['adventureType'],
    description: str(row.description),
    locationName: str(row.location_name),
    coords: toGeoPoint(row.coords),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    capacity: numOrNull(row.capacity),
    attendeeCount: num(row.attendee_count),
    openToAll: bool(row.open_to_all),
    priceTry: num(row.price_try),
  };
}

export function toStudentVerification(row: Row): StudentVerification {
  return {
    userId: str(row.user_id),
    email: str(row.email),
    university: str(row.university),
    verifiedAt: isoOrNull(row.verified_at),
  };
}

export function toXpEvent(row: Row): XpEvent {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    source: str(row.source, 'post') as XpEvent['source'],
    amount: num(row.amount),
    note: str(row.note),
    createdAt: iso(row.created_at),
  };
}

export function toBadge(row: Row): Badge {
  return {
    id: str(row.id),
    name: str(row.name),
    description: str(row.description),
    tier: str(row.tier, 'bronze') as Badge['tier'],
    icon: str(row.icon),
    criteria: str(row.criteria),
  };
}

export function toChallenge(row: Row): Challenge {
  return {
    id: str(row.id),
    title: str(row.title),
    description: str(row.description),
    period: str(row.period, 'weekly') as Challenge['period'],
    adventureType: (strOrNull(row.adventure_type) as Challenge['adventureType']) ?? null,
    target: num(row.target),
    unit: str(row.unit, 'count') as Challenge['unit'],
    rewardXp: num(row.reward_xp),
    badgeId: strOrNull(row.badge_id),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
  };
}

export function toChallengeProgress(row: Row): ChallengeProgress {
  return {
    challengeId: str(row.challenge_id),
    userId: str(row.user_id),
    value: num(row.value),
    completedAt: isoOrNull(row.completed_at),
    joinedAt: iso(row.joined_at),
  };
}

export function toQuizQuestion(row: Row): QuizQuestion {
  return {
    id: str(row.id),
    question: str(row.question),
    options: strArray(row.options),
    answerIndex: num(row.answer_index),
    explanation: str(row.explanation),
    adventureType: (strOrNull(row.adventure_type) as QuizQuestion['adventureType']) ?? null,
  };
}

export function toPassportStamp(row: Row): PassportStamp {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    placeName: str(row.place_name),
    countryCode: str(row.country_code),
    adventureType: str(row.adventure_type, 'hiking') as PassportStamp['adventureType'],
    elevationM: numOrNull(row.elevation_m),
    stampedAt: iso(row.stamped_at),
  };
}

/* ------------------------------------------------------------------ */
/* Destinasyonlar, görüş, sosyal, gruplar                              */
/* ------------------------------------------------------------------ */

export function toDestination(row: Row): Destination {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    region: str(row.region),
    countryCode: str(row.country_code),
    type: str(row.type, 'trek') as Destination['type'],
    adventureTypes: enumArray<Destination['adventureTypes'][number]>(row.adventure_types),
    coords: requireGeoPoint(row.coords),
    imageUrl: strOrNull(row.image_url),
    summary: str(row.summary),
    guide: str(row.guide),
    maxElevationM: num(row.max_elevation_m),
    typicalDays: num(row.typical_days),
    totalDistanceKm: num(row.total_distance_km),
    difficulty: str(row.difficulty, 'easy') as Destination['difficulty'],
    bestMonths: numArray(row.best_months),
    transports: json<Destination['transports']>(row.transports, []),
    permits: json<Destination['permits']>(row.permits, []),
    budgetTry: { low: num(row.budget_low_try), high: num(row.budget_high_try) },
    risks: strArray(row.risks),
    gear: strArray(row.gear),
    rescueNote: str(row.rescue_note),
    insuranceRequired: bool(row.insurance_required),
    stageCount: num(row.stage_count),
    rating: num(row.rating),
    reviewCount: num(row.review_count),
    sources: strArray(row.sources),
    updatedAt: iso(row.updated_at),
  };
}

export function toDestinationStage(row: Row): DestinationStage {
  return {
    id: str(row.id),
    destinationId: str(row.destination_id),
    order: num(row.order),
    name: str(row.name),
    kind: str(row.kind, 'camp') as DestinationStage['kind'],
    coords: requireGeoPoint(row.coords),
    elevationM: num(row.elevation_m),
    distanceKm: num(row.distance_km),
    durationMin: num(row.duration_min),
    sleeping: bool(row.sleeping),
    facilities: strArray(row.facilities),
    waterAvailable: bool(row.water_available),
    connectivity: str(row.connectivity, 'none') as DestinationStage['connectivity'],
    note: str(row.note),
    restDayRecommended: bool(row.rest_day_recommended),
  };
}

export function toAmsCheck(row: Row): AmsCheck {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    destinationId: strOrNull(row.destination_id),
    elevationM: num(row.elevation_m),
    headache: num(row.headache) as AmsCheck['headache'],
    gi: num(row.gi) as AmsCheck['gi'],
    fatigue: num(row.fatigue) as AmsCheck['fatigue'],
    dizziness: num(row.dizziness) as AmsCheck['dizziness'],
    score: num(row.score),
    severity: str(row.severity, 'none') as AmsCheck['severity'],
    note: str(row.note),
    createdAt: iso(row.created_at),
  };
}

export function toReturnPlan(row: Row): ReturnPlan {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    title: str(row.title),
    destinationId: strOrNull(row.destination_id),
    adventureType: str(row.adventure_type, 'hiking') as ReturnPlan['adventureType'],
    startAt: iso(row.start_at),
    expectedReturnAt: iso(row.expected_return_at),
    graceMin: num(row.grace_min),
    route: str(row.route),
    companions: str(row.companions),
    contactIds: strArray(row.contact_ids),
    status: str(row.status, 'planned') as ReturnPlan['status'],
    returnedAt: isoOrNull(row.returned_at),
    alertSentAt: isoOrNull(row.alert_sent_at),
    createdAt: iso(row.created_at),
  };
}

export function toVisionHistoryItem(row: Row): VisionHistoryItem {
  return {
    id: str(row.id),
    situation: str(row.situation, 'other') as VisionHistoryItem['situation'],
    observations: strArray(row.observations),
    risk: str(row.risk, 'low') as VisionHistoryItem['risk'],
    advice: strArray(row.advice),
    avoid: strArray(row.avoid),
    actions: json<VisionHistoryItem['actions']>(row.actions, []),
    source: str(row.source, 'local') as VisionHistoryItem['source'],
    confidence: num(row.confidence),
    createdAt: iso(row.created_at),
    thumbnailUri: strOrNull(row.thumbnail_uri),
    question: str(row.question),
  };
}

export function toCollection(row: Row): Collection {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    name: str(row.name),
    coverUrl: strOrNull(row.cover_url),
    count: num(row.count),
    createdAt: iso(row.created_at),
  };
}

export function toGroup(row: Row): Group {
  return {
    id: str(row.id),
    name: str(row.name),
    kind: str(row.kind, 'group') as Group['kind'],
    privacy: str(row.privacy, 'public') as Group['privacy'],
    description: str(row.description),
    avatarUrl: strOrNull(row.avatar_url),
    adventureTypes: enumArray<Group['adventureTypes'][number]>(row.adventure_types),
    city: strOrNull(row.city),
    countryCode: strOrNull(row.country_code),
    ownerId: str(row.owner_id),
    memberCount: num(row.member_count),
    inviteCode: str(row.invite_code),
    pinnedMessageId: strOrNull(row.pinned_message_id),
    clubId: strOrNull(row.club_id),
    createdAt: iso(row.created_at),
    lastMessageAt: isoOrNull(row.last_message_at),
  };
}

/**
 * Bekleyen davetler mock'ta `joinedAt: ''` ile temsil edilir; şemada
 * `joined_at IS NULL` aynı anlama gelir (bkz. `PENDING_INVITE`).
 */
export function toGroupMember(row: Row): GroupMember {
  return {
    groupId: str(row.group_id),
    userId: str(row.user_id),
    role: str(row.role, 'member') as GroupMember['role'],
    joinedAt: row.joined_at == null ? '' : iso(row.joined_at),
    muted: bool(row.muted),
    lastReadAt: isoOrNull(row.last_read_at),
  };
}

export function toGroupMessage(row: Row): GroupMessage {
  return {
    id: str(row.id),
    groupId: str(row.group_id),
    senderId: str(row.sender_id),
    type: str(row.type, 'text') as GroupMessage['type'],
    text: str(row.text),
    imageUrl: strOrNull(row.image_url),
    coords: toGeoPoint(row.coords),
    routeId: strOrNull(row.route_id),
    poll: json<GroupMessage['poll']>(row.poll, null),
    replyToId: strOrNull(row.reply_to_id),
    createdAt: iso(row.created_at),
    editedAt: isoOrNull(row.edited_at),
  };
}

/* ------------------------------------------------------------------ */
/* Kurslar, parçalar                                                   */
/* ------------------------------------------------------------------ */

export function toCourse(row: Row): Course {
  return {
    id: str(row.id),
    slug: str(row.slug),
    title: str(row.title),
    category: str(row.category, 'safety') as Course['category'],
    level: str(row.level, 'beginner') as Course['level'],
    format: str(row.format, 'online') as Course['format'],
    summary: str(row.summary),
    description: str(row.description),
    imageUrl: strOrNull(row.image_url),
    instructorId: strOrNull(row.instructor_id),
    provider: str(row.provider),
    certificateName: strOrNull(row.certificate_name),
    validityMonths: numOrNull(row.validity_months),
    priceTry: num(row.price_try),
    durationHours: num(row.duration_hours),
    lessonCount: num(row.lesson_count),
    rating: num(row.rating),
    reviewCount: num(row.review_count),
    enrolledCount: num(row.enrolled_count),
    languages: strArray(row.languages),
    prerequisites: strArray(row.prerequisites),
    outcomes: strArray(row.outcomes),
    adventureTypes: enumArray<Course['adventureTypes'][number]>(row.adventure_types),
    createdAt: iso(row.created_at),
  };
}

export function toLesson(row: Row): Lesson {
  return {
    id: str(row.id),
    courseId: str(row.course_id),
    moduleTitle: str(row.module_title),
    order: num(row.order),
    title: str(row.title),
    type: str(row.type, 'video') as Lesson['type'],
    durationMin: num(row.duration_min),
    videoUrl: strOrNull(row.video_url),
    body: str(row.body),
    quiz: json<Lesson['quiz']>(row.quiz, null),
    preview: bool(row.preview),
  };
}

export function toCourseSession(row: Row): CourseSession {
  return {
    id: str(row.id),
    courseId: str(row.course_id),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    locationName: str(row.location_name),
    coords: toGeoPoint(row.coords),
    seats: num(row.seats),
    seatsLeft: num(row.seats_left),
    priceTry: num(row.price_try),
  };
}

export function toEnrollment(row: Row): Enrollment {
  return {
    id: str(row.id),
    courseId: str(row.course_id),
    userId: str(row.user_id),
    sessionId: strOrNull(row.session_id),
    status: str(row.status, 'active') as Enrollment['status'],
    completedLessonIds: strArray(row.completed_lesson_ids),
    progress: num(row.progress),
    quizScores: json<Record<ID, number>>(row.quiz_scores, {}),
    enrolledAt: iso(row.enrolled_at),
    completedAt: isoOrNull(row.completed_at),
  };
}

export function toCertificate(row: Row): Certificate {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    courseId: str(row.course_id),
    code: str(row.code),
    issuedAt: iso(row.issued_at),
    expiresAt: isoOrNull(row.expires_at),
    holderName: str(row.holder_name),
  };
}

export function toCourseReview(row: Row): CourseReview {
  return {
    id: str(row.id),
    courseId: str(row.course_id),
    authorId: str(row.author_id),
    rating: num(row.rating),
    text: str(row.text),
    createdAt: iso(row.created_at),
  };
}

export function toTrackPoints(value: unknown): TrackPoint[] {
  const raw = json<unknown[]>(value, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const p = entry as Record<string, unknown>;
    return {
      latitude: num(p.latitude ?? p.lat),
      longitude: num(p.longitude ?? p.lng),
      elevationM: numOrNull(p.elevationM ?? p.elevation_m),
      t: numOrNull(p.t),
    };
  });
}

export function toTrack(row: Row): Track {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    name: str(row.name),
    adventureType: str(row.adventure_type, 'hiking') as Track['adventureType'],
    source: str(row.source, 'recorded') as Track['source'],
    status: str(row.status, 'draft') as Track['status'],
    points: toTrackPoints(row.points),
    distanceKm: num(row.distance_km),
    ascentM: num(row.ascent_m),
    descentM: num(row.descent_m),
    durationMin: num(row.duration_min),
    maxElevationM: numOrNull(row.max_elevation_m),
    startedAt: iso(row.started_at),
    regionName: str(row.region_name),
    countryCode: strOrNull(row.country_code),
    isPublic: bool(row.is_public),
    likesCount: num(row.likes_count),
    communityTrailId: strOrNull(row.community_trail_id),
    createdAt: iso(row.created_at),
  };
}

export function toTrackPoi(row: Row): TrackPoi {
  return {
    id: str(row.id),
    trackId: strOrNull(row.track_id),
    communityTrailId: strOrNull(row.community_trail_id),
    userId: str(row.user_id),
    kind: str(row.kind, 'other') as TrackPoi['kind'],
    coords: requireGeoPoint(row.coords),
    elevationM: numOrNull(row.elevation_m),
    name: str(row.name),
    note: str(row.note),
    photoUrl: strOrNull(row.photo_url),
    source: str(row.source, 'manual') as TrackPoi['source'],
    mediaId: strOrNull(row.media_id),
    confirmations: num(row.confirmations),
    createdAt: iso(row.created_at),
  };
}

export function toCommunityTrail(row: Row): CommunityTrail {
  return {
    id: str(row.id),
    name: str(row.name),
    adventureType: str(row.adventure_type, 'hiking') as CommunityTrail['adventureType'],
    points: toTrackPoints(row.points),
    distanceKm: num(row.distance_km),
    ascentM: num(row.ascent_m),
    descentM: num(row.descent_m),
    trackCount: num(row.track_count),
    verifiedCount: num(row.verified_count),
    popularity: num(row.popularity),
    regionName: str(row.region_name),
    countryCode: strOrNull(row.country_code),
    bbox: (numArray(row.bbox).slice(0, 4) as CommunityTrail['bbox']) ?? [0, 0, 0, 0],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

/* ------------------------------------------------------------------ */
/* Ülke rehberi, makaleler, yaban hayat, tele-tıp                      */
/* ------------------------------------------------------------------ */

export function toCountryGuide(row: Row): CountryGuide {
  const visa = json<Record<string, unknown>>(row.visa, {});
  return {
    countryCode: str(row.country_code),
    name: str(row.name),
    region: str(row.region),
    languages: strArray(row.languages),
    currency: str(row.currency),
    tryRate: numOrNull(row.try_rate),
    timezone: str(row.timezone),
    plugTypes: strArray(row.plug_types),
    visa: {
      type: str(row.visa_type, str(visa.type, 'visa_free')) as CountryGuide['visa']['type'],
      maxStayDays: numOrNull(visa.maxStayDays),
      costTry: numOrNull(visa.costTry),
      processingDays: numOrNull(visa.processingDays),
      url: strOrNull(visa.url),
      note: str(visa.note),
    },
    documents: json<CountryGuide['documents']>(row.documents, []),
    etiquette: strArray(row.etiquette),
    dressCode: str(row.dress_code),
    religionNotes: str(row.religion_notes),
    photographyRules: str(row.photography_rules),
    tipping: str(row.tipping),
    bargaining: str(row.bargaining),
    watchOut: strArray(row.watch_out),
    womenTravelers: str(row.women_travelers),
    laws: strArray(row.laws),
    droneRules: str(row.drone_rules),
    alcoholRules: str(row.alcohol_rules),
    money: str(row.money),
    connectivity: str(row.connectivity),
    health: strArray(row.health),
    vaccines: strArray(row.vaccines),
    bestMonths: numArray(row.best_months),
    dailyTips: strArray(row.daily_tips),
    sources: strArray(row.sources),
    updatedAt: iso(row.updated_at),
  };
}

export function toCountryChecklist(row: Row): CountryChecklist {
  return {
    userId: str(row.user_id),
    countryCode: str(row.country_code),
    done: strArray(row.done),
    tripDate: row.trip_date ? dayKey(row.trip_date) : null,
    updatedAt: iso(row.updated_at),
  };
}

export function toWriterProfile(row: Row): WriterProfile {
  return {
    userId: str(row.user_id),
    penName: str(row.pen_name),
    bio: str(row.bio),
    languages: strArray(row.languages),
    topics: enumArray<WriterProfile['topics'][number]>(row.topics),
    website: strOrNull(row.website),
    isVerified: bool(row.is_verified),
    followerCount: num(row.follower_count),
    articleCount: num(row.article_count),
    appliedAt: iso(row.applied_at),
    approvedAt: isoOrNull(row.approved_at),
  };
}

export function toArticle(row: Row): Article {
  return {
    id: str(row.id),
    authorId: str(row.author_id),
    slug: str(row.slug),
    title: str(row.title),
    subtitle: str(row.subtitle),
    coverUrl: strOrNull(row.cover_url),
    category: str(row.category, 'guide') as Article['category'],
    body: str(row.body),
    tags: strArray(row.tags),
    destinationId: strOrNull(row.destination_id),
    countryCode: strOrNull(row.country_code),
    adventureTypes: enumArray<Article['adventureTypes'][number]>(row.adventure_types),
    readMinutes: num(row.read_minutes),
    status: str(row.status, 'draft') as Article['status'],
    likesCount: num(row.likes_count),
    commentsCount: num(row.comments_count),
    viewsCount: num(row.views_count),
    locale: str(row.locale, 'tr'),
    publishedAt: isoOrNull(row.published_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toArticleComment(row: Row): ArticleComment {
  return {
    id: str(row.id),
    articleId: str(row.article_id),
    authorId: str(row.author_id),
    content: str(row.content),
    createdAt: iso(row.created_at),
  };
}

export function toSpecies(row: Row): Species {
  return {
    id: str(row.id),
    commonName: str(row.common_name),
    scientificName: str(row.scientific_name),
    group: str(row.group, 'mammal') as Species['group'],
    danger: str(row.danger, 'low') as Species['danger'],
    countryCodes: strArray(row.country_codes),
    habitats: strArray(row.habitats),
    description: str(row.description),
    identification: strArray(row.identification),
    encounterDo: strArray(row.encounter_do),
    encounterDont: strArray(row.encounter_dont),
    firstAidSlug: strOrNull(row.first_aid_slug),
    venomNote: strOrNull(row.venom_note),
    imageUrl: strOrNull(row.image_url),
    lookalikes: strArray(row.lookalikes),
    activeMonths: numArray(row.active_months),
    activeHours: str(row.active_hours, 'both') as Species['activeHours'],
    sources: strArray(row.sources),
  };
}

export function toSpeciesIdentification(row: Row): SpeciesIdentification {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    imageUri: strOrNull(row.image_uri),
    candidates: json<SpeciesIdentification['candidates']>(row.candidates, []),
    advice: strArray(row.advice),
    source: str(row.source, 'local') as SpeciesIdentification['source'],
    coords: toGeoPoint(row.coords),
    createdAt: iso(row.created_at),
  };
}

export function toWildlifeQuestion(row: Row): WildlifeQuestion {
  return {
    id: str(row.id),
    authorId: str(row.author_id),
    title: str(row.title),
    body: str(row.body),
    imageUrl: strOrNull(row.image_url),
    coords: toGeoPoint(row.coords),
    locationName: str(row.location_name),
    speciesGuessId: strOrNull(row.species_guess_id),
    status: str(row.status, 'open') as WildlifeQuestion['status'],
    urgent: bool(row.urgent),
    answersCount: num(row.answers_count),
    acceptedAnswerId: strOrNull(row.accepted_answer_id),
    createdAt: iso(row.created_at),
  };
}

export function toWildlifeAnswer(row: Row): WildlifeAnswer {
  return {
    id: str(row.id),
    questionId: str(row.question_id),
    authorId: str(row.author_id),
    body: str(row.body),
    speciesId: strOrNull(row.species_id),
    upvotes: num(row.upvotes),
    isExpert: bool(row.is_expert),
    createdAt: iso(row.created_at),
  };
}

export function toDeterrentProfile(row: Row): DeterrentProfile {
  return {
    animal: str(row.animal, 'bear') as DeterrentProfile['animal'],
    sounds: json<DeterrentProfile['sounds']>(row.sounds, []),
    behaviorDo: strArray(row.behavior_do),
    behaviorDont: strArray(row.behavior_dont),
    warnings: strArray(row.warnings),
    evidence: str(row.evidence),
  };
}

export function toDeterrentEvent(row: Row): DeterrentEvent {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    animal: str(row.animal, 'bear') as DeterrentEvent['animal'],
    sound: str(row.sound, 'whistle') as DeterrentEvent['sound'],
    coords: toGeoPoint(row.coords),
    durationS: num(row.duration_s),
    createdAt: iso(row.created_at),
  };
}

export function toDoctor(row: Row): Doctor {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    title: str(row.title),
    specialties: enumArray<Doctor['specialties'][number]>(row.specialties),
    languages: strArray(row.languages),
    licenseNo: str(row.license_no),
    institution: str(row.institution),
    isVerified: bool(row.is_verified),
    isOnline: bool(row.is_online),
    responseMin: num(row.response_min),
    rating: num(row.rating),
    consultCount: num(row.consult_count),
    volunteer: bool(row.volunteer),
    priceTryPerConsult: num(row.price_try_per_consult),
    countryCodes: strArray(row.country_codes),
    bio: str(row.bio),
  };
}

export function toConsultation(row: Row): Consultation {
  return {
    id: str(row.id),
    patientId: str(row.patient_id),
    doctorId: strOrNull(row.doctor_id),
    urgency: str(row.urgency, 'routine') as Consultation['urgency'],
    complaint: str(row.complaint),
    triage: strArray(row.triage),
    firstAidSlug: strOrNull(row.first_aid_slug),
    speciesId: strOrNull(row.species_id),
    coords: toGeoPoint(row.coords),
    status: str(row.status, 'waiting') as Consultation['status'],
    channel: str(row.channel, 'chat') as Consultation['channel'],
    createdAt: iso(row.created_at),
    acceptedAt: isoOrNull(row.accepted_at),
    endedAt: isoOrNull(row.ended_at),
    summary: strOrNull(row.summary),
  };
}

export function toConsultMessage(row: Row): ConsultMessage {
  return {
    id: str(row.id),
    consultationId: str(row.consultation_id),
    senderId: str(row.sender_id),
    content: str(row.content),
    imageUrl: strOrNull(row.image_url),
    isInstruction: bool(row.is_instruction),
    createdAt: iso(row.created_at),
  };
}

/* ------------------------------------------------------------------ */
/* TV, tarihi alanlar, çocuk modülü                                    */
/* ------------------------------------------------------------------ */

export function toTvChannel(row: Row): TvChannel {
  return {
    id: str(row.id),
    name: str(row.name),
    kind: str(row.kind, 'community') as TvChannel['kind'],
    description: str(row.description),
    logoUrl: strOrNull(row.logo_url),
    color: str(row.color, '#2f6f4e'),
    followerCount: num(row.follower_count),
    ownerId: strOrNull(row.owner_id),
    isOfficial: bool(row.is_official),
  };
}

export function toTvProgram(row: Row): TvProgram {
  return {
    id: str(row.id),
    channelId: str(row.channel_id),
    title: str(row.title),
    kind: str(row.kind, 'documentary') as TvProgram['kind'],
    description: str(row.description),
    thumbnailUrl: strOrNull(row.thumbnail_url),
    videoUrl: str(row.video_url),
    durationMin: num(row.duration_min),
    adventureTypes: enumArray<TvProgram['adventureTypes'][number]>(row.adventure_types),
    destinationId: strOrNull(row.destination_id),
    countryCode: strOrNull(row.country_code),
    seriesTitle: strOrNull(row.series_title),
    episode: numOrNull(row.episode),
    publishedAt: iso(row.published_at),
    viewsCount: num(row.views_count),
    likesCount: num(row.likes_count),
    languages: strArray(row.languages),
    subtitles: strArray(row.subtitles),
    kidsFriendly: bool(row.kids_friendly),
    creditsNote: str(row.credits_note),
  };
}

export function toTvSchedule(row: Row): TvSchedule {
  return {
    id: str(row.id),
    channelId: str(row.channel_id),
    programId: strOrNull(row.program_id),
    streamId: strOrNull(row.stream_id),
    title: str(row.title),
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
  };
}

export function toNewsItem(row: Row): NewsItem {
  return {
    id: str(row.id),
    category: str(row.category, 'general') as NewsItem['category'],
    title: str(row.title),
    summary: str(row.summary),
    body: str(row.body),
    region: str(row.region),
    countryCode: strOrNull(row.country_code),
    coords: toGeoPoint(row.coords),
    sourceName: str(row.source_name),
    sourceUrl: strOrNull(row.source_url),
    severity: str(row.severity, 'info') as NewsItem['severity'],
    publishedAt: iso(row.published_at),
    expiresAt: isoOrNull(row.expires_at),
  };
}

export function toHeritageSite(row: Row): HeritageSite {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    kind: str(row.kind, 'ruins') as HeritageSite['kind'],
    eras: enumArray<HeritageSite['eras'][number]>(row.eras),
    countryCode: str(row.country_code),
    region: str(row.region),
    coords: requireGeoPoint(row.coords),
    elevationM: numOrNull(row.elevation_m),
    imageUrl: strOrNull(row.image_url),
    summary: str(row.summary),
    history: str(row.history),
    isUnesco: bool(row.is_unesco),
    unescoYear: numOrNull(row.unesco_year),
    openingHours: str(row.opening_hours),
    entryFeeTry: numOrNull(row.entry_fee_try),
    museumPassValid: bool(row.museum_pass_valid),
    visitDurationMin: num(row.visit_duration_min),
    accessibility: str(row.accessibility, 'moderate') as HeritageSite['accessibility'],
    nearestTrailhead: strOrNull(row.nearest_trailhead),
    linkedTrailId: strOrNull(row.linked_trail_id),
    linkedDestinationId: strOrNull(row.linked_destination_id),
    adventureTypes: enumArray<HeritageSite['adventureTypes'][number]>(row.adventure_types),
    rules: strArray(row.rules),
    bestMonths: numArray(row.best_months),
    rating: num(row.rating),
    reviewCount: num(row.review_count),
    sources: strArray(row.sources),
    updatedAt: iso(row.updated_at),
  };
}

export function toAudioGuideStop(row: Row): AudioGuideStop {
  return {
    id: str(row.id),
    siteId: str(row.site_id),
    order: num(row.order),
    title: str(row.title),
    coords: toGeoPoint(row.coords),
    durationSec: num(row.duration_sec),
    script: str(row.script),
    imageUrl: strOrNull(row.image_url),
  };
}

export function toHeritageTour(row: Row): HeritageTour {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    title: str(row.title),
    siteIds: strArray(row.site_ids),
    date: row.date ? dayKey(row.date) : null,
    notes: str(row.notes),
    createdAt: iso(row.created_at),
  };
}

export function toKidPlace(row: Row): KidPlace {
  return {
    id: str(row.id),
    name: str(row.name),
    kind: str(row.kind, 'park') as KidPlace['kind'],
    ageBands: enumArray<KidPlace['ageBands'][number]>(row.age_bands),
    coords: requireGeoPoint(row.coords),
    locationName: str(row.location_name),
    countryCode: strOrNull(row.country_code),
    description: str(row.description),
    imageUrl: strOrNull(row.image_url),
    facilities: strArray(row.facilities),
    strollerFriendly: bool(row.stroller_friendly),
    shade: bool(row.shade),
    toilets: bool(row.toilets),
    water: bool(row.water),
    safetyNotes: strArray(row.safety_notes),
    trailKm: numOrNull(row.trail_km),
    trailMin: numOrNull(row.trail_min),
    entryFeeTry: numOrNull(row.entry_fee_try),
    rating: num(row.rating),
    reviewCount: num(row.review_count),
    seasonMonths: numArray(row.season_months),
    linkedBusinessId: strOrNull(row.linked_business_id),
    linkedLibraryPlaceId: strOrNull(row.linked_library_place_id),
  };
}

export function toChildProfile(row: Row): ChildProfile {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    name: str(row.name),
    ageBand: str(row.age_band, 'kid') as ChildProfile['ageBand'],
    avatar: str(row.avatar),
    createdAt: iso(row.created_at),
  };
}

export function toHuntTask(row: Row): HuntTask {
  return {
    id: str(row.id),
    text: str(row.text),
    icon: str(row.icon),
    category: str(row.category, 'plant') as HuntTask['category'],
    ageBands: enumArray<HuntTask['ageBands'][number]>(row.age_bands),
    points: num(row.points),
  };
}

export function toHuntProgress(row: Row): HuntProgress {
  return {
    userId: str(row.user_id),
    childName: str(row.child_name),
    completedTaskIds: strArray(row.completed_task_ids),
    stickers: strArray(row.stickers),
    points: num(row.points),
    updatedAt: iso(row.updated_at),
  };
}

export function toFamilyChecklistItem(row: Row): FamilyChecklistItem {
  return {
    key: str(row.key),
    label: str(row.label),
    ageBands: enumArray<FamilyChecklistItem['ageBands'][number]>(row.age_bands),
    category: str(row.category, 'safety') as FamilyChecklistItem['category'],
  };
}

export function toAvalancheBulletin(row: Row): AvalancheBulletin {
  return {
    regionCode: str(row.region_code),
    regionName: str(row.region_name),
    validFrom: iso(row.valid_from),
    validTo: iso(row.valid_to),
    dangerLevel: num(row.danger_level, 1) as AvalancheBulletin['dangerLevel'],
    dangerAbove: json<AvalancheBulletin['dangerAbove']>(row.danger_above, null),
    problems: strArray(row.problems),
    summary: str(row.summary),
    source: str(row.source, 'eaws') as AvalancheBulletin['source'],
    url: strOrNull(row.url),
  };
}
