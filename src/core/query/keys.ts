import type { AdventureType, GeoPoint, ID } from '@/domain';

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
};
