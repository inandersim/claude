import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, EmptyState, ErrorState, Header, Screen, Skeleton } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing } from '@/core/theme';
import type { AdventureType, InstructorFilter } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { SearchBar } from '@/features/explore/components/SearchBar';
import { AdventureTypeFilter } from '@/features/feed/components/AdventureTypeFilter';
import { InstructorCard } from '@/features/instructors/components/InstructorCard';
import { useInstructors } from '@/features/instructors/hooks';

type SortBy = NonNullable<InstructorFilter['sortBy']>;

export default function InstructorsScreen() {
  const router = useRouter();
  const { t } = useT();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<AdventureType | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('rating');
  const instructors = useInstructors(location.coords, { query, adventureType: type, sortBy });

  const sorts: { value: SortBy; label: string; icon: 'star' | 'navigation' | 'banknote' }[] = [
    { value: 'rating', label: t('instructors.sortRating'), icon: 'star' },
    { value: 'distance', label: t('instructors.sortDistance'), icon: 'navigation' },
    { value: 'price', label: t('instructors.sortPrice'), icon: 'banknote' },
  ];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('instructors.title')}
        subtitle={t('instructors.subtitle')}
        showBack
        right={
          <Chip
            size="sm"
            label={t('instructors.becomeInstructor')}
            icon="graduation-cap"
            onPress={() => router.push('/bookings')}
          />
        }
      />
      <View style={styles.content}>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('instructors.searchPlaceholder')}
        />
        <View style={{ marginHorizontal: -spacing.lg }}>
          <AdventureTypeFilter value={type} onChange={setType} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
          style={{ marginHorizontal: -spacing.lg }}
        >
          {sorts.map((s) => (
            <Chip
              key={s.value}
              size="sm"
              label={s.label}
              icon={s.icon}
              selected={sortBy === s.value}
              onPress={() => setSortBy(s.value)}
            />
          ))}
        </ScrollView>

        {instructors.isError ? (
          <ErrorState onRetry={() => instructors.refetch()} />
        ) : instructors.isLoading ? (
          [0, 1, 2].map((i) => (
            <Skeleton key={i} height={170} style={{ borderRadius: radius.xl }} />
          ))
        ) : instructors.data && instructors.data.length > 0 ? (
          instructors.data.map((i) => <InstructorCard key={i.id} instructor={i} />)
        ) : (
          <EmptyState
            icon="graduation-cap"
            title={t('instructors.empty')}
            description={t('instructors.emptyDescription')}
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
  },
  sortRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
