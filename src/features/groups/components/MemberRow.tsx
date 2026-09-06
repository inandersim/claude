import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import type { GroupRole, User } from '@/domain';

/** Üye satırı: avatar, ad, @kullanıcı adı, rol rozeti; yönetici ise rol menüsü açar. */
export function MemberRow({
  member,
  isMe,
  onPress,
}: {
  member: User & { role: GroupRole };
  isMe: boolean;
  onPress?: () => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const roleColor =
    member.role === 'owner' ? colors.accent : member.role === 'admin' ? colors.primary : null;
  const roleIcon =
    member.role === 'owner' ? 'crown' : member.role === 'admin' ? 'shield-check' : undefined;

  const content = (
    <>
      <Avatar
        uri={member.avatarUrl}
        name={member.displayName}
        size={44}
        verified={member.isVerified}
      />
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text variant="title" numberOfLines={1}>
            {member.displayName}
          </Text>
          {isMe ? (
            <Text variant="caption" color="textSubtle">
              · {t('groups.you')}
            </Text>
          ) : null}
        </View>
        <Text variant="caption" color="textMuted">
          @{member.username}
        </Text>
      </View>
      {roleColor ? (
        <Badge label={t(`groups.role.${member.role}`)} color={roleColor} icon={roleIcon} />
      ) : null}
      {onPress ? <Icon name="chevron-right" size={16} color={colors.textSubtle} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, { borderBottomColor: colors.border }]}>{content}</View>;
  }
  return (
    <Tappable
      onPress={onPress}
      haptic="selection"
      scaleTo={0.99}
      style={[styles.row, { borderBottomColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${member.displayName}, ${t(`groups.role.${member.role}`)}. ${t('groups.setRole')}`}
    >
      {content}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
