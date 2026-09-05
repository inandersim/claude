import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatTime } from '@/core/utils/time';
import type { AiAction, AiMessage } from '@/domain';

/** Aksiyon çipleri için izin verilen ikonlar; bilinmeyen ad → ok ikonu. */
const ACTION_ICONS: ReadonlySet<string> = new Set<IconName>([
  'map-pin',
  'route',
  'triangle-alert',
  'shield-alert',
  'satellite',
  'heart-pulse',
  'phone',
  'cross',
  'search',
  'mountain',
  'shopping-bag',
  'store',
  'book-open',
  'cloud-lightning',
  'tent',
  'compass',
  'map',
  'arrow-up-right',
]);

export function actionIcon(icon: string): IconName {
  return ACTION_ICONS.has(icon) ? (icon as IconName) : 'arrow-up-right';
}

export interface ChatBubbleProps {
  message: AiMessage;
  onAction?: (action: AiAction) => void;
}

/** Kullanıcı / asistan balonu. Düz metin; asistan balonunda aksiyon çipleri. */
export function ChatBubble({ message, onAction }: ChatBubbleProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const mine = message.role === 'user';

  return (
    <View style={[styles.row, mine ? styles.mineRow : styles.theirsRow]}>
      {!mine ? (
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Icon name="sparkles" size={14} color={colors.onPrimary} strokeWidth={2.4} />
        </View>
      ) : null}
      <View style={styles.column}>
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderBottomLeftRadius: 4,
                },
          ]}
          accessibilityLabel={`${mine ? t('ai.you') : t('ai.assistant')}: ${message.content}`}
        >
          <Text variant="body" color={mine ? colors.onPrimary : colors.text}>
            {message.content}
          </Text>
          <View style={styles.meta}>
            {!mine && message.intent ? (
              <Text variant="label" color={colors.primary}>
                {t(`ai.intent.${message.intent}`)}
              </Text>
            ) : null}
            <Text variant="label" color={mine ? 'rgba(6,18,11,0.6)' : colors.textSubtle}>
              {formatTime(message.createdAt)}
            </Text>
          </View>
        </View>
        {!mine && message.actions.length > 0 ? (
          <View style={styles.actions} accessibilityLabel={t('ai.actions')}>
            {message.actions.map((action) => (
              <Chip
                key={`${action.href}-${action.label}`}
                label={action.label}
                icon={actionIcon(action.icon)}
                size="sm"
                onPress={onAction ? () => onAction(action) : undefined}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginVertical: 4, gap: spacing.sm },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  column: { maxWidth: '84%', gap: spacing.sm },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    gap: 4,
  },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
