import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { VERIFICATION_RANK, type HostVerificationLevel } from '@/domain';

import { VERIFICATION_ICON } from './meta';

const STEPS: HostVerificationLevel[] = ['id', 'address', 'premium'];

export interface HostVerificationStepsProps {
  level: HostVerificationLevel;
  /** Bir sonraki seviyeye yükselt; verilmezse salt okunur */
  onVerify?: (level: HostVerificationLevel) => void;
  busy?: boolean;
  disabled?: boolean;
}

/** Kimlik → adres → premium doğrulama adımları. */
export function HostVerificationSteps({
  level,
  onVerify,
  busy = false,
  disabled = false,
}: HostVerificationStepsProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const rank = VERIFICATION_RANK[level];

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Icon name={VERIFICATION_ICON[level]} size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="textSubtle">
            {t('inventory.verification.current')}
          </Text>
          <Text variant="title">{t(`inventory.verification.${level}`)}</Text>
        </View>
      </View>
      {STEPS.map((step, i) => {
        const stepRank = VERIFICATION_RANK[step];
        const done = stepRank <= rank;
        const next = stepRank === rank + 1;
        const last = i === STEPS.length - 1;
        return (
          <View key={step} style={styles.step}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? colors.primary : colors.surfaceMuted,
                    borderColor: done || next ? colors.primary : colors.border,
                  },
                ]}
              >
                <Icon
                  name={done ? 'check' : VERIFICATION_ICON[step]}
                  size={12}
                  color={done ? colors.onPrimary : colors.textSubtle}
                  strokeWidth={2.8}
                />
              </View>
              {!last ? (
                <View
                  style={[styles.line, { backgroundColor: done ? colors.primary : colors.border }]}
                />
              ) : null}
            </View>
            <View style={[styles.body, !last ? { paddingBottom: spacing.md } : null]}>
              <Text variant="bodySm" weight="bold" color={done || next ? 'text' : 'textSubtle'}>
                {t(`inventory.verification.${step}`)}
              </Text>
              <Text variant="caption" color="textMuted">
                {t(`inventory.verification.desc.${step}`)}
              </Text>
              {next && onVerify ? (
                <Button
                  label={t('inventory.verification.verify')}
                  size="sm"
                  variant="secondary"
                  icon="shield-check"
                  loading={busy}
                  disabled={disabled}
                  onPress={() => onVerify(step)}
                  style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
                />
              ) : done ? (
                <Text variant="label" weight="bold" color="primary">
                  {t('inventory.verification.done')}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 24 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, minHeight: 16, marginVertical: 2 },
  body: { flex: 1, gap: 2 },
});
