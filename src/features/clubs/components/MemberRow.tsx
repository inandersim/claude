import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { canManage, type ClubRole, type User } from '@/domain';

/** Üye satırı: avatar, ad, rol rozeti. */
export function MemberRow({ member }: { member: User & { role: ClubRole | null } }) {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const manager = canManage(member.role);

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: member.id } })}
      haptic="selection"
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={member.displayName}
    >
      <Avatar
        uri={member.avatarUrl}
        name={member.displayName}
        size={40}
        verified={member.isVerified}
      />
      <View style={{ flex: 1 }}>
        <Text variant="title" numberOfLines={1}>
          {member.displayName}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          @{member.username}
        </Text>
      </View>
      {member.role ? (
        <Badge
          label={t(`clubs.role.${member.role}`)}
          color={manager ? colors.accent : colors.textMuted}
          icon={member.role === 'president' ? 'crown' : manager ? 'shield-check' : undefined}
        />
      ) : null}
      <Icon name="chevron-right" size={16} color={colors.textSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
});
