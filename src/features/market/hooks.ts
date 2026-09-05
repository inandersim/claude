import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { CreateListingInput, ID, ListingFilter, ListingWithSeller } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useListings(filter: ListingFilter = {}) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.market.list(me.id, filter),
    queryFn: () => getDataProvider().market.list(me.id, filter),
    placeholderData: (prev) => prev,
  });
}

export function useListing(id: ID) {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.market.detail(me.id, id),
    queryFn: () => getDataProvider().market.getById(me.id, id),
  });
}

export function useCreateListing() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateListingInput) => getDataProvider().market.create(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.market.all }),
  });
}

export function useToggleFavorite() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: ID) => getDataProvider().market.toggleFavorite(me.id, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.market.all });
      const patch = (l: ListingWithSeller) =>
        l.id === id
          ? {
              ...l,
              favoritedByMe: !l.favoritedByMe,
              favoritesCount: l.favoritesCount + (l.favoritedByMe ? -1 : 1),
            }
          : l;
      qc.setQueriesData<ListingWithSeller[] | ListingWithSeller | null>(
        { queryKey: queryKeys.market.all },
        (data) => {
          if (!data) return data;
          return Array.isArray(data) ? data.map(patch) : patch(data);
        },
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.market.all }),
  });
}

export function useMarkSold() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: ID) => getDataProvider().market.markSold(me.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.market.all }),
  });
}
