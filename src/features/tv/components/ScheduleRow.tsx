import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { isOnAir, timeRange, type TvChannel, type TvSchedule } from '@/domain';

interface Props {
  item: TvSchedule & { channel: TvChannel };
  /** Zaman damgası; "şimdi" vurgusu için */
  now: number;
  showChannel?: boolean;
}

/** Yayın akışı satırı: saat aralığı, kanal, başlık; yayındaysa "ŞİMDİ" vurgusu. */
export function ScheduleRow({ item, now, showChannel = true }: Props) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const onAir = isOnAir(item, now);
  const past = new Date(item.endsAt).getTime() <= now;

  const open = () => {
    if (item.programId) router.push({ pathname: '/tv/watch/[id]', params: { id: item.programId } });
    else if (item.streamId) router.push({ pathname: '/live/[id]', params: { id: item.streamId } });
  };
  const tappable = Boolean(item.programId || item.streamId);

  const content = (
    <>
      <View style={styles.time}>
        <Text
          variant="caption"
          weight="bold"
          color={onAir ? 'primary' : past ? 'textSubtle' : 'text'}
        >
          {timeRange(item.startsAt, item.endsAt)}
        </Text>
        {onAir ? (
          <View style={[styles.nowPill, { backgroundColor: colors.primary }]}>
            <View style={styles.liveDot} />
            <Text variant="label" weight="extrabold" color={colors.onPrimary}>
              {t('tv.nowPlaying').toLocaleUpperCase(locale)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.rail, { backgroundColor: item.channel.color }]} />
      <View style={styles.body}>
        {showChannel ? (
          <Text variant="label" weight="extrabold" color={item.channel.color}>
            {item.channel.name.toLocaleUpperCase(locale)}
          </Text>
        ) : null}
        <Text
          variant="bodySm"
          weight={onAir ? 'extrabold' : 'semibold'}
          color={past ? 'textMuted' : 'text'}
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </View>
      {item.streamId ? (
        <Icon name="radio-tower" size={16} color={colors.danger} />
      ) : tappable ? (
        <Icon name="chevron-right" size={16} color={colors.textSubtle} />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    {
      backgroundColor: onAir ? colors.primarySoft : colors.surface,
      borderColor: onAir ? colors.primary : colors.border,
    },
  ];

  if (!tappable) return <View style={rowStyle}>{content}</View>;
  return (
    <Tappable
      onPress={open}
      scaleTo={0.985}
      style={rowStyle}
      accessibilityRole="button"
      accessibilityLabel={`${timeRange(item.startsAt, item.endsAt)} ${item.channel.name}: ${item.title}`}
    >
      {content}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  time: { width: 92, gap: 4 },
  nowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: radius.full,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  rail: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  body: { flex: 1, gap: 2 },
});
