import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatTime } from '@/core/utils/time';
import type { ConsultMessage, User } from '@/domain';

interface Props {
  message: ConsultMessage & { sender: User };
  mine: boolean;
}

/** Danışma mesaj balonu; doktor talimatları vurgulu çerçeve ve etiketle gösterilir. */
export function ConsultBubble({ message, mine }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const instruction = message.isInstruction && !mine;
  const fg = mine ? colors.onPrimary : colors.text;
  const metaColor = mine ? 'rgba(6,18,11,0.6)' : colors.textSubtle;

  return (
    <View style={[styles.row, mine ? styles.mineRow : styles.theirsRow]}>
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4 },
          instruction && {
            backgroundColor: colors.infoSoft,
            borderColor: colors.info,
            borderWidth: 1,
          },
        ]}
        accessibilityLabel={
          instruction ? `${t('telemed.doctorSays')}: ${message.content}` : undefined
        }
      >
        {instruction ? (
          <View style={styles.instructionHead}>
            <Icon name="list-checks" size={13} color={colors.info} strokeWidth={2.4} />
            <Text variant="label" weight="bold" color={colors.info}>
              {t('telemed.doctorSays')}
            </Text>
          </View>
        ) : null}
        {message.imageUrl ? (
          <Image
            source={{ uri: message.imageUrl }}
            style={styles.image}
            contentFit="cover"
            accessibilityLabel={t('telemed.consult.imageAlt')}
          />
        ) : null}
        {message.content ? (
          <Text variant="body" color={fg}>
            {message.content}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <Text variant="label" color={metaColor}>
            {formatTime(message.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginVertical: 3 },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    gap: 4,
  },
  instructionHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  image: { width: 220, height: 160, borderRadius: radius.md, marginBottom: 2 },
  meta: { flexDirection: 'row', justifyContent: 'flex-end' },
});
