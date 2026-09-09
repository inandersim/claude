import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Icon, IconButton, Input, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { rescueCountryFlag, countryName, RESCUE_COUNTRY_CODES, rescueProfileFor } from '@/domain';

interface Props {
  visible: boolean;
  /** Şu an seçili ülke (elle seçilmişse). */
  value: string | null;
  onSelect: (code: string) => void;
  /** Otomatik tespite dön. */
  onAuto: () => void;
  onClose: () => void;
}

/** Türkçe/İngilizce aramada aksanları sadeleştirir. */
function normalize(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Elle ülke seçimi: arama + liste (otomatik tespit yanlışsa). */
export function CountryPicker({ visible, value, onSelect, onAuto, onClose }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const all = RESCUE_COUNTRY_CODES.map((code) => ({
      code,
      name: countryName(code, locale),
      general: rescueProfileFor(code).emergency.general,
    })).sort((a, b) => a.name.localeCompare(b.name, locale));
    const q = normalize(query.trim());
    if (!q) return all;
    return all.filter(
      (item) => normalize(item.name).includes(q) || item.code.toLowerCase().startsWith(q),
    );
  }, [locale, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('rescue.close')}
      />
      <View style={[styles.wrap, { pointerEvents: 'box-none' }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceElevated, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{t('rescue.changeCountry')}</Text>
              <Text variant="caption" color="textMuted">
                {t('rescue.autoDetectHint')} · {t('rescue.countryCount', { count: items.length })}
              </Text>
            </View>
            <IconButton
              icon="x"
              onPress={onClose}
              variant="ghost"
              accessibilityLabel={t('rescue.close')}
            />
          </View>
          <Input
            icon="search"
            placeholder={t('rescue.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t('rescue.search')}
          />
          <Button
            label={t('rescue.autoDetect')}
            icon="locate-fixed"
            variant={value ? 'secondary' : 'primary'}
            size="sm"
            onPress={() => {
              onAuto();
              onClose();
            }}
          />
          <FlatList
            data={items}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={{ gap: spacing.xs }}
            ListEmptyComponent={<EmptyState icon="globe" title={t('rescue.noResults')} compact />}
            renderItem={({ item }) => {
              const selected = item.code === value;
              return (
                <Tappable
                  onPress={() => {
                    onSelect(item.code);
                    onClose();
                  }}
                  haptic="selection"
                  scaleTo={0.99}
                  style={[
                    styles.item,
                    {
                      backgroundColor: selected ? colors.primarySoft : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} · ${item.general}`}
                  accessibilityState={{ selected }}
                >
                  <Text variant="h3">{rescueCountryFlag(item.code)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="title" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {item.code} · {t('rescue.numbers.general')} {item.general}
                    </Text>
                  </View>
                  {selected ? (
                    <Icon name="check" size={18} color={colors.primary} strokeWidth={2.6} />
                  ) : null}
                </Tappable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '85%',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  list: { flexGrow: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
