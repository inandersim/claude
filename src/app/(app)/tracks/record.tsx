import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Chip, Header, Icon, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { currentLocale, useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPES,
  ADVENTURE_TYPE_META,
  type AdventureType,
  type TrackPoi,
  type TrackPoint,
} from '@/domain';
import { POI_COLOR, POI_ICON } from '@/features/tracks/components/meta';
import { RecorderPanel } from '@/features/tracks/components/RecorderPanel';
import { TrackMapView } from '@/features/tracks/components/TrackMapView';
import { usePoisNear, useSaveTrack, useTrackRecorder, useTracks } from '@/features/tracks/hooks';
import { useYaklasmaUyarilari } from '@/features/tracks/proximity';

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

  // Kalıcı bildirim metni ekrandan geçiyor: kanca i18n'e bağlı değil ve
  // metin verilmezse arka plan kaydı hiç açılmıyor (bkz. `backgroundNotice`).
  const backgroundNotice = useMemo(
    () => ({
      title: t('tracks.recorder.backgroundTitle'),
      body: t('tracks.recorder.backgroundBody'),
    }),
    [t],
  );
  const recorder = useTrackRecorder({ simulate: demoPoints, backgroundNotice });
  const save = useSaveTrack();

  // Yakındaki topluluk noktaları. Yalnızca kayıt sürerken sorulur: duran bir
  // ekran için ağ trafiği harcamanın anlamı yok.
  const kayitta = recorder.status === 'recording';
  const konum = recorder.current ?? null;
  const yakinNoktalar = usePoisNear(konum ?? { latitude: 0, longitude: 0 }, 1, null);
  const uyarilar = useYaklasmaUyarilari(
    kayitta ? konum : null,
    yakinNoktalar.data,
    kayitta,
  );

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
        <TrackMapView
          points={recorder.points}
          pois={previewPois}
          position={recorder.current}
          height={260}
          name={t('tracks.recorder.title')}
          strokeColor={colors.danger}
        />

        {uyarilar.length ? (
          <Card style={styles.yakin}>
            <Text variant="label" color="textMuted">
              {t('tracks.recorder.nearbyTitle')}
            </Text>
            {uyarilar.slice(0, 3).map(({ poi, distanceM }) => {
              return (
                <View key={poi.id} style={styles.yakinSatir}>
                  <Icon
                    name={POI_ICON[poi.kind]}
                    size={16}
                    color={POI_COLOR[poi.kind]}
                    strokeWidth={2.4}
                  />
                  <Text variant="bodySm" weight="bold" style={styles.yakinAd}>
                    {poi.name || t(`tracks.poi.kind.${poi.kind}`)}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {t('tracks.recorder.nearbyDistance', { distance: distanceM })}
                  </Text>
                </View>
              );
            })}
          </Card>
        ) : null}

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
              {t('tracks.recorder.typeLabel').toLocaleUpperCase(currentLocale())}
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
  yakin: { gap: spacing.sm },
  yakinSatir: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  yakinAd: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
