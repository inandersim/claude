import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Icon, Input, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { gecerliOlcum, type OlcumAlani } from '@/domain/altitude';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  AMS_SEVERITY_META,
  lakeLouiseScore,
  type AmsSymptomScore,
  type Destination,
  type ID,
} from '@/domain';

import { amsSeverityColor, amsSeveritySoft } from './meta';

export interface AmsFormValue {
  elevationM: number;
  destinationId: ID | null;
  headache: AmsSymptomScore;
  gi: AmsSymptomScore;
  fatigue: AmsSymptomScore;
  dizziness: AmsSymptomScore;
  note: string;
  /**
   * Saha ölçümleri — hepsi isteğe bağlı. Boş alan `null` gelir; değerlendirme
   * bunu "bilinmiyor" sayar, sıfır saymaz. Sınır dışı değer de `null` olur:
   * uydurma ölçüm üretmektense hiç ölçüm daha güvenli.
   */
  spo2: number | null;
  restingHr: number | null;
  systolic: number | null;
  diastolic: number | null;
}

interface Props {
  destinations?: Pick<Destination, 'id' | 'name'>[];
  initialDestinationId?: ID | null;
  initialElevationM?: number | null;
  submitting?: boolean;
  onSubmit: (value: AmsFormValue) => void;
}

const LEVELS: AmsSymptomScore[] = [0, 1, 2, 3];
type SymptomKey = 'headache' | 'gi' | 'fatigue' | 'dizziness';
const SYMPTOMS: SymptomKey[] = ['headache', 'gi', 'fatigue', 'dizziness'];

/** Lake Louise formu: 4 belirti × 0–3, irtifa, destinasyon, not; canlı skor önizlemesi. */
export function AmsForm({
  destinations = [],
  initialDestinationId = null,
  initialElevationM = null,
  submitting = false,
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  const [elevation, setElevation] = useState(
    initialElevationM !== null ? String(initialElevationM) : '',
  );
  const [destinationId, setDestinationId] = useState<ID | null>(initialDestinationId);
  const [scores, setScores] = useState<Record<SymptomKey, AmsSymptomScore>>({
    headache: 0,
    gi: 0,
    fatigue: 0,
    dizziness: 0,
  });
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Ölçümler metin olarak tutulur: boş alan "ölçüm yok" demek, sıfır değil.
  const [olcum, setOlcum] = useState({ spo2: '', restingHr: '', systolic: '', diastolic: '' });

  /** Boş alan `null`; sınır dışı değer de `null` (uydurma ölçüm üretmemek için). */
  const sayi = (alan: OlcumAlani, ham: string): number | null =>
    ham.trim() ? gecerliOlcum(alan, Number(ham.replace(',', '.'))) : null;

  /** Girilmiş ama sınır dışı kalan alanlar — kullanıcıya sessizce yutmak yerine söylenir. */
  const sinirDisi = (['spo2', 'restingHr', 'systolic', 'diastolic'] as const).filter(
    (alan) => olcum[alan].trim() !== '' && sayi(alan, olcum[alan]) === null,
  );

  const preview = lakeLouiseScore(scores.headache, scores.gi, scores.fatigue, scores.dizziness);
  const meta = AMS_SEVERITY_META[preview.severity];
  const tint = amsSeverityColor(preview.severity, colors);

  const submit = () => {
    const elevationM = Number(elevation.replace(',', '.'));
    if (!elevation.trim() || !Number.isFinite(elevationM) || elevationM < 0 || elevationM > 9000) {
      setError(t('destinations.ams.invalidElevation'));
      return;
    }
    if (sinirDisi.length) {
      setError(t('altitude.measure.outOfRange'));
      return;
    }
    setError(null);
    onSubmit({
      elevationM: Math.round(elevationM),
      destinationId,
      ...scores,
      note: note.trim(),
      spo2: sayi('spo2', olcum.spo2),
      restingHr: sayi('restingHr', olcum.restingHr),
      systolic: sayi('systolic', olcum.systolic),
      diastolic: sayi('diastolic', olcum.diastolic),
    });
  };

  return (
    <View style={styles.root}>
      <Text variant="bodySm" color="textMuted">
        {t('destinations.ams.intro')}
      </Text>
      <Input
        label={t('destinations.ams.elevation')}
        placeholder={t('destinations.ams.elevationPlaceholder')}
        value={elevation}
        onChangeText={setElevation}
        keyboardType="number-pad"
        icon="mountain-snow"
        error={error}
        maxLength={4}
      />
      {destinations.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color="textSubtle">
            {t('destinations.ams.destination')}
          </Text>
          <View style={styles.chips}>
            <Chip
              label={t('destinations.plan.form.noDestination')}
              selected={destinationId === null}
              onPress={() => setDestinationId(null)}
              size="sm"
            />
            {destinations.map((d) => (
              <Chip
                key={d.id}
                label={d.name}
                selected={destinationId === d.id}
                onPress={() => setDestinationId(d.id)}
                size="sm"
              />
            ))}
          </View>
        </View>
      ) : null}

      <Text variant="label" color="textSubtle">
        {t('destinations.ams.symptoms')}
      </Text>
      {SYMPTOMS.map((key) => (
        <View
          key={key}
          style={[styles.symptom, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text variant="title">{t(`destinations.ams.${key}`)}</Text>
          <View style={styles.levels}>
            {LEVELS.map((lvl) => {
              const selected = scores[key] === lvl;
              return (
                <Chip
                  key={lvl}
                  label={`${lvl} · ${t(`destinations.ams.level.l${lvl}`)}`}
                  selected={selected}
                  color={lvl === 0 ? colors.success : lvl === 3 ? colors.danger : colors.primary}
                  onPress={() => setScores((s) => ({ ...s, [key]: lvl }))}
                  size="sm"
                />
              );
            })}
          </View>
        </View>
      ))}

      <Text variant="label" color="textSubtle">
        {t('altitude.measure.title')}
      </Text>
      <Text variant="caption" color="textMuted">
        {t('altitude.measure.hint')}
      </Text>
      <View style={styles.olcumSatiri}>
        <View style={styles.olcumAlani}>
          <Input
            label={t('altitude.measure.spo2')}
            value={olcum.spo2}
            onChangeText={(v) => setOlcum((o) => ({ ...o, spo2: v }))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <View style={styles.olcumAlani}>
          <Input
            label={t('altitude.measure.restingHr')}
            value={olcum.restingHr}
            onChangeText={(v) => setOlcum((o) => ({ ...o, restingHr: v }))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>
      <View style={styles.olcumSatiri}>
        <View style={styles.olcumAlani}>
          <Input
            label={t('altitude.measure.systolic')}
            value={olcum.systolic}
            onChangeText={(v) => setOlcum((o) => ({ ...o, systolic: v }))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <View style={styles.olcumAlani}>
          <Input
            label={t('altitude.measure.diastolic')}
            value={olcum.diastolic}
            onChangeText={(v) => setOlcum((o) => ({ ...o, diastolic: v }))}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>
      <Text variant="caption" color="textMuted">
        {t('altitude.measure.bpHint')}
      </Text>

      <View
        style={[
          styles.preview,
          { backgroundColor: amsSeveritySoft(preview.severity, colors), borderColor: tint },
        ]}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.previewHead}>
          <Icon name="heart-pulse" size={18} color={tint} strokeWidth={2.4} />
          <Text variant="label" color="textSubtle" style={{ flex: 1 }}>
            {t('destinations.ams.preview')}
          </Text>
          <Text variant="h3" color={tint}>
            {t('destinations.ams.score', { score: preview.score })}
          </Text>
        </View>
        <Text variant="title" color={tint}>
          {t(meta.labelKey)}
        </Text>
        <Text variant="bodySm" color="textMuted">
          {t(meta.adviceKey)}
        </Text>
      </View>

      <Input
        label={t('destinations.ams.note')}
        placeholder={t('destinations.ams.notePlaceholder')}
        value={note}
        onChangeText={setNote}
        icon="pencil"
        multiline
      />
      <Button
        label={t('destinations.ams.submit')}
        icon="plus"
        onPress={submit}
        loading={submitting}
        fullWidth
      />
    </View>
  );
}

const styles = StyleSheet.create({
  olcumSatiri: { flexDirection: 'row', gap: spacing.sm },
  olcumAlani: { flex: 1 },
  root: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  symptom: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preview: {
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
