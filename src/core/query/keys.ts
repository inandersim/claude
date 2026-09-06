import type {
  AdventureType,
  BusinessFilter,
  ClimbingFilter,
  CourseFilter,
  DestinationFilter,
  GroupFilter,
  SocialFilter,
  TrackFilter,
  TvFilter,
  HeritageFilter,
  KidPlaceFilter,
  KidAgeBand,
  ArticleFilter,
  SpeciesFilter,
  ClubFilter,
  ISODate,
  LeaderboardScope,
  RouteProfile,
  GeoPoint,
  ID,
  InstructorFilter,
  LibraryFilter,
  ListingFilter,
} from '@/domain';

/** TanStack Query anahtarları — tek kaynaktan yönetilir, invalidation tutarlı olur. */
export const queryKeys = {
  feed: {
    all: ['feed'] as const,
    list: (viewerId: ID, type: AdventureType | null) => ['feed', 'list', viewerId, type] as const,
    byAuthor: (viewerId: ID, authorId: ID) => ['feed', 'author', viewerId, authorId] as const,
    byLocation: (viewerId: ID, locationName: string) =>
      ['feed', 'location', viewerId, locationName] as const,
    detail: (viewerId: ID, postId: ID) => ['feed', 'detail', viewerId, postId] as const,
    comments: (postId: ID) => ['feed', 'comments', postId] as const,
    route: (routeId: ID) => ['feed', 'route', routeId] as const,
  },
  users: {
    detail: (id: ID) => ['users', id] as const,
    following: (meId: ID, otherId: ID) => ['users', 'following', meId, otherId] as const,
  },
  explore: {
    trending: ['explore', 'trending'] as const,
    location: (id: ID) => ['explore', 'location', id] as const,
    routes: ['explore', 'routes'] as const,
    search: (q: string) => ['explore', 'search', q] as const,
  },
  matches: {
    all: ['matches'] as const,
    candidates: (meId: ID, origin: GeoPoint, radius: number, type: AdventureType | null) =>
      [
        'matches',
        'candidates',
        meId,
        origin.latitude.toFixed(3),
        origin.longitude.toFixed(3),
        radius,
        type,
      ] as const,
    mine: (meId: ID) => ['matches', 'mine', meId] as const,
    detail: (id: ID) => ['matches', 'detail', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (meId: ID) => ['notifications', 'list', meId] as const,
    unread: (meId: ID) => ['notifications', 'unread', meId] as const,
  },
  messages: {
    thread: (meId: ID, otherId: ID) => ['messages', 'thread', meId, otherId] as const,
  },
  hazards: {
    all: ['hazards'] as const,
    list: (meId: ID, origin: GeoPoint | null, radiusKm: number | null, includeResolved: boolean) =>
      [
        'hazards',
        'list',
        meId,
        origin ? `${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}` : '-',
        radiusKm,
        includeResolved,
      ] as const,
    detail: (meId: ID, id: ID) => ['hazards', 'detail', meId, id] as const,
  },
  live: {
    all: ['live'] as const,
    list: ['live', 'list'] as const,
    detail: (id: ID) => ['live', 'detail', id] as const,
    messages: (id: ID) => ['live', 'messages', id] as const,
  },
  market: {
    all: ['market'] as const,
    list: (viewerId: ID, filter: ListingFilter) => ['market', 'list', viewerId, filter] as const,
    detail: (viewerId: ID, id: ID) => ['market', 'detail', viewerId, id] as const,
  },
  instructors: {
    all: ['instructors'] as const,
    list: (origin: GeoPoint | null, filter: InstructorFilter) =>
      [
        'instructors',
        'list',
        origin ? `${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)}` : '-',
        filter,
      ] as const,
    detail: (id: ID) => ['instructors', 'detail', id] as const,
    byUser: (userId: ID) => ['instructors', 'byUser', userId] as const,
    reviews: (id: ID) => ['instructors', 'reviews', id] as const,
    bookings: (meId: ID) => ['instructors', 'bookings', meId] as const,
  },
  library: {
    all: ['library'] as const,
    search: (filter: LibraryFilter) =>
      [
        'library',
        'search',
        {
          ...filter,
          origin: filter.origin
            ? `${filter.origin.latitude.toFixed(2)},${filter.origin.longitude.toFixed(2)}`
            : null,
        },
      ] as const,
    detail: (id: ID) => ['library', 'detail', id] as const,
    countries: ['library', 'countries'] as const,
  },
  presence: {
    all: ['presence'] as const,
    list: (meId: ID) => ['presence', 'list', meId] as const,
    mine: (meId: ID) => ['presence', 'mine', meId] as const,
  },
  stories: {
    all: ['stories'] as const,
    groups: (meId: ID) => ['stories', 'groups', meId] as const,
  },
  businesses: {
    all: ['businesses'] as const,
    list: (filter: BusinessFilter) =>
      ['businesses', 'list', { ...filter, origin: filter.origin ? 'o' : null }] as const,
    detail: (id: ID) => ['businesses', 'detail', id] as const,
    stays: (meId: ID) => ['businesses', 'stays', meId] as const,
  },
  billing: {
    earnings: (meId: ID) => ['billing', 'earnings', meId] as const,
  },
  emergency: {
    centers: (origin: GeoPoint) =>
      ['emergency', 'centers', origin.latitude.toFixed(2), origin.longitude.toFixed(2)] as const,
    sos: (meId: ID) => ['emergency', 'sos', meId] as const,
  },
  /* v1.2 */
  ai: {
    all: ['ai'] as const,
    threads: (meId: ID) => ['ai', 'threads', meId] as const,
    thread: (meId: ID, threadId: ID | null) => ['ai', 'thread', meId, threadId] as const,
  },
  maps: {
    all: ['maps'] as const,
    packs: ['maps', 'packs'] as const,
    regions: ['maps', 'regions'] as const,
    graph: (regionId: ID) => ['maps', 'graph', regionId] as const,
    plan: (regionId: ID, from: ID | null, to: ID | null, profile: RouteProfile) =>
      ['maps', 'plan', regionId, from, to, profile] as const,
    saved: (meId: ID) => ['maps', 'saved', meId] as const,
    /** Karo sunucusundaki (EXPO_PUBLIC_TILES_URL) hazır paketler */
    tileServer: ['maps', 'tile-server'] as const,
  },
  climbing: {
    all: ['climbing'] as const,
    crags: (filter: ClimbingFilter) =>
      ['climbing', 'crags', { ...filter, origin: filter.origin ? 'o' : null }] as const,
    crag: (id: ID) => ['climbing', 'crag', id] as const,
    sectors: (cragId: ID) => ['climbing', 'sectors', cragId] as const,
    routes: (cragId: ID, sectorId: ID | null) => ['climbing', 'routes', cragId, sectorId] as const,
    route: (id: ID, meId?: ID) => ['climbing', 'route', id, meId ?? null] as const,
    ascents: (routeId: ID) => ['climbing', 'ascents', routeId] as const,
    myAscents: (meId: ID) => ['climbing', 'myAscents', meId] as const,
  },
  satellite: {
    all: ['satellite'] as const,
    devices: (meId: ID) => ['satellite', 'devices', meId] as const,
    link: (meId: ID) => ['satellite', 'link', meId] as const,
    messages: (meId: ID) => ['satellite', 'messages', meId] as const,
    sos: (meId: ID) => ['satellite', 'sos', meId] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    units: (businessId: ID) => ['inventory', 'units', businessId] as const,
    availability: (unitId: ID, from: ISODate, to: ISODate) =>
      ['inventory', 'availability', unitId, from, to] as const,
    quote: (unitId: ID, checkIn: ISODate, checkOut: ISODate, guests: number) =>
      ['inventory', 'quote', unitId, checkIn, checkOut, guests] as const,
    bookings: (meId: ID) => ['inventory', 'bookings', meId] as const,
    booking: (meId: ID, id: ID) => ['inventory', 'booking', meId, id] as const,
    reviews: (businessId: ID) => ['inventory', 'reviews', businessId] as const,
    host: (meId: ID, businessId: ID) => ['inventory', 'host', meId, businessId] as const,
    hostBookings: (meId: ID, businessId: ID) =>
      ['inventory', 'hostBookings', meId, businessId] as const,
  },
  clubs: {
    all: ['clubs'] as const,
    list: (meId: ID, filter: ClubFilter) => ['clubs', 'list', meId, filter] as const,
    detail: (meId: ID, id: ID) => ['clubs', 'detail', meId, id] as const,
    members: (clubId: ID) => ['clubs', 'members', clubId] as const,
    events: (meId: ID, clubId: ID | null) => ['clubs', 'events', meId, clubId] as const,
    event: (meId: ID, id: ID) => ['clubs', 'event', meId, id] as const,
    ranking: ['clubs', 'ranking'] as const,
    student: (meId: ID) => ['clubs', 'student', meId] as const,
    mine: (meId: ID) => ['clubs', 'mine', meId] as const,
  },
  fun: {
    all: ['fun'] as const,
    summary: (meId: ID) => ['fun', 'summary', meId] as const,
    badges: (meId: ID) => ['fun', 'badges', meId] as const,
    challenges: (meId: ID) => ['fun', 'challenges', meId] as const,
    leaderboard: (meId: ID, scope: LeaderboardScope) =>
      ['fun', 'leaderboard', meId, scope] as const,
    quiz: (meId: ID) => ['fun', 'quiz', meId] as const,
    stamps: (meId: ID) => ['fun', 'stamps', meId] as const,
    xp: (meId: ID) => ['fun', 'xp', meId] as const,
  },
  /* v1.3 */
  destinations: {
    all: ['destinations'] as const,
    list: (meId: ID, filter: DestinationFilter) =>
      ['destinations', 'list', meId, { ...filter, origin: filter.origin ? 'o' : null }] as const,
    detail: (meId: ID, id: ID) => ['destinations', 'detail', meId, id] as const,
    stages: (id: ID) => ['destinations', 'stages', id] as const,
    saved: (meId: ID) => ['destinations', 'saved', meId] as const,
    ams: (meId: ID) => ['destinations', 'ams', meId] as const,
    plans: (meId: ID) => ['destinations', 'plans', meId] as const,
  },
  vision: {
    all: ['vision'] as const,
    history: (meId: ID) => ['vision', 'history', meId] as const,
  },
  social: {
    all: ['social'] as const,
    feed: (meId: ID, filter: SocialFilter) => ['social', 'feed', meId, filter] as const,
    collections: (meId: ID) => ['social', 'collections', meId] as const,
    saved: (meId: ID, collectionId: ID | null) => ['social', 'saved', meId, collectionId] as const,
    hashtags: ['social', 'hashtags'] as const,
    byHashtag: (meId: ID, tag: string) => ['social', 'tag', meId, tag] as const,
    users: (query: string) => ['social', 'users', query] as const,
  },
  groups: {
    all: ['groups'] as const,
    list: (meId: ID, filter: GroupFilter) => ['groups', 'list', meId, filter] as const,
    detail: (meId: ID, id: ID) => ['groups', 'detail', meId, id] as const,
    members: (id: ID) => ['groups', 'members', id] as const,
    messages: (meId: ID, id: ID) => ['groups', 'messages', meId, id] as const,
  },
  courses: {
    all: ['courses'] as const,
    list: (meId: ID, filter: CourseFilter) => ['courses', 'list', meId, filter] as const,
    detail: (meId: ID, id: ID) => ['courses', 'detail', meId, id] as const,
    lessons: (id: ID) => ['courses', 'lessons', id] as const,
    lesson: (id: ID) => ['courses', 'lesson', id] as const,
    sessions: (id: ID) => ['courses', 'sessions', id] as const,
    mine: (meId: ID) => ['courses', 'mine', meId] as const,
    certificates: (meId: ID) => ['courses', 'certificates', meId] as const,
    reviews: (id: ID) => ['courses', 'reviews', id] as const,
  },
  /* v1.4 */
  tracks: {
    all: ['tracks'] as const,
    list: (meId: ID, filter: TrackFilter) =>
      ['tracks', 'list', meId, { ...filter, origin: filter.origin ? 'o' : null }] as const,
    detail: (meId: ID, id: ID) => ['tracks', 'detail', meId, id] as const,
    community: (meId: ID, origin: GeoPoint | null) =>
      [
        'tracks',
        'community',
        meId,
        origin ? `${origin.latitude.toFixed(1)},${origin.longitude.toFixed(1)}` : null,
      ] as const,
    communityDetail: (meId: ID, id: ID) => ['tracks', 'communityDetail', meId, id] as const,
    pois: (origin: GeoPoint, radiusKm: number) =>
      [
        'tracks',
        'pois',
        origin.latitude.toFixed(2),
        origin.longitude.toFixed(2),
        radiusKm,
      ] as const,
    suggested: (meId: ID) => ['tracks', 'suggested', meId] as const,
    navigation: (id: ID, kind: string) => ['tracks', 'navigation', id, kind] as const,
  },
  weather: {
    forecast: (coords: GeoPoint) =>
      ['weather', 'forecast', coords.latitude.toFixed(2), coords.longitude.toFixed(2)] as const,
    avalanche: (coords: GeoPoint) =>
      ['weather', 'avalanche', coords.latitude.toFixed(1), coords.longitude.toFixed(1)] as const,
  },
  /* v1.5 */
  countries: {
    all: ['countries'] as const,
    list: (query: string | null) => ['countries', 'list', query] as const,
    detail: (code: string) => ['countries', 'detail', code] as const,
    checklist: (meId: ID, code: string) => ['countries', 'checklist', meId, code] as const,
  },
  articles: {
    all: ['articles'] as const,
    list: (meId: ID, filter: ArticleFilter) => ['articles', 'list', meId, filter] as const,
    detail: (meId: ID, slug: string) => ['articles', 'detail', meId, slug] as const,
    writers: (meId: ID, query: string | null) => ['articles', 'writers', meId, query] as const,
    writer: (meId: ID, userId: ID) => ['articles', 'writer', meId, userId] as const,
    me: (meId: ID) => ['articles', 'me', meId] as const,
    comments: (id: ID) => ['articles', 'comments', id] as const,
    saved: (meId: ID) => ['articles', 'saved', meId] as const,
    mine: (meId: ID) => ['articles', 'mine', meId] as const,
  },
  wildlife: {
    all: ['wildlife'] as const,
    species: (filter: SpeciesFilter) => ['wildlife', 'species', filter] as const,
    speciesDetail: (id: ID) => ['wildlife', 'speciesDetail', id] as const,
    identifications: (meId: ID) => ['wildlife', 'identifications', meId] as const,
    questions: (meId: ID, filter: unknown) => ['wildlife', 'questions', meId, filter] as const,
    question: (meId: ID, id: ID) => ['wildlife', 'question', meId, id] as const,
    deterrents: ['wildlife', 'deterrents'] as const,
    online: ['wildlife', 'online'] as const,
  },
  telemed: {
    all: ['telemed'] as const,
    doctors: (specialty: string | null, onlineOnly: boolean) =>
      ['telemed', 'doctors', specialty, onlineOnly] as const,
    doctor: (id: ID) => ['telemed', 'doctor', id] as const,
    consultation: (meId: ID, id: ID) => ['telemed', 'consultation', meId, id] as const,
    mine: (meId: ID) => ['telemed', 'mine', meId] as const,
  },
  /* v1.6 */
  tv: {
    all: ['tv'] as const,
    channels: ['tv', 'channels'] as const,
    programs: (meId: ID, filter: TvFilter) => ['tv', 'programs', meId, filter] as const,
    program: (meId: ID, id: ID) => ['tv', 'program', meId, id] as const,
    schedule: (day: string) => ['tv', 'schedule', day] as const,
    news: (category: string | null, countryCode: string | null) =>
      ['tv', 'news', category, countryCode] as const,
    continueWatching: (meId: ID) => ['tv', 'continue', meId] as const,
  },
  heritage: {
    all: ['heritage'] as const,
    list: (meId: ID, filter: HeritageFilter) =>
      ['heritage', 'list', meId, { ...filter, origin: filter.origin ? 'o' : null }] as const,
    detail: (meId: ID, id: ID) => ['heritage', 'detail', meId, id] as const,
    audio: (id: ID) => ['heritage', 'audio', id] as const,
    tours: (meId: ID) => ['heritage', 'tours', meId] as const,
  },
  kids: {
    all: ['kids'] as const,
    places: (meId: ID, filter: KidPlaceFilter) =>
      ['kids', 'places', meId, { ...filter, origin: filter.origin ? 'o' : null }] as const,
    place: (meId: ID, id: ID) => ['kids', 'place', meId, id] as const,
    children: (meId: ID) => ['kids', 'children', meId] as const,
    tasks: (ageBand: KidAgeBand | null) => ['kids', 'tasks', ageBand] as const,
    hunt: (meId: ID, child: string) => ['kids', 'hunt', meId, child] as const,
    checklist: (ageBand: KidAgeBand | null) => ['kids', 'checklist', ageBand] as const,
  },
};
