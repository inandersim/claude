import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Header, Icon, IconButton } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import {
  consultDurationMin,
  consultStatusMeta,
  doctorDisplayName,
  isConsultOpen,
  type ConsultationWithDetails,
} from '@/domain';

interface Props {
  consultation: ConsultationWithDetails;
  onBack: () => void;
}

/** Danışma başlığı: doktor, durum, süre ve görüntülü arama yer tutucusu. */
export function ConsultHeader({ consultation, onBack }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const open = isConsultOpen(consultation.status);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [open]);

  const meta = consultStatusMeta(consultation.status);
  const minutes = consultDurationMin(consultation, new Date(now));
  const doctor = consultation.doctor;
  const title = doctor
    ? doctorDisplayName(doctor, doctor.user.displayName)
    : t('telemed.consult.unassigned');
  const subtitle = `${t(meta.labelKey)}${
    consultation.acceptedAt ? ` · ${t('telemed.consult.duration', { min: minutes })}` : ''
  }`;

  return (
    <Header
      showBack
      onBack={onBack}
      title={title}
      subtitle={subtitle}
      right={
        <View style={styles.right}>
          {doctor ? (
            <Avatar
              uri={doctor.user.avatarUrl}
              name={doctor.user.displayName}
              size={34}
              verified={doctor.isVerified}
            />
          ) : (
            <Icon name={meta.icon} size={20} color={colors[meta.color]} />
          )}
          {open ? (
            <IconButton
              icon="video"
              onPress={() => toast(t('telemed.consult.videoNote'), 'info')}
              accessibilityLabel={t('telemed.consult.video')}
            />
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
