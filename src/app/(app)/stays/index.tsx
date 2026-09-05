import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { BUSINESS_TYPES, BUSINESS_TYPE_META, type BusinessType } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { SearchBar } from '@/features/explore/components/SearchBar';
import { BusinessCard } from '@/features/stays/components/BusinessCard';
import { useBusinesses } from '@/features/stays/hooks';

export default function StaysScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<BusinessType | null>(null);
  const [staysOnly, setStaysOnly] = useState(false);
  const businesses = useBusinesses({ query, type, staysOnly, origin: me.coords });

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('stays.title')}
        subtitle={t('stays.subtitle')}
        showBack
        right={
          <Button
            label={t('stays.register')}
            icon="plus"
            size="sm"
            variant="secondary"
            onPress={() => router.push('/stays/register')}
          />
        }
      />
      <View style={styles.content}>
        <SearchBar value={query} onChange={setQuery} placeholder={t('stays.searchPlaceholder')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginHorizontal: -spacing.lg }}
        >
          <Chip
            label={t('stays.staysOnly')}
            icon="house"
            selected={staysOnly}
            onPress={() => setStaysOnly((v) => !v)}
          />
          {BUSINESS_TYPES.map((b) => (
            <Chip
              key={b}
              label={t(BUSINESS_TYPE_META[b].labelKey)}
              icon={BUSINESS_TYPE_META[b].icon}
              selected={type === b}
              onPress={() => setType(type === b ? null : b)}
            />
          ))}
        </ScrollView>

        {businesses.isError ? (
          <ErrorState onRetry={() => businesses.refetch()} />
        ) : businesses.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} height={260} style={{ borderRadius: radius.xl }} />)
        ) : businesses.data && businesses.data.length > 0 ? (
          businesses.data.map((b) => <BusinessCard key={b.id} business={b} />)
        ) : (
          <EmptyState
            icon="building-2"
            title={t('stays.empty')}
            description={t('stays.emptyDescription')}
            action={{
              label: t('stays.register'),
              icon: 'plus',
              variant: 'secondary',
              onPress: () => router.push('/stays/register'),
            }}
          />
        )}

        <View
          style={[styles.cta, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
        >
          <Icon name="store" size={20} color={colors.accent} />
          <Text variant="bodySm" style={{ flex: 1 }}>
            {t('stays.partnerCta')}
          </Text>
          <Button
            label={t('stays.register')}
            size="sm"
            variant="accent"
            onPress={() => router.push('/stays/register')}
          />
        </View>
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
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
  },
});
