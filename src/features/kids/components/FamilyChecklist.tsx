import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  familyChecklistCategoryMeta,
  groupFamilyChecklist,
  type FamilyChecklistItem,
} from '@/domain';

interface Props {
  items: FamilyChecklistItem[];
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
}

/** Kategori gruplu, işaretlenebilir aile kontrol listesi. */
export function FamilyChecklist({ items, checked, onToggle }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const groups = groupFamilyChecklist(items);

  return (
    <View style={{ gap: spacing.lg }}>
      {groups.map((g) => {
        const meta = familyChecklistCategoryMeta[g.category];
        const done = g.items.filter((i) => checked[i.key]).length;
        return (
          <View key={g.category} style={{ gap: spacing.sm }}>
            <View style={styles.groupHead}>
              <View style={[styles.groupIcon, { backgroundColor: `${meta.color}26` }]}>
                <Icon name={meta.icon as IconName} size={16} color={meta.color} strokeWidth={2.4} />
              </View>
              <Text variant="title" weight="extrabold" style={{ flex: 1 }}>
                {t(meta.labelKey)}
              </Text>
              <Text
                variant="caption"
                weight="bold"
                color={done === g.items.length ? 'success' : 'textMuted'}
              >
                {done}/{g.items.length}
              </Text>
            </View>
            <View
              style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {g.items.map((item, idx) => {
                const on = Boolean(checked[item.key]);
                return (
                  <Tappable
                    key={item.key}
                    onPress={() => onToggle(item.key)}
                    haptic="selection"
                    scaleTo={0.99}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={item.label}
                    style={[
                      styles.row,
                      idx > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.box,
                        {
                          backgroundColor: on ? meta.color : 'transparent',
                          borderColor: on ? meta.color : colors.borderStrong,
                        },
                      ]}
                    >
                      {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                    <Text
                      variant="body"
                      color={on ? 'textMuted' : 'text'}
                      style={[{ flex: 1 }, on && styles.strike]}
                    >
                      {item.label}
                    </Text>
                  </Tappable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strike: { textDecorationLine: 'line-through' },
});
