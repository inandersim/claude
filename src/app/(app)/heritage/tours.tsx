import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing } from '@/core/theme';
import { useCurrentUser } from '@/features/auth/session.store';
import { TourBuilder } from '@/features/heritage/components/TourBuilder';
import { TourCard } from '@/features/heritage/components/TourCard';
import {
  useCreateTour,
  useDeleteTour,
  useHeritageSites,
  useHeritageTours,
} from '@/features/heritage/hooks';

export default function HeritageToursScreen() {
  const { siteId } = useLocalSearchParams<{ siteId?: string }>();
  const router = useRouter();
  const { t } = useT();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const [building, setBuilding] = useState(Boolean(siteId));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const tours = useHeritageTours();
  const sites = useHeritageSites({});
  const createTour = useCreateTour();
  const deleteTour = useDeleteTour();
  const siteList = useMemo(() => sites.data ?? [], [sites.data]);
  const initialIds = useMemo(() => (siteId ? [siteId] : []), [siteId]);

  const onDelete = (id: string) => {
    setDeletingId(id);
    deleteTour.mutate(id, {
      onSuccess: () => toast(t('heritage.tour.deleted'), 'info'),
      onError: (e) => toast(e.message, 'error'),
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('heritage.tour.title')} subtitle={t('heritage.tour.subtitle')} showBack />
      <View style={styles.content}>
        {building ? (
          sites.isLoading ? (
            <Skeleton height={320} style={{ borderRadius: radius.xl }} />
          ) : (
            <>
              <TourBuilder
                sites={siteList}
                origin={location.isFallback ? null : location.coords}
                initialSiteIds={initialIds}
                submitting={createTour.isPending}
                onSubmit={(input) =>
                  createTour.mutate(input, {
                    onSuccess: () => {
                      toast(t('heritage.tour.created'), 'success');
                      setBuilding(false);
                    },
                    onError: (e) => toast(e.message, 'error'),
                  })
                }
              />
              <Button
                label={t('heritage.tabs.explore')}
                icon="x"
                variant="ghost"
                fullWidth
                onPress={() => setBuilding(false)}
              />
            </>
          )
        ) : (
          <Button
            label={t('heritage.tour.create')}
            icon="plus"
            fullWidth
            onPress={() => setBuilding(true)}
          />
        )}

        <SectionHeader title={t('heritage.tour.title')} />
        {tours.isError ? (
          <ErrorState onRetry={() => tours.refetch()} />
        ) : tours.isLoading || sites.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={180} style={{ borderRadius: radius.xl }} />
            <Skeleton height={180} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : tours.data && tours.data.length > 0 ? (
          tours.data.map((tour) => (
            <TourCard
              key={tour.id}
              tour={tour}
              sites={siteList}
              deleting={deletingId === tour.id && deleteTour.isPending}
              onDelete={() => onDelete(tour.id)}
              onOpenSite={(id) => router.push({ pathname: '/heritage/[id]', params: { id } })}
            />
          ))
        ) : (
          <EmptyState
            icon="route"
            title={t('heritage.tour.empty')}
            description={t('heritage.tour.emptyDescription')}
            action={
              building
                ? undefined
                : {
                    label: t('heritage.tour.create'),
                    icon: 'plus',
                    onPress: () => setBuilding(true),
                  }
            }
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
});
