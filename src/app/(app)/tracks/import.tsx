import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Badge, Button, Chip, Header, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  activityToPoints,
  getStravaClient,
  isStravaConfigured,
  type StravaActivity,
  type StravaTokens,
} from '@/data/external/strava';
import { TRACK_SOURCES, type TrackSource } from '@/domain';
import { detectAdventureType, trackStats } from '@/domain/tracks';
import { ImportGuide } from '@/features/tracks/components/ImportGuide';
import { SOURCE_META } from '@/features/tracks/components/meta';
import { useImportGpx, useSaveTrack } from '@/features/tracks/hooks';

const IMPORT_SOURCES = TRACK_SOURCES.filter((s) => s !== 'recorded' && s !== 'media');

export default function ImportTrackScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const importGpx = useImportGpx();
  const saveTrack = useSaveTrack();

  const [gpx, setGpx] = useState('');
  const [name, setName] = useState('');
  const [source, setSource] = useState<TrackSource>('gpx');
  const [error, setError] = useState<string | null>(null);

  const [tokens, setTokens] = useState<StravaTokens | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [stravaBusy, setStravaBusy] = useState(false);
  const stravaReady = isStravaConfigured();

  const onImport = () => {
    if (!gpx.trim().includes('<')) {
      setError(t('tracks.importScreen.invalid'));
      return;
    }
    importGpx.mutate(
      { gpx, source, name: name.trim() || null },
      {
        onSuccess: (track) => {
          toast(t('tracks.importScreen.imported', { name: track.name }), 'success');
          router.replace({ pathname: '/tracks/[id]', params: { id: track.id } });
        },
        onError: () => setError(t('tracks.importScreen.invalid')),
      },
    );
  };

  const connectStrava = async () => {
    const client = getStravaClient();
    if (!client) return;
    setStravaBusy(true);
    try {
      const result = await client.connect();
      if (result) {
        setTokens(result);
        setActivities(await client.activities(result.accessToken, 10));
      }
    } catch {
      toast(t('tracks.importScreen.stravaFailed'), 'error');
    } finally {
      setStravaBusy(false);
    }
  };

  const importActivity = (activity: StravaActivity) => {
    const points = activityToPoints(activity);
    if (points.length < 2) {
      toast(t('tracks.importScreen.invalid'), 'error');
      return;
    }
    saveTrack.mutate(
      {
        name: activity.name,
        adventureType: detectAdventureType(points, trackStats(points)),
        points,
        source: 'strava',
        isPublic: false,
        regionName: '',
        pois: [],
      },
      {
        onSuccess: (track) => {
          toast(t('tracks.importScreen.imported', { name: track.name }), 'success');
          router.replace({ pathname: '/tracks/[id]', params: { id: track.id } });
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('tracks.importScreen.title')}
        subtitle={t('tracks.importScreen.subtitle')}
        showBack
        onBack={() => goBack(router, '/')}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="label" color="textMuted">
          {t('tracks.importScreen.sourceLabel').toLocaleUpperCase('tr-TR')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {IMPORT_SOURCES.map((s) => (
            <Chip
              key={s}
              label={t(`tracks.source.${s}`)}
              icon={SOURCE_META[s].icon}
              color={SOURCE_META[s].color}
              selected={source === s}
              onPress={() => setSource(s)}
              size="sm"
            />
          ))}
        </ScrollView>

        <Input
          label={t('tracks.importScreen.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('tracks.recorder.namePlaceholder')}
        />
        <Input
          label={t('tracks.importScreen.pasteLabel')}
          value={gpx}
          onChangeText={(v) => {
            setGpx(v);
            setError(null);
          }}
          placeholder={t('tracks.importScreen.pastePlaceholder')}
          multiline
          numberOfLines={8}
          style={styles.textarea}
          error={error}
          hint={t('tracks.importScreen.pickUnavailable')}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button
          label={t('tracks.importScreen.submit')}
          icon="upload"
          fullWidth
          onPress={onImport}
          loading={importGpx.isPending}
          disabled={!gpx.trim()}
        />

        <View
          style={[styles.strava, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.stravaHeader}>
            <Text variant="title" style={{ flex: 1 }}>
              {t('tracks.importScreen.strava')}
            </Text>
            {tokens ? (
              <Badge
                label={t('tracks.importScreen.stravaConnected')}
                color={colors.success}
                icon="link"
                soft
              />
            ) : (
              <Badge
                label={t('tracks.importScreen.stravaNotConfigured')}
                color={stravaReady ? colors.warning : colors.textSubtle}
                icon="unlink"
                soft
              />
            )}
          </View>
          {!stravaReady ? (
            <Text variant="caption" color="textMuted">
              {t('tracks.importScreen.stravaNotConfiguredHint')}
            </Text>
          ) : tokens ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" color="textMuted">
                {t('tracks.importScreen.stravaActivities')}
                {tokens.athleteName ? ` · ${tokens.athleteName}` : ''}
              </Text>
              {activities.map((a) => (
                <View key={a.id} style={[styles.activity, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" weight="bold" numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {a.sportType} · {(a.distanceM / 1000).toFixed(1)} km ·{' '}
                      {Math.round(a.elevationGainM)} m
                    </Text>
                  </View>
                  <Button
                    label={t('tracks.importScreen.stravaImport')}
                    size="sm"
                    variant="secondary"
                    onPress={() => importActivity(a)}
                    disabled={!a.streams}
                  />
                </View>
              ))}
            </View>
          ) : (
            <>
              <Button
                label={t('tracks.importScreen.stravaConnect')}
                icon="activity"
                variant="secondary"
                onPress={() => void connectStrava()}
                loading={stravaBusy}
              />
              <Text variant="caption" color="textSubtle">
                {t('tracks.importScreen.stravaRedirectHint')}
              </Text>
            </>
          )}
        </View>

        <ImportGuide />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.huge },
  chips: { flexDirection: 'row', gap: spacing.sm },
  textarea: { minHeight: 140, textAlignVertical: 'top' },
  strava: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stravaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
