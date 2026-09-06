import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { huntCategoryMeta, type HuntTask } from '@/domain';

interface Props {
  tasks: HuntTask[];
  completedIds: string[];
  size: 3 | 4;
  onComplete: (task: HuntTask) => void;
  disabled?: boolean;
}

/** Tek hücre: tamamlanınca renklenir ve kısa bir ölçek animasyonu oynar. */
function Cell({
  task,
  done,
  cellSize,
  onPress,
  disabled,
}: {
  task: HuntTask;
  done: boolean;
  cellSize: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);
  const cat = huntCategoryMeta[task.category];

  useEffect(() => {
    if (done) {
      scale.set(
        withSequence(
          withTiming(1.12, { duration: 140 }),
          withSpring(1, { damping: 10, stiffness: 260 }),
        ),
      );
    }
  }, [done, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const compact = cellSize < 96;

  return (
    <Animated.View style={[{ width: cellSize, height: cellSize }, animated]}>
      <Tappable
        onPress={onPress}
        disabled={disabled || done}
        haptic={done ? 'none' : 'medium'}
        accessibilityRole="button"
        accessibilityLabel={task.text}
        accessibilityState={{ checked: done, disabled: disabled || done }}
        accessibilityHint={done ? t('kids.hunt.completed') : t('kids.hunt.complete')}
        style={[
          styles.cell,
          {
            backgroundColor: done ? cat.color : colors.surface,
            borderColor: done ? cat.color : colors.border,
            padding: compact ? spacing.xs + 2 : spacing.sm,
          },
        ]}
      >
        <View style={styles.cellTop}>
          <Icon
            name={task.icon as IconName}
            size={compact ? 16 : 20}
            color={done ? '#FFFFFF' : cat.color}
            strokeWidth={2.2}
          />
          {done ? (
            <Icon name="check" size={compact ? 12 : 14} color="#FFFFFF" strokeWidth={3} />
          ) : (
            <Text variant="label" weight="bold" color={colors.textSubtle}>
              {t('kids.hunt.pointsShort', { points: task.points })}
            </Text>
          )}
        </View>
        <Text
          variant={compact ? 'label' : 'caption'}
          weight="semibold"
          color={done ? '#FFFFFF' : isDark ? colors.text : colors.text}
          numberOfLines={compact ? 3 : 4}
          style={{ flex: 1 }}
        >
          {task.text}
        </Text>
      </Tappable>
    </Animated.View>
  );
}

/** 3×3 ya da 4×4 doğa avı kartı. */
export function HuntBingoGrid({ tasks, completedIds, size, onComplete, disabled }: Props) {
  const { width } = useWindowDimensions();
  const gap = spacing.sm;
  const available = Math.min(width, layout.maxContentWidth) - spacing.lg * 2;
  const cellSize = Math.floor((available - gap * (size - 1)) / size);
  const done = new Set(completedIds);
  const cells = tasks.slice(0, size * size);

  return (
    <View style={[styles.grid, { gap, width: available }]}>
      {cells.map((task) => (
        <Cell
          key={task.id}
          task={task}
          done={done.has(task.id)}
          cellSize={cellSize}
          onPress={() => onComplete(task)}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center' },
  cell: { flex: 1, borderRadius: radius.lg, borderWidth: 1.5, gap: 4 },
  cellTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
