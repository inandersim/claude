import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { spacing } from '@/core/theme';

export function RatingStars({
  rating,
  count,
  size = 14,
}: {
  rating: number;
  count?: number;
  size?: number;
}) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          size={size}
          color="#FFB547"
          fill={i <= Math.round(rating) ? '#FFB547' : 'none'}
          strokeWidth={2}
        />
      ))}
      <Text variant="caption" weight="bold" style={{ marginLeft: 2 }}>
        {rating.toFixed(1)}
      </Text>
      {count !== undefined ? (
        <Text variant="caption" color="textSubtle">
          ({count})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: spacing.xs },
});
