import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, IconButton, Input, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDistance, POI_KINDS, type PoiKind } from '@/domain';
import type { TrackRecorder } from '@/features/tracks/hooks';

import { formatClock } from './meta';
import { PoiChip } from './PoiRow';

interface Props {
  recorder: TrackRecorder;
  onFinish: () => void;
}

/**
 * Kayıt paneli: büyük süre/mesafe/irtifa, başlat/duraklat/bitir düğmeleri ve
 * "Nokta ekle" alt formu (tür + ad + not).
 */
export function RecorderPanel({ recorder, onFinish }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const [poiOpen, setPoiOpen] = useState(false);
  const [poiKind, setPoiKind] = useState<PoiKind>('campsite');
  const [poiName, setPoiName] = useState('');
  const [poiNote, setPoiNote] = useState('');
  const [poiError, setPoiError] = useState<string | null>(null);

  const { status, stats, elapsedSec, current } = recorder;
  const statusLabel = t(`tracks.recorder.${status}`);
  const statusColor =
    status === 'recording'
      ? colors.danger
      : status === 'paused'
        ? colors.warning
        : colors.textMuted;

  const submitPoi = () => {
    const name = poiName.trim();
    if (!name) {
      setPoiError(t('tracks.poi.nameRequired'));
      return;
    }
    if (recorder.addPoi(poiKind, name, poiNote.trim())) {
      setPoiOpen(false);
      setPoiName('');
      setPoiNote('');
      setPoiError(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text variant="label" color="textMuted">
          {statusLabel.toLocaleUpperCase('tr-TR')}
        </Text>
        <Text variant="label" color="textSubtle" style={{ marginLeft: 'auto' }}>
          {t('tracks.recorder.gpsPoints', { count: recorder.points.length })}
        </Text>
      </View>

      <Text variant="display" align="center" accessibilityLabel={t('tracks.recorder.elapsed')}>
        {formatClock(elapsedSec)}
      </Text>

      <View style={styles.bigStats}>
        <BigStat
          label={t('tracks.stats.distance')}
          value={formatDistance(stats.distanceKm, locale)}
        />
        <BigStat label={t('tracks.stats.ascent')} value={formatAltitude(stats.ascentM, locale)} />
        <BigStat
          label={t('tracks.stats.maxAlt')}
          value={
            current?.elevationM !== null && current?.elevationM !== undefined
              ? formatAltitude(Math.round(current.elevationM), locale)
              : '—'
          }
        />
      </View>

      <View style={styles.actions}>
        {status === 'idle' ? (
          <Button
            label={t('tracks.recorder.start')}
            icon="play"
            size="lg"
            fullWidth
            onPress={() => void recorder.start()}
          />
        ) : null}
        {status === 'recording' ? (
          <>
            <Button
              label={t('tracks.recorder.pause')}
              icon="pause"
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
              onPress={recorder.pause}
            />
            <Button
              label={t('tracks.recorder.finish')}
              icon="flag"
              variant="danger"
              size="lg"
              style={{ flex: 1 }}
              onPress={onFinish}
            />
          </>
        ) : null}
        {status === 'paused' ? (
          <>
            <Button
              label={t('tracks.recorder.resume')}
              icon="play"
              size="lg"
              style={{ flex: 1 }}
              onPress={recorder.resume}
            />
            <Button
              label={t('tracks.recorder.finish')}
              icon="flag"
              variant="danger"
              size="lg"
              style={{ flex: 1 }}
              onPress={onFinish}
            />
          </>
        ) : null}
        {status === 'stopped' ? (
          <Button
            label={t('tracks.recorder.discard')}
            icon="trash"
            variant="ghost"
            size="lg"
            fullWidth
            onPress={recorder.reset}
          />
        ) : null}
      </View>

      {status === 'recording' || status === 'paused' ? (
        <View style={styles.poiRow}>
          <Button
            label={t('tracks.poi.add')}
            icon="map-pin"
            variant="ghost"
            size="sm"
            onPress={() => setPoiOpen((v) => !v)}
          />
          {recorder.pois.length > 0 ? (
            <Text variant="caption" color="textMuted">
              {t('tracks.poiCount', { count: recorder.pois.length })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {poiOpen ? (
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text variant="title" style={{ flex: 1 }}>
              {t('tracks.recorder.addPoiTitle')}
            </Text>
            <IconButton
              icon="x"
              variant="ghost"
              size={32}
              onPress={() => setPoiOpen(false)}
              accessibilityLabel={t('common.close')}
            />
          </View>
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
                selected={k === poiKind}
                onPress={() => setPoiKind(k)}
              />
            ))}
          </ScrollView>
          <Input
            label={t('tracks.poi.name')}
            placeholder={t('tracks.poi.namePlaceholder')}
            value={poiName}
            onChangeText={(v) => {
              setPoiName(v);
              setPoiError(null);
            }}
            error={poiError}
          />
          <Input
            label={t('tracks.poi.note')}
            placeholder={t('tracks.poi.notePlaceholder')}
            value={poiNote}
            onChangeText={setPoiNote}
          />
          <Button label={t('tracks.poi.add')} icon="plus" onPress={submitPoi} fullWidth />
        </View>
      ) : null}
    </View>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="h2" weight="extrabold">
        {value}
      </Text>
      <Text variant="label" color="textSubtle">
        {label.toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bigStats: { flexDirection: 'row', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  poiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheet: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', gap: spacing.sm },
});
