import type {
  AdventureType,
  BusinessFilter,
  ClimbingFilter,
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
  },
  climbing: {
    all: ['climbing'] as const,
    crags: (filter: ClimbingFilter) =>
      ['climbing', 'crags', { ...filter, origin: filter.origin ? 'o' : null }] as const,
    crag: (id: ID) => ['climbing', 'crag', id] as const,
    sectors: (cragId: ID) => ['climbing', 'sectors', cragId] as const,
    routes: (cragId: ID, sectorId: ID | null) => ['climbing', 'routes', cragId, sectorId] as const,
    route: (id: ID) => ['climbing', 'route', id] as const,
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
};
