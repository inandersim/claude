import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import {
  applyReactionChange,
  type CreateStatusPostInput,
  type FeedPost,
  type ID,
  type ReactionType,
  type SocialFilter,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

type CachedPosts = FeedPost[] | FeedPost | null | undefined;

/** Hem sosyal hem eski akış önbelleklerindeki gönderiyi yamalar (iyimser güncelleme). */
function usePatchPostCaches() {
  const qc = useQueryClient();
  return async (patch: (post: FeedPost) => FeedPost) => {
    const keys = [queryKeys.social.all, queryKeys.feed.all];
    await Promise.all(keys.map((queryKey) => qc.cancelQueries({ queryKey })));
    const previous = keys.flatMap((queryKey) => qc.getQueriesData<CachedPosts>({ queryKey }));
    for (const queryKey of keys) {
      qc.setQueriesData<CachedPosts>({ queryKey }, (data) => {
        if (!data) return data;
        if (Array.isArray(data)) return data.map(patch);
        if ('id' in data) return patch(data);
        return data;
      });
    }
    return previous;
  };
}

export function useSocialFeed(filter: SocialFilter) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.social.feed(me.id, filter),
    queryFn: () => getDataProvider().social.feed(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

/**
 * Sonsuz kaydırmalı akış.
 *
 * "Daha var mı" kararı repository'den (`nextCursor`) geliyor, dönen dizinin
 * uzunluğundan değil: domain süzgeci sayfayı kısaltabildiği için uzunluğa
 * bakmak kaydırmayı erken durdurur ve eski gönderiler hiç görünmez.
 */
export function useSocialFeedPages(filter: SocialFilter) {
  const me = useCurrentUser();
  return useInfiniteQuery({
    queryKey: queryKeys.social.feed(me.id, filter),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      getDataProvider().social.feedPage(me.id, { ...filter, before: pageParam }),
    getNextPageParam: (sonSayfa) => sonSayfa.nextCursor ?? undefined,
    placeholderData: (prev) => prev,
  });
}

export function useCreateStatus() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStatusPostInput) =>
      getDataProvider().social.createStatus(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.social.all });
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/** Tepki ver/değiştir/kaldır — myReaction ve reactionCounts iyimser güncellenir. */
export function useReact() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const patchCaches = usePatchPostCaches();

  return useMutation({
    mutationFn: ({ postId, type }: { postId: ID; type: ReactionType | null }) =>
      getDataProvider().social.react(me.id, postId, type),
    onMutate: async ({ postId, type }) => {
      const previous = await patchCaches((post) =>
        post.id === postId ? applyReactionChange(post, type) : post,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.social.all });
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}

/** Kaydet / kaydı kaldır — iyimser. */
export function useToggleSave() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const patchCaches = usePatchPostCaches();

  return useMutation({
    mutationFn: ({ postId, collectionId }: { postId: ID; collectionId?: ID | null }) =>
      getDataProvider().social.toggleSave(me.id, postId, collectionId ?? null),
    onMutate: async ({ postId }) => {
      const previous = await patchCaches((post) =>
        post.id === postId
          ? {
              ...post,
              savedByMe: !post.savedByMe,
              savesCount: Math.max(0, (post.savesCount ?? 0) + (post.savedByMe ? -1 : 1)),
            }
          : post,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.social.all });
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}

export function useRepost() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, caption }: { postId: ID; caption: string }) =>
      getDataProvider().social.repost(me.id, postId, caption),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.social.all });
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useCollections() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.social.collections(me.id),
    queryFn: () => getDataProvider().social.collections(me.id),
  });
}

export function useCreateCollection() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => getDataProvider().social.createCollection(me.id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.social.collections(me.id) }),
  });
}

export function useSavedPosts(collectionId: ID | null = null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.social.saved(me.id, collectionId),
    queryFn: () => getDataProvider().social.savedPosts(me.id, collectionId),
    placeholderData: (prev) => prev,
  });
}

export function useTrendingHashtags(limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.social.hashtags, limit] as const,
    queryFn: () => getDataProvider().social.hashtags(limit),
  });
}

export function usePostsByHashtag(tag: string) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.social.byHashtag(me.id, tag),
    queryFn: () => getDataProvider().social.byHashtag(me.id, tag),
    enabled: tag.length > 0,
  });
}

/** Küçük gecikmeli (debounce) değer. */
export function useDebounced<T>(value: T, delayMs = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** Mention önerisi için kullanıcı arama (gecikmeli). */
export function useUserSearch(query: string, enabled = true) {
  const debounced = useDebounced(query);
  return useQuery({
    queryKey: queryKeys.social.users(debounced),
    queryFn: () => getDataProvider().social.searchUsers(debounced),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useDeletePost() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: ID) => getDataProvider().social.deletePost(me.id, postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.social.all });
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(me.id) });
    },
  });
}
