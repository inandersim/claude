import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, Chip, Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { AiAction, VisionAdvice } from '@/domain';
import { actionIcon } from '@/features/ai/components/ChatBubble';

import { RiskBadge, riskColor } from './RiskBadge';
import { SITUATION_ICONS } from './SituationChips';

export interface AdviceCardProps {
  advice: VisionAdvice;
  onAction?: (action: AiAction) => void;
}

function Section({
  icon,
  title,
  items,
  color,
  bullet,
}: {
  icon: IconName;
  title: string;
  items: string[];
  color: string;
  bullet: 'dot' | 'number' | 'x';
}) {
  const { colors } = useTheme();
  const { locale } = useT();
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Icon name={icon} size={16} color={color} strokeWidth={2.4} />
        <Text variant="label" color="textMuted">
          {title.toLocaleUpperCase(locale)}
        </Text>
      </View>
      {items.map((item, index) => (
        <View key={`${index}-${item.slice(0, 16)}`} style={styles.item}>
          {bullet === 'number' ? (
            <View style={[styles.num, { backgroundColor: color }]}>
              <Text variant="label" weight="extrabold" color="#06120B">
                {index + 1}
              </Text>
            </View>
          ) : (
            <View style={styles.bulletIcon}>
              <Icon
                name={bullet === 'x' ? 'circle-x' : 'circle-check'}
                size={16}
                color={bullet === 'x' ? colors.danger : color}
              />
            </View>
          )}
          <Text variant="bodySm" style={styles.itemText}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Analiz sonucu kartı: risk rozeti, gözlemler, tavsiye adımları, kaçınılacaklar,
 * uygulama içi aksiyon çipleri ve kaynak rozeti (Bulut / Çevrimdışı).
 */
export function AdviceCard({ advice, onAction }: AdviceCardProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const color = riskColor(advice.risk, colors);
  const confidencePct = Math.round(advice.confidence * 100);

  return (
    <Card elevated style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name={SITUATION_ICONS[advice.situation]} size={18} color={colors.primary} />
          <Text variant="title">{t(`vision.situation.${advice.situation}`)}</Text>
        </View>
        <RiskBadge risk={advice.risk} />
      </View>

      <View style={styles.meta}>
        <Badge
          label={t(`vision.source.${advice.source}`)}
          color={advice.source === 'remote' ? colors.primary : colors.textSubtle}
          icon={advice.source === 'remote' ? 'cloud' : 'wifi-off'}
        />
        <Text variant="caption" color="textSubtle">
          {t('vision.confidence', { value: confidencePct })}
        </Text>
      </View>
      {advice.source === 'local' ? (
        <Text variant="caption" color="textMuted">
          {t('vision.source.localBody')}
        </Text>
      ) : null}

      <Section
        icon="eye"
        title={t('vision.observations')}
        items={advice.observations}
        color={colors.info}
        bullet="dot"
      />
      <Section
        icon="list-checks"
        title={t('vision.advice')}
        items={advice.advice}
        color={color}
        bullet="number"
      />
      <Section
        icon="ban"
        title={t('vision.avoid')}
        items={advice.avoid}
        color={colors.danger}
        bullet="x"
      />

      {advice.actions.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Icon name="arrow-up-right" size={16} color={colors.primary} strokeWidth={2.4} />
            <Text variant="label" color="textMuted">
              {t('vision.actions').toLocaleUpperCase(locale)}
            </Text>
          </View>
          <View style={styles.actions} accessibilityLabel={t('vision.actions')}>
            {advice.actions.map((action) => (
              <Chip
                key={`${action.href}-${action.label}`}
                label={action.label}
                icon={actionIcon(action.icon)}
                size="sm"
                onPress={onAction ? () => onAction(action) : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.disclaimer, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name="info" size={14} color={colors.textSubtle} />
        <Text variant="caption" color="textSubtle" style={styles.itemText}>
          {t('vision.disclaimer')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, borderLeftWidth: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  section: { gap: spacing.xs + 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemText: { flex: 1 },
  bulletIcon: { marginTop: 1 },
  num: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
  },
});
