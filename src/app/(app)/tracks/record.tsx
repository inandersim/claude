import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button, Chip, Header, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPES,
  ADVENTURE_TYPE_META,
  type AdventureType,
  type TrackPoi,
  type TrackPoint,
} from '@/domain';
import { RecorderPanel } from '@/features/tracks/components/RecorderPanel';
import { TrackMap } from '@/features/tracks/components/TrackMap';
import { useSaveTrack, useTrackRecorder, useTracks } from '@/features/tracks/hooks';

export default function RecordTrackScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();

  // Web demosu: örnek bir parça oynatılır
  const demoSource = useTracks({});
  const demoPoints: TrackPoint[] | null =
    Platform.OS === 'web'
      ? (demoSource.data?.find((x) => x.points.length >= 40)?.points ?? null)
      : null;

  const recorder = useTrackRecorder({ simulate: demoPoints });
  const save = useSaveTrack();

  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [type, setType] = useState<AdventureType>('hiking');
  const [isPublic, setIsPublic] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  const onFinish = () => {
    if (recorder.points.length < 2) {
      toast(t('tracks.recorder.tooShort'), 'error');
      return;
    }
    recorder.stop();
  };

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('auth.requiredField'));
      return;
    }
    save.mutate(
      {
        name: trimmed,
        adventureType: type,
        points: recorder.points,
        source: 'recorded',
        isPublic,
        regionName: region,
        pois: recorder.pois,
      },
      {
        onSuccess: (track) => {
          toast(t('tracks.recorder.saved'), 'success');
          router.replace({ pathname: '/tracks/[id]', params: { id: track.id } });
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  const previewPois: TrackPoi[] = recorder.pois.map((p, i) => ({
    ...p,
    id: `draft_${i}`,
    trackId: null,
    communityTrailId: null,
    userId: 'me',
    confirmations: 0,
    createdAt: '',
  }));

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t('tracks.recorder.title')} showBack onBack={() => goBack(router, '/')} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TrackMap
          points={recorder.points}
          pois={previewPois}
          position={recorder.current}
          height={260}
          name={t('tracks.recorder.title')}
          strokeColor={colors.danger}
        />

        {recorder.isSimulated ? (
          <Text variant="caption" color="textSubtle" align="center">
            {t('tracks.recorder.demoHint')}
          </Text>
        ) : null}
        {recorder.error === 'permission' ? (
          <Text variant="caption" color="danger" align="center">
            {t('tracks.recorder.permissionDenied')}
          </Text>
        ) : recorder.error === 'unavailable' ? (
          <Text variant="caption" color="danger" align="center">
            {t('common.errorDescription')}
          </Text>
        ) : null}

        <RecorderPanel recorder={recorder} onFinish={onFinish} />

        {recorder.status === 'stopped' ? (
          <View
            style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text variant="h3">{t('tracks.recorder.saveTitle')}</Text>
            <Input
              label={t('tracks.recorder.nameLabel')}
              placeholder={t('tracks.recorder.namePlaceholder')}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setNameError(null);
              }}
              error={nameError}
            />
            <Input
              label={t('tracks.recorder.regionLabel')}
              placeholder={t('tracks.recorder.regionPlaceholder')}
              value={region}
              onChangeText={setRegion}
              icon="map-pin"
            />
            <Text variant="label" color="textMuted">
              {t('tracks.recorder.typeLabel').toLocaleUpperCase('tr-TR')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {ADVENTURE_TYPES.map((a) => (
                <Chip
                  key={a}
                  label={t(ADVENTURE_TYPE_META[a].labelKey)}
                  icon={ADVENTURE_TYPE_META[a].icon}
                  color={ADVENTURE_TYPE_META[a].color}
                  selected={type === a}
                  onPress={() => setType(a)}
                  size="sm"
                />
              ))}
            </ScrollView>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="semibold">
                  {t('tracks.recorder.publicLabel')}
                </Text>
                <Text variant="caption" color="textMuted">
                  {t('tracks.recorder.publicHint')}
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={t('tracks.recorder.publicLabel')}
              />
            </View>
            <Button
              label={t('common.save')}
              icon="check"
              fullWidth
              onPress={onSave}
              loading={save.isPending}
            />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.huge },
  form: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
