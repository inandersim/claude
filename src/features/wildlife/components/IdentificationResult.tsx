import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { ID, SpeciesIdentification } from '@/domain';
import { dangerRank } from '@/domain';

import { DangerBadge, dangerColor } from './DangerBadge';

export interface IdentificationResultProps {
  result: SpeciesIdentification;
  onOpenSpecies: (id: ID) => void;
  onAskCommunity: () => void;
  onPanic?: () => void;
  onDoctor?: () => void;
}

/** Aday listesi (güven barları), tehlikeli aday uyarısı, tavsiyeler ve eylemler. */
export function IdentificationResult({
  result,
  onOpenSpecies,
  onAskCommunity,
  onPanic,
  onDoctor,
}: IdentificationResultProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const hasDanger = result.candidates.some((c) => dangerRank(c.danger) >= 2);

  return (
    <View style={styles.root}>
      {hasDanger ? (
        <View
          style={[styles.alert, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
          accessibilityRole="alert"
        >
          <Icon name="shield-alert" size={20} color={colors.danger} />
          <View style={styles.flex}>
            <Text variant="title" color={colors.danger}>
              {t('wildlife.identify.dangerAlert')}
            </Text>
            <Text variant="bodySm" color="textMuted">
              {t('wildlife.identify.dangerAlertBody')}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.header}>
        <Text variant="h3">{t('wildlife.identify.result')}</Text>
        <Text variant="caption" color="textMuted">
          {t(`wildlife.identify.source.${result.source}`)}
        </Text>
      </View>

      <View style={styles.list}>
        {result.candidates.map((c, idx) => {
          const color = dangerColor(c.danger, colors);
          const pct = Math.round(c.confidence * 100);
          const content = (
            <>
              <View style={styles.candidateTop}>
                <View style={styles.flex}>
                  <Text variant="title" numberOfLines={1}>
                    {idx + 1}. {c.name}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {t('wildlife.identify.confidence', { value: pct })}
                    {c.speciesId ? '' : ` · ${t('wildlife.identify.unknown')}`}
                  </Text>
                </View>
                <DangerBadge level={c.danger} />
              </View>
              <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
            </>
          );
          const style = [
            styles.candidate,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ];
          return c.speciesId ? (
            <Tappable
              key={`${c.name}-${idx}`}
              style={style}
              onPress={() => onOpenSpecies(c.speciesId as ID)}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${t('wildlife.identify.openSpecies')}`}
            >
              {content}
            </Tappable>
          ) : (
            <View key={`${c.name}-${idx}`} style={style}>
              {content}
            </View>
          );
        })}
      </View>

      {result.advice.length > 0 ? (
        <View style={[styles.advice, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="label" color="textMuted">
            {t('wildlife.identify.advice').toLocaleUpperCase(locale)}
          </Text>
          {result.advice.map((a, i) => (
            <View key={i} style={styles.adviceRow}>
              <Icon name="check" size={14} color={colors.primary} />
              <Text variant="bodySm" style={styles.flex}>
                {a}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {hasDanger && onPanic ? (
          <Button
            label={t('wildlife.identify.panic')}
            icon="siren"
            variant="danger"
            onPress={onPanic}
            fullWidth
          />
        ) : null}
        <View style={styles.actionRow}>
          <Button
            label={t('wildlife.identify.askCommunity')}
            icon="message-circle"
            onPress={onAskCommunity}
            style={styles.flex}
          />
          {hasDanger && onDoctor ? (
            <Button
              label={t('wildlife.doctor')}
              icon="heart-pulse"
              variant="secondary"
              onPress={onDoctor}
              style={styles.flex}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  alert: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  list: { gap: spacing.sm },
  candidate: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  candidateTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  advice: { padding: spacing.md, borderRadius: radius.md, gap: spacing.xs },
  adviceRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  actions: { gap: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
});
