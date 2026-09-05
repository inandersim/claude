import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { CreateStoryInput, ID } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

export function useStoryGroups() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: queryKeys.stories.groups(me.id),
    queryFn: () => getDataProvider().stories.groups(me.id),
    refetchInterval: 60_000,
  });
}

export function useCreateStory() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStoryInput) => getDataProvider().stories.create(me.id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.stories.all }),
  });
}

export function useMarkStorySeen() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storyId: ID) => getDataProvider().stories.markSeen(me.id, storyId),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.stories.all }),
  });
}
