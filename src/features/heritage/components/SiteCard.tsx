import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Badge, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDuration } from '@/core/utils/time';
import {
  formatDistance,
  heritageEraMeta,
  heritageKindMeta,
  heritageUnescoLabel,
  rescueCountryFlag,
  type HeritageSiteWithDistance,
} from '@/domain';

import { heritageCountryLabelKey } from './meta';

interface Props {
  site: HeritageSiteWithDistance;
  onPress: () => void;
  onToggleSave?: () => void;
  saving?: boolean;
  compact?: boolean;
}

/** Liste kartı: kapak, tür rozeti, UNESCO, dönem rozetleri, mesafe, ziyaret/kayıt durumu. */
export function SiteCard({
  site: s,
  onPress,
  onToggleSave,
  saving = false,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const kind = heritageKindMeta[s.kind];
  const unesco = heritageUnescoLabel(s);
  const countryKey = heritageCountryLabelKey(s.countryCode);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${s.name}, ${s.region}`}
        scaleTo={0.985}
      >
        <AdventureImage
          uri={s.imageUrl}
          adventureType={s.adventureTypes[0] ?? 'hiking'}
          style={[styles.cover, compact && styles.coverCompact]}
          overlay
        >
          <View style={styles.coverTop}>
            <Badge label={t(kind.labelKey)} color={kind.color} icon={kind.icon} soft={false} />
            {unesco ? <Badge label={unesco} color="#F1C40F" icon="award" soft={false} /> : null}
            <View style={{ flex: 1 }} />
            {s.distanceKm !== null ? (
              <View style={styles.pill}>
                <Icon name="navigation" size={12} color="#F2F7F4" strokeWidth={2.4} />
                <Text variant="label" weight="extrabold" color="#F2F7F4">
                  {formatDistance(s.distanceKm, locale)}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="h3" color="#FFFFFF" numberOfLines={2}>
              {rescueCountryFlag(s.countryCode)} {s.name}
            </Text>
            <Text variant="caption" color="#E6EFE9" numberOfLines={1}>
              {s.region} · {countryKey ? t(countryKey) : s.countryCode}
            </Text>
          </View>
        </AdventureImage>
        <View style={styles.body}>
          {!compact ? (
            <Text variant="bodySm" color="textMuted" numberOfLines={2}>
              {s.summary}
            </Text>
          ) : null}
          <View style={styles.eras}>
            {s.eras.map((era) => {
              const m = heritageEraMeta[era];
              return <Badge key={era} label={t(m.labelKey)} color={m.color} icon={m.icon} />;
            })}
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Icon name="clock" size={13} color={colors.textSubtle} strokeWidth={2.2} />
              <Text variant="caption" color="textMuted">
                {formatDuration(s.visitDurationMin, locale)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Icon name="star" size={13} color={colors.accent} strokeWidth={2.4} />
              <Text variant="caption" color="textMuted">
                {s.rating.toFixed(1)}
              </Text>
            </View>
            {s.visitedByMe ? (
              <View style={[styles.state, { backgroundColor: colors.successSoft }]}>
                <Icon name="circle-check" size={12} color={colors.success} strokeWidth={2.4} />
                <Text variant="label" color="success">
                  {t('heritage.visited')}
                </Text>
              </View>
            ) : null}
            {s.savedByMe && !onToggleSave ? (
              <View style={[styles.state, { backgroundColor: colors.primarySoft }]}>
                <Icon name="bookmark" size={12} color={colors.primary} strokeWidth={2.4} />
                <Text variant="label" color="primary">
                  {t('heritage.saved')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Tappable>
      {onToggleSave ? (
        <View style={styles.footer}>
          <Tappable
            onPress={onToggleSave}
            disabled={saving}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={s.savedByMe ? t('heritage.saved') : t('heritage.save')}
            style={[
              styles.saveBtn,
              {
                backgroundColor: s.savedByMe ? colors.primarySoft : colors.surfaceMuted,
                borderColor: s.savedByMe ? colors.primary : colors.border,
              },
            ]}
          >
            <Icon
              name="bookmark"
              size={16}
              color={s.savedByMe ? colors.primary : colors.textMuted}
              strokeWidth={s.savedByMe ? 2.8 : 2}
            />
            <Text variant="caption" weight="bold" color={s.savedByMe ? 'primary' : 'textMuted'}>
              {s.savedByMe ? t('heritage.saved') : t('heritage.save')}
            </Text>
          </Tappable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cover: {
    height: 170,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  coverCompact: { height: 130 },
  coverTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  body: { padding: spacing.md, gap: spacing.sm },
  eras: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  footer: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, alignItems: 'flex-end' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
});
