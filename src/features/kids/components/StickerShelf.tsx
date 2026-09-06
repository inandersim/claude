import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { KID_STICKERS, KID_STICKER_META, nextSticker, type HuntProgress } from '@/domain';

interface Props {
  progress: HuntProgress;
}

/** Kazanılan çıkartmalar ve sıradaki eşiğe ilerleme çubuğu. */
export function StickerShelf({ progress }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const earned = new Set(progress.stickers);
  const next = nextSticker(progress.points);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text variant="title" weight="extrabold">
          {t('kids.hunt.stickers')}
        </Text>
        <Text variant="caption" weight="bold" color="primary">
          {t('kids.hunt.points', { points: progress.points })}
        </Text>
      </View>

      <View style={styles.shelf}>
        {KID_STICKERS.map((s) => {
          const meta = KID_STICKER_META[s];
          const has = earned.has(s);
          return (
            <View
              key={s}
              style={styles.sticker}
              accessibilityLabel={`${t(meta.labelKey)}: ${has ? t('kids.hunt.completed') : '—'}`}
            >
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: has ? `${meta.color}33` : colors.surfaceMuted,
                    borderColor: has ? meta.color : colors.border,
                    opacity: has ? 1 : 0.55,
                  },
                ]}
              >
                {has ? (
                  <Text style={styles.emoji}>{meta.emoji}</Text>
                ) : (
                  <Icon name="lock" size={18} color={colors.textSubtle} />
                )}
              </View>
              <Text
                variant="label"
                weight="bold"
                color={has ? meta.color : colors.textSubtle}
                numberOfLines={1}
                align="center"
              >
                {t(meta.labelKey)}
              </Text>
            </View>
          );
        })}
      </View>

      {progress.stickers.length === 0 ? (
        <Text variant="caption" color="textMuted">
          {t('kids.hunt.noStickers')}
        </Text>
      ) : null}

      {next ? (
        <View style={{ gap: spacing.xs }}>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.round(next.progress * 100)}%`,
                  backgroundColor: KID_STICKER_META[next.sticker].color,
                },
              ]}
            />
          </View>
          <View style={styles.nextRow}>
            <Icon
              name={KID_STICKER_META[next.sticker].icon as IconName}
              size={12}
              color={colors.textMuted}
            />
            <Text variant="caption" color="textMuted">
              {t('kids.hunt.nextSticker', {
                sticker: t(KID_STICKER_META[next.sticker].labelKey),
                remaining: next.remaining,
              })}
            </Text>
          </View>
        </View>
      ) : (
        <Text variant="caption" weight="bold" color="success">
          {t('kids.hunt.maxSticker')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shelf: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  sticker: { flex: 1, alignItems: 'center', gap: spacing.xs },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26, lineHeight: 32 },
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
