import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { SOS_STAGES, type SosStage } from '@/domain';

interface Props {
  stage: SosStage;
}

const STAGE_ICONS: Record<SosStage, IconName> = {
  idle: 'shield',
  armed: 'lock',
  sent: 'send',
  acknowledged: 'check-check',
  dispatched: 'ambulance',
  resolved: 'shield-check',
};

/** 6 aşamalı yatay SOS ilerleme göstergesi; aktif aşama vurgulu, geçmişler tamamlandı. */
export function SosStageStepper({ stage }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const current = SOS_STAGES.indexOf(stage);
  const resolved = stage === 'resolved';

  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel={t(`satellite.sos.stage.${stage}`)}
      accessibilityValue={{ min: 0, max: SOS_STAGES.length - 1, now: current }}
    >
      {SOS_STAGES.map((s, i) => {
        const done = i < current || resolved;
        const active = i === current && !resolved;
        const tint = resolved ? colors.success : active ? colors.danger : colors.primary;
        const color = done || active ? tint : colors.border;
        return (
          <React.Fragment key={s}>
            {i > 0 ? (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: i <= current || resolved ? tint : colors.border },
                ]}
              />
            ) : null}
            <View style={styles.step}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? tint : active ? `${tint}22` : colors.surfaceMuted,
                    borderColor: color,
                    borderWidth: active ? 2 : 1,
                  },
                ]}
              >
                <Icon
                  name={STAGE_ICONS[s]}
                  size={14}
                  color={done ? colors.textInverse : active ? tint : colors.textSubtle}
                  strokeWidth={2.4}
                />
              </View>
              <Text
                variant="caption"
                weight={active ? 'bold' : 'medium'}
                color={active ? tint : done ? 'text' : 'textSubtle'}
                align="center"
                numberOfLines={2}
                style={styles.label}
              >
                {t(`satellite.sos.stage.${s}`)}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm },
  step: { alignItems: 'center', width: 52, gap: 6 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: { flex: 1, height: 2, marginTop: 14, marginHorizontal: -8, borderRadius: 1 },
  label: { fontSize: 10, lineHeight: 12 },
});
