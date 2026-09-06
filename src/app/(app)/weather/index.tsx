import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative, formatTime } from '@/core/utils/time';
import { bestWindow, eawsRegionFor, freezingLevel, type GeoPoint } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import {
  AlertBanner,
  AvalancheCard,
  BestWindowCard,
  DailyList,
  FreezingLevelLine,
  HourlyStrip,
  WeatherNow,
  WindCompass,
} from '@/features/weather/components';
import { useAvalanche, useForecast } from '@/features/weather/hooks';

const BEST_WINDOW_HOURS = 6;

function parseNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function WeatherScreen() {
  const params = useLocalSearchParams<{
    lat?: string;
    lon?: string;
    name?: string;
    elevation?: string;
  }>();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const location = useLocation(me.coords);

  const paramLat = parseNumber(params.lat);
  const paramLon = parseNumber(params.lon);
  const hasParamCoords = paramLat != null && paramLon != null;
  const coords: GeoPoint = hasParamCoords
    ? { latitude: paramLat, longitude: paramLon }
    : location.coords;
  const elevationParam = parseNumber(params.elevation);
  const placeName = (Array.isArray(params.name) ? params.name[0] : params.name) ?? null;

  const forecast = useForecast(coords, elevationParam);
  const region = eawsRegionFor(coords);
  const avalanche = useAvalanche(region ? coords : null);

  const data = forecast.data;
  const nowMs = data ? new Date(data.fetchedAt).getTime() : null;
  const currentIdx = data
    ? Math.max(
        0,
        data.hourly.findIndex((h) => new Date(h.time).getTime() + 3_600_000 > (nowMs ?? 0)),
      )
    : 0;
  const current = data?.hourly[currentIdx] ?? null;
  const window = data ? bestWindow(data.hourly.slice(currentIdx), BEST_WINDOW_HOURS) : null;
  const freezing = data ? freezingLevel(data.hourly.slice(currentIdx), data.elevationM) : null;
  const todayKey = data ? data.fetchedAt.slice(0, 10) : undefined;
  const isRefreshing = forecast.isFetching && !!data;

  const subtitle =
    placeName ??
    (hasParamCoords
      ? `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`
      : t('weather.myLocation'));

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('weather.title')}
        subtitle={subtitle}
        showBack
        right={
          <IconButton
            icon="refresh-cw"
            variant="ghost"
            accessibilityLabel={t('weather.refresh')}
            onPress={() => {
              forecast.refetch();
              avalanche.refetch();
            }}
          />
        }
      />
      <View style={styles.content}>
        {!hasParamCoords && location.isFallback ? (
          <View
            style={[styles.note, { backgroundColor: colors.infoSoft, borderColor: colors.info }]}
          >
            <Icon name="map-pin-off" size={14} color={colors.info} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('weather.locationFallback')}
            </Text>
          </View>
        ) : null}

        {forecast.isError && !data ? (
          <ErrorState onRetry={() => forecast.refetch()} />
        ) : !data || !current ? (
          <View style={{ gap: spacing.md }} accessibilityLabel={t('weather.loading')}>
            <Skeleton height={190} style={{ borderRadius: radius.xl }} />
            <Skeleton height={72} style={{ borderRadius: radius.xl }} />
            <Skeleton height={120} style={{ borderRadius: radius.lg }} />
            <Skeleton height={320} style={{ borderRadius: radius.xl }} />
          </View>
        ) : (
          <>
            <WeatherNow hour={current} elevationM={data.elevationM} placeName={placeName} />

            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t('weather.alerts.title')} />
              {data.alerts.length === 0 ? (
                <View
                  style={[
                    styles.note,
                    { backgroundColor: colors.successSoft, borderColor: colors.success },
                  ]}
                >
                  <Icon name="circle-check" size={16} color={colors.success} />
                  <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                    {t('weather.alerts.none')}
                  </Text>
                </View>
              ) : (
                data.alerts
                  .slice(0, 6)
                  .map((a) => <AlertBanner key={`${a.kind}-${a.from}`} alert={a} />)
              )}
            </View>

            <BestWindowCard window={window} hours={BEST_WINDOW_HOURS} />

            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t('weather.hourly')} subtitle={t('weather.hourlyHint')} />
              <HourlyStrip hourly={data.hourly} nowMs={nowMs ?? undefined} />
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t('weather.daily')} />
              <DailyList daily={data.daily} todayKey={todayKey} />
              {data.daily[0] ? (
                <View style={styles.sunRow}>
                  <View style={styles.sunItem}>
                    <Icon name="sunrise" size={14} color={colors.warning} />
                    <Text variant="caption" color="textMuted">
                      {t('weather.sunrise')} {formatTime(data.daily[0].sunrise)}
                    </Text>
                  </View>
                  <View style={styles.sunItem}>
                    <Icon name="moon" size={14} color={colors.info} />
                    <Text variant="caption" color="textMuted">
                      {t('weather.sunset')} {formatTime(data.daily[0].sunset)}
                    </Text>
                  </View>
                  <View style={styles.sunItem}>
                    <Icon name="sun" size={14} color={colors.danger} />
                    <Text variant="caption" color="textMuted">
                      {t('weather.uv')} {data.daily[0].uvIndex.toFixed(0)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <WindCompass
              directionDeg={current.windDirectionDeg}
              speedKmh={current.windKmh}
              gustKmh={current.windGustKmh}
            />

            <FreezingLevelLine freezingLevelM={freezing} elevationM={data.elevationM} />

            {region ? (
              avalanche.isError ? (
                <ErrorState onRetry={() => avalanche.refetch()} />
              ) : avalanche.isLoading ? (
                <Skeleton height={220} style={{ borderRadius: radius.xl }} />
              ) : (
                <AvalancheCard bulletin={avalanche.data ?? null} region={region} />
              )
            ) : (
              <AvalancheCard bulletin={null} region={null} />
            )}

            <View style={[styles.source, { borderTopColor: colors.border }]}>
              <Icon
                name={data.source === 'open-meteo' ? 'globe' : 'wifi-off'}
                size={13}
                color={colors.textSubtle}
              />
              <Text variant="caption" color="textSubtle" style={{ flex: 1 }} numberOfLines={2}>
                {data.source === 'open-meteo'
                  ? t('weather.source.openMeteo')
                  : t('weather.source.mock')}{' '}
                ·{' '}
                {isRefreshing
                  ? t('weather.loading')
                  : t('weather.updatedAgo', {
                      ago: formatRelative(data.fetchedAt, new Date(), locale),
                    })}
                {data.source === 'mock'
                  ? `\n${t('weather.source.mockHint')}`
                  : `\n${t('weather.source.attribution')}`}
              </Text>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge, gap: spacing.lg },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  sunRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  sunItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  source: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
});
