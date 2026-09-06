import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  dialUrl,
  primaryNumber,
  rescueProfileFor,
  urgencyMeta,
  type ConsultUrgency,
  type TriageKind,
} from '@/domain';

import { UrgencyBadge } from './UrgencyBadge';

export interface TriageCardData {
  urgency: ConsultUrgency;
  steps: string[];
  firstAidSlug: string | null;
  callEmergency: boolean;
  kind?: TriageKind;
}

interface Props {
  triage: TriageCardData;
  /** Acil numara için ülke kodu (yoksa TR) */
  countryCode?: string | null;
  source?: 'local' | 'remote';
  /** Başlığa dokununca katlanır */
  collapsible?: boolean;
  initiallyCollapsed?: boolean;
  /** Ekran içinde rehber bağlantısı gösterilsin mi */
  showGuide?: boolean;
}

/**
 * Ön triyaj kartı: aciliyet rengi, numaralı adımlar, ilk yardım rehberi
 * bağlantısı ve critical/high için büyük "acil numarayı ara" butonu.
 */
export function TriageCard({
  triage,
  countryCode = null,
  source = 'local',
  collapsible = false,
  initiallyCollapsed = false,
  showGuide = true,
}: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const meta = urgencyMeta(triage.urgency);
  const color = colors[meta.color];
  const number = primaryNumber(rescueProfileFor(countryCode ?? 'TR'), 'medical');
  const kindLabel = triage.kind
    ? t(`telemed.triage.kind.${triage.kind}`)
    : t('telemed.triage.title');

  const header = (
    <View style={styles.header}>
      <Icon name={meta.icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text variant="title" numberOfLines={1}>
          {kindLabel}
        </Text>
        <Text variant="caption" color="textMuted">
          {t(`telemed.triage.source.${source}`)}
        </Text>
      </View>
      <UrgencyBadge urgency={triage.urgency} soft={false} />
      {collapsible ? (
        <Icon
          name={collapsed ? 'chevron-down' : 'chevron-right'}
          size={18}
          color={colors.textSubtle}
        />
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: color },
      ]}
    >
      {collapsible ? (
        <Tappable
          onPress={() => setCollapsed((c) => !c)}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={collapsed ? t('telemed.triage.show') : t('telemed.triage.hide')}
        >
          {header}
        </Tappable>
      ) : (
        header
      )}

      {collapsed ? null : (
        <View style={styles.body}>
          {triage.callEmergency ? (
            <Tappable
              onPress={() => Linking.openURL(dialUrl(number)).catch(() => undefined)}
              haptic="medium"
              accessibilityRole="button"
              accessibilityLabel={t('telemed.triage.callEmergency', { number })}
              style={[styles.call, { backgroundColor: colors.danger }]}
            >
              <Icon name="phone" size={22} color="#FFFFFF" strokeWidth={2.4} />
              <Text variant="title" weight="bold" color="#FFFFFF">
                {t('telemed.triage.callEmergency', { number })}
              </Text>
            </Tappable>
          ) : null}
          {triage.callEmergency ? (
            <Text variant="caption" color="danger">
              {t('telemed.triage.callHint')}
            </Text>
          ) : null}

          <Text variant="label" color="textMuted">
            {t('telemed.triage.steps')}
          </Text>
          {triage.steps.map((step, i) => (
            <View key={`${i}-${step.slice(0, 12)}`} style={styles.step}>
              <View style={[styles.num, { backgroundColor: color }]}>
                <Text variant="label" weight="bold" color={colors.textInverse}>
                  {i + 1}
                </Text>
              </View>
              <Text variant="bodySm" style={{ flex: 1 }}>
                {step}
              </Text>
            </View>
          ))}

          {showGuide && triage.firstAidSlug ? (
            <Button
              label={t('telemed.triage.guide')}
              icon="book-open"
              variant="secondary"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: '/first-aid/[slug]',
                  params: { slug: triage.firstAidSlug as string },
                })
              }
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  body: { gap: spacing.sm },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 56,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
  },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
