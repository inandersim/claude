import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Input,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { POI_KINDS, type PoiKind } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { PoiChip, PoiRow } from '@/features/tracks/components/PoiRow';
import { useAddPoi, useConfirmPoi, usePoisNear } from '@/features/tracks/hooks';

const RADII = [5, 25, 100, 300] as const;

export default function PoisScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);

  const [kind, setKind] = useState<PoiKind | null>(null);
  const [radiusKm, setRadiusKm] = useState<(typeof RADII)[number]>(100);
  const [formOpen, setFormOpen] = useState(false);
  const [newKind, setNewKind] = useState<PoiKind>('water');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pois = usePoisNear(location.coords, radiusKm, kind);
  const confirmPoi = useConfirmPoi();
  const addPoi = useAddPoi();

  const onConfirm = (poiId: string) =>
    confirmPoi.mutate(poiId, {
      onSuccess: () => toast(t('tracks.poi.confirmedToast'), 'success'),
      onError: (e) => toast(e.message || t('common.error'), 'error'),
    });

  const onAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('tracks.poi.nameRequired'));
      return;
    }
    addPoi.mutate(
      {
        trackId: null,
        communityTrailId: null,
        kind: newKind,
        coords: location.coords,
        elevationM: null,
        name: trimmed,
        note: note.trim(),
        photoUrl: null,
        source: 'user',
        mediaId: null,
      },
      {
        onSuccess: () => {
          toast(t('tracks.poi.added'), 'success');
          setFormOpen(false);
          setName('');
          setNote('');
          setError(null);
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('tracks.tabs.pois')}
        subtitle={t('tracks.poi.radius', { km: radiusKm })}
        showBack
        onBack={() => goBack(router, '/')}
        right={
          <IconButton
            icon={formOpen ? 'x' : 'plus'}
            onPress={() => setFormOpen((v) => !v)}
            accessibilityLabel={t('tracks.poi.add')}
          />
        }
      />
      <View style={styles.content}>
        {formOpen ? (
          <View
            style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text variant="h3">{t('tracks.poi.addHere')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {POI_KINDS.map((k) => (
                <PoiChip
                  key={k}
                  kind={k}
                  size="sm"
                  selected={newKind === k}
                  onPress={() => setNewKind(k)}
                />
              ))}
            </ScrollView>
            <Input
              label={t('tracks.poi.name')}
              placeholder={t('tracks.poi.namePlaceholder')}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(null);
              }}
              error={error}
            />
            <Input
              label={t('tracks.poi.note')}
              placeholder={t('tracks.poi.notePlaceholder')}
              value={note}
              onChangeText={setNote}
            />
            <Text variant="caption" color="textSubtle">
              {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
            </Text>
            <Button
              label={t('tracks.poi.add')}
              icon="plus"
              onPress={onAdd}
              loading={addPoi.isPending}
              fullWidth
            />
          </View>
        ) : null}

        <View style={styles.radii}>
          {RADII.map((r) => (
            <Chip
              key={r}
              label={t('tracks.radiusKm', { km: r })}
              selected={radiusKm === r}
              onPress={() => setRadiusKm(r)}
              size="sm"
            />
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={{ marginHorizontal: -spacing.lg }}
        >
          <View style={{ width: spacing.lg }} />
          <Chip
            label={t('tracks.poi.allKinds')}
            selected={kind === null}
            onPress={() => setKind(null)}
            size="sm"
          />
          {POI_KINDS.map((k) => (
            <PoiChip
              key={k}
              kind={k}
              size="sm"
              selected={kind === k}
              onPress={() => setKind(kind === k ? null : k)}
            />
          ))}
          <View style={{ width: spacing.lg }} />
        </ScrollView>

        <SectionHeader
          title={t('tracks.poi.nearby')}
          subtitle={t('tracks.poiCount', { count: pois.data?.length ?? 0 })}
        />
        {pois.isError ? (
          <ErrorState onRetry={() => pois.refetch()} />
        ) : pois.isLoading ? (
          <>
            <Skeleton height={76} style={{ borderRadius: radius.lg }} />
            <Skeleton height={76} style={{ borderRadius: radius.lg }} />
            <Skeleton height={76} style={{ borderRadius: radius.lg }} />
          </>
        ) : (pois.data ?? []).length === 0 ? (
          <EmptyState
            icon="map-pin"
            title={t('tracks.emptyPois')}
            description={t('tracks.emptyPoisDescription')}
            action={{ label: t('tracks.poi.add'), icon: 'plus', onPress: () => setFormOpen(true) }}
          />
        ) : (
          (pois.data ?? []).map((poi) => (
            <PoiRow
              key={poi.id}
              poi={poi}
              onConfirm={() => onConfirm(poi.id)}
              confirming={confirmPoi.isPending}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.huge },
  form: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
  radii: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
