import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type {
  ArticleFilter,
  ArticleWithAuthor,
  CreateArticleInput,
  ID,
  WriterProfile,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

type WriterApplication = Pick<
  WriterProfile,
  'penName' | 'bio' | 'languages' | 'topics' | 'website'
>;

export function useArticles(filter: ArticleFilter) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.articles.list(me.id, filter),
    queryFn: () => getDataProvider().articles.list(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useArticle(slug: string) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.articles.detail(me.id, slug),
    queryFn: () => getDataProvider().articles.getBySlug(me.id, slug),
    enabled: Boolean(slug),
  });
}

export function useWriters(query: string | null) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.articles.writers(me.id, query),
    queryFn: () => getDataProvider().articles.writers(me.id, query),
    placeholderData: (prev) => prev,
  });
}

export function useWriter(userId: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.articles.writer(me.id, userId),
    queryFn: () => getDataProvider().articles.writer(me.id, userId),
    enabled: Boolean(userId),
  });
}

export function useMyWriterProfile() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.articles.me(me.id),
    queryFn: () => getDataProvider().articles.myWriterProfile(me.id),
  });
}

export function useApplyWriter() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WriterApplication) => getDataProvider().articles.applyWriter(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.articles.all }),
  });
}

export function useCreateArticle() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateArticleInput) => getDataProvider().articles.create(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.articles.all }),
  });
}

export function useUpdateArticle() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: ID; input: Partial<CreateArticleInput> }) =>
      getDataProvider().articles.update(me.id, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.articles.all }),
  });
}

type Patch = (a: ArticleWithAuthor) => ArticleWithAuthor;

/**
 * Önbellekteki tüm yazı listelerini ve detaylarını yamalar; geri alma için eski
 * değerleri döner (iyimser güncellemelerde kullanılır).
 */
function usePatchArticleCaches() {
  const qc = useQueryClient();
  return async (patch: Patch) => {
    await qc.cancelQueries({ queryKey: queryKeys.articles.all });
    const previous: [readonly unknown[], unknown][] = [];
    qc.getQueriesData<ArticleWithAuthor | ArticleWithAuthor[] | null>({
      queryKey: queryKeys.articles.all,
    }).forEach(([key, data]) => {
      if (!data) return;
      const isArticle = (x: unknown): x is ArticleWithAuthor =>
        typeof x === 'object' && x !== null && 'slug' in x && 'likedByMe' in x;
      if (Array.isArray(data)) {
        if (!data.some(isArticle)) return;
        previous.push([key, data]);
        qc.setQueryData(
          key,
          data.map((x) => (isArticle(x) ? patch(x) : x)),
        );
      } else if (isArticle(data)) {
        previous.push([key, data]);
        qc.setQueryData(key, patch(data));
      }
    });
    return previous;
  };
}

/** Beğen / beğeniyi kaldır — iyimser. */
export function useToggleArticleLike() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const patchCaches = usePatchArticleCaches();
  return useMutation({
    mutationFn: (articleId: ID) => getDataProvider().articles.toggleLike(me.id, articleId),
    onMutate: async (articleId) => {
      const previous = await patchCaches((a) =>
        a.id === articleId
          ? {
              ...a,
              likedByMe: !a.likedByMe,
              likesCount: Math.max(0, a.likesCount + (a.likedByMe ? -1 : 1)),
            }
          : a,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

/** Kaydet / kaydı kaldır — iyimser. */
export function useToggleArticleSave() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  const patchCaches = usePatchArticleCaches();
  return useMutation({
    mutationFn: (articleId: ID) => getDataProvider().articles.toggleSave(me.id, articleId),
    onMutate: async (articleId) => {
      const previous = await patchCaches((a) =>
        a.id === articleId ? { ...a, savedByMe: !a.savedByMe } : a,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.articles.all }),
  });
}

export function useToggleFollowWriter() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: ID) => getDataProvider().articles.toggleFollowWriter(me.id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useArticleComments(articleId: ID | null | undefined) {
  return useQuery({
    queryKey: queryKeys.articles.comments(articleId ?? ''),
    queryFn: () => getDataProvider().articles.comments(articleId ?? ''),
    enabled: Boolean(articleId),
  });
}

export function useAddArticleComment(articleId: ID) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      getDataProvider().articles.addComment(me.id, articleId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.articles.comments(articleId) });
      qc.invalidateQueries({ queryKey: queryKeys.articles.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useSavedArticles() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.articles.saved(me.id),
    queryFn: () => getDataProvider().articles.saved(me.id),
  });
}

export function useMyArticles() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.articles.mine(me.id),
    queryFn: () => getDataProvider().articles.mine(me.id),
  });
}
