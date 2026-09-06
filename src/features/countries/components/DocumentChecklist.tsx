import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { checklistProgress, type CountryGuide } from '@/domain';

interface Props {
  documents: CountryGuide['documents'];
  done: string[];
  onToggle: (key: string) => void;
  disabled?: boolean;
}

/** Checkbox satırları — zorunlu rozeti, not ve ilerleme çubuğu. */
export function DocumentChecklist({ documents, done, onToggle, disabled = false }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const progress = checklistProgress({ documents }, { done });
  const doneSet = new Set(done);
  const total = progress.required.total + progress.optional.total;
  const doneCount = progress.required.done + progress.optional.done;
  const barColor = progress.requiredComplete ? colors.success : colors.primary;

  return (
    <View style={styles.wrap}>
      <View style={styles.progressHeader}>
        <Text variant="caption" weight="bold">
          {t('countries.checklist.progress', { done: doneCount, total })}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('countries.checklist.requiredProgress', {
            done: progress.required.done,
            total: progress.required.total,
          })}
        </Text>
      </View>
      <View
        style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.ratio * 100) }}
      >
        <View
          style={[
            styles.fill,
            { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: barColor },
          ]}
        />
      </View>

      {documents.map((doc) => {
        const checked = doneSet.has(doc.key);
        return (
          <Tappable
            key={doc.key}
            onPress={() => onToggle(doc.key)}
            disabled={disabled}
            haptic="selection"
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled }}
            accessibilityLabel={doc.label}
            accessibilityHint={
              checked ? t('countries.checklist.markUndone') : t('countries.checklist.markDone')
            }
            style={[
              styles.row,
              {
                backgroundColor: checked ? colors.successSoft : colors.surface,
                borderColor: checked ? colors.success : colors.border,
              },
            ]}
          >
            <Icon
              name={checked ? 'circle-check' : 'square'}
              size={22}
              color={checked ? colors.success : colors.textSubtle}
              strokeWidth={checked ? 2.4 : 1.8}
            />
            <View style={styles.rowBody}>
              <View style={styles.rowTitle}>
                <Text
                  variant="body"
                  weight="semibold"
                  style={[{ flexShrink: 1 }, checked && styles.done]}
                  color={checked ? 'textMuted' : 'text'}
                >
                  {doc.label}
                </Text>
                {doc.required ? (
                  <Badge label={t('countries.checklist.required')} color={colors.danger} />
                ) : null}
              </View>
              {doc.note ? (
                <Text variant="caption" color="textMuted">
                  {doc.note}
                </Text>
              ) : null}
            </View>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden', marginBottom: spacing.xs },
  fill: { height: '100%', borderRadius: radius.full },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowBody: { flex: 1, gap: spacing.xxs },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  done: { textDecorationLine: 'line-through' },
});
