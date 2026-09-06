import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { AdventureType, CreatePostInput, FeedPost, ID } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useFeed(type: AdventureType | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.feed.list(me.id, type),
    queryFn: () => getDataProvider().feed.list(me.id, { adventureType: type }),
  });
}

export function useUserPosts(authorId: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.feed.byAuthor(me.id, authorId),
    queryFn: () => getDataProvider().feed.list(me.id, { authorId }),
  });
}

export function usePostsByLocation(locationName: string) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.feed.byLocation(me.id, locationName),
    queryFn: () => getDataProvider().feed.list(me.id, { locationName }),
  });
}

/** Gönderi detayı; sosyal alanlar (tepki, kayıt, repost) sosyal akıştan zenginleştirilir. */
export function usePost(postId: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.feed.detail(me.id, postId),
    queryFn: async () => {
      const provider = getDataProvider();
      const post = await provider.feed.getById(me.id, postId);
      if (!post) return null;
      const social = await provider.social.feed(me.id, { tab: 'all' });
      return social.find((p) => p.id === postId) ?? post;
    },
  });
}

export function useComments(postId: ID) {
  return useQuery({
    queryKey: queryKeys.feed.comments(postId),
    queryFn: () => getDataProvider().feed.listComments(postId),
  });
}

export function useRoute(routeId: ID | null) {
  return useQuery({
    queryKey: queryKeys.feed.route(routeId ?? '-'),
    queryFn: () => (routeId ? getDataProvider().feed.getRoute(routeId) : null),
    enabled: Boolean(routeId),
  });
}

/** Beğeni — iyimser güncelleme ile tüm feed önbelleklerini günceller. */
export function useToggleLike() {
  const me = useCurrentUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (postId: ID) => getDataProvider().feed.toggleLike(me.id, postId),
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: queryKeys.feed.all });
      const patch = (post: FeedPost): FeedPost =>
        post.id === postId
          ? {
              ...post,
              likedByMe: !post.likedByMe,
              likesCount: post.likedByMe ? post.likesCount - 1 : post.likesCount + 1,
            }
          : post;

      const previous = qc.getQueriesData<FeedPost[] | FeedPost | null>({
        queryKey: queryKeys.feed.all,
      });
      qc.setQueriesData<FeedPost[] | FeedPost | null>({ queryKey: queryKeys.feed.all }, (data) => {
        if (!data) return data;
        if (Array.isArray(data)) return data.map(patch);
        if ('id' in data) return patch(data);
        return data;
      });
      return { previous };
    },
    onError: (_err, _postId, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}

export function useAddComment(postId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => getDataProvider().feed.addComment(me.id, postId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feed.comments(postId) });
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });
}

export function useCreatePost() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => getDataProvider().feed.create(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feed.all });
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(me.id) });
    },
  });
}
