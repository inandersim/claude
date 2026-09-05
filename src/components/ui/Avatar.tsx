import { Image } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/core/theme';
import { initials } from '@/core/utils/format';

import { Icon } from './Icon';
import { Text } from './Text';

export interface AvatarProps {
  uri: string | null | undefined;
  name: string;
  size?: number;
  verified?: boolean;
  /** Çevresinde vurgu halkası */
  ring?: boolean;
}

export function Avatar({ uri, name, size = 44, verified = false, ring = false }: AvatarProps) {
  const { colors, isDark } = useTheme();
  const [failed, setFailed] = useState(false);
  const badgeSize = Math.max(14, Math.round(size * 0.34));

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surfaceMuted,
            borderWidth: ring ? 2 : 0,
            borderColor: colors.primary,
          },
        ]}
      >
        {uri && !failed ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => setFailed(true)}
            accessibilityLabel={name}
          />
        ) : (
          <Text
            weight="bold"
            color={colors.textMuted}
            style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}
          >
            {initials(name)}
          </Text>
        )}
      </View>
      {verified ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: colors.background,
              borderColor: isDark ? colors.background : colors.surface,
            },
          ]}
        >
          <Icon
            name="badge-check"
            size={badgeSize - 2}
            color={colors.primary}
            fill={colors.primarySoft}
            strokeWidth={2.4}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
