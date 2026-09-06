import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, IconButton, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { countryFlag, type MapPack } from '@/domain';

import { formatMb } from './meta';

interface Props {
  pack: MapPack;
  onDownload: (pack: MapPack) => void;
  onRemove: (pack: MapPack) => void;
  /** Süren indirmeyi durdurur (verilmezse durdurma butonu çıkmaz) */
  onCancel?: (pack: MapPack) => void;
  busy?: boolean;
}

/** Harita paketi kartı — kart dokunulabilir DEĞİL; satır içi butonlar ayrı. */
export function PackCard({ pack, onDownload, onRemove, onCancel, busy = false }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const downloading = pack.status === 'downloading';
  const downloaded = pack.status === 'downloaded' || pack.status === 'update_available';
  const percent = Math.round(pack.progress * 100);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={`${pack.name}, ${formatMb(pack.sizeMb, locale)}`}
    >
      <View style={styles.row}>
        <View style={[styles.flag, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="h3">{countryFlag(pack.countryCode)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="title" numberOfLines={1}>
            {pack.name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {formatMb(pack.sizeMb, locale)} · {t('maps.version', { version: pack.version })} ·{' '}
            {pack.format.toUpperCase()}
          </Text>
        </View>
        {pack.status === 'update_available' ? (
          <Badge label={t('maps.updating')} color={colors.warning} icon="refresh-cw" soft />
        ) : pack.status === 'downloaded' ? (
          <Badge label={t('maps.offlineReady')} color={colors.success} icon="circle-check" soft />
        ) : null}
      </View>

      {downloading ? (
        <View style={styles.progressWrap}>
          <View
            style={[styles.track, { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
          >
            <View
              style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary }]}
            />
          </View>
          <Text variant="caption" color="textMuted" style={{ width: 42, textAlign: 'right' }}>
            {t('maps.progress', { percent })}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Text variant="caption" color="textSubtle" style={{ flex: 1 }}>
          {downloading ? t('maps.downloading') : downloaded ? (pack.localPath ?? '') : ''}
        </Text>
        {pack.status === 'available' ? (
          <Button
            label={t('maps.download')}
            icon="download"
            size="sm"
            variant="primary"
            loading={busy}
            onPress={() => onDownload(pack)}
          />
        ) : null}
        {pack.status === 'update_available' ? (
          <Button
            label={t('maps.update')}
            icon="refresh-cw"
            size="sm"
            variant="secondary"
            loading={busy}
            onPress={() => onDownload(pack)}
          />
        ) : null}
        {downloading && onCancel ? (
          <Button
            label={t('maps.cancelDownload')}
            icon="x"
            size="sm"
            variant="ghost"
            onPress={() => onCancel(pack)}
          />
        ) : null}
        {downloaded || downloading ? (
          <IconButton
            icon="trash"
            variant="ghost"
            size={36}
            iconSize={18}
            onPress={() => onRemove(pack)}
            accessibilityLabel={`${t('maps.remove')}: ${pack.name}`}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  flag: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
