import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon, IconButton } from '@/components/ui';
import { useT } from '@/core/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChange, placeholder, autoFocus }: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
    >
      <Icon name="search" size={18} color={colors.textSubtle} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? t('explore.searchPlaceholder')}
        placeholderTextColor={colors.textSubtle}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
        accessibilityLabel={t('common.search')}
      />
      {value.length > 0 ? (
        <IconButton
          icon="x"
          size={28}
          iconSize={16}
          variant="ghost"
          color={colors.textSubtle}
          onPress={() => onChange('')}
          accessibilityLabel={t('common.close')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, height: '100%' },
});
