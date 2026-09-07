import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';

import { useMapEngine } from '../vector/engine';
import { fallbackReason } from '../vector/fallback';
import { resolveMapStyle, type MapOverlay } from '../vector/style';
import type {
  MapFallbackReason,
  MapStyleSpec,
  MapStyleVariant,
  MapViewProps,
} from '../vector/types';

/** Uygulama renk şeması → stil varyantı (bire bir). */
function variantOf(scheme: string): MapStyleVariant {
  return scheme === 'dark' ? 'dark' : scheme === 'sun' ? 'sun' : 'light';
}

const ATTRIBUTION = '© OpenStreetMap katkıcıları';

/**
 * Platformlar arası tek harita arayüzü.
 *
 * - Web: `maplibre-gl` + `pmtiles://` protokolü
 * - iOS/Android: `@maplibre/maplibre-react-native` (geliştirme derlemesi gerekir)
 * - **Zarif düşüş:** karo kaynağı yoksa, motor yüklenemezse ya da stil hata verirse
 *   `fallback` (mevcut SVG görünümü) çizilir; harita hiçbir koşulda boş kalmaz.
 */
export function MapView(props: MapViewProps) {
  const {
    source = null,
    variant,
    availableLayers,
    slopeShading = false,
    demSource = null,
    hillshade = true,
    terrain3d = false,
    terrainExaggeration = 1,
    route,
    routeDone,
    track,
    markers,
    userLocation,
    offRoute,
    height = 300,
    attribution = ATTRIBUTION,
    sourceLabel,
    fallback,
    onFallback,
    accessibilityLabel,
    testID,
  } = props;

  const { colors, scheme } = useTheme();
  const engine = useMapEngine();
  const [failure, setFailure] = useState<MapFallbackReason | null>(null);

  const activeVariant = variant ?? variantOf(scheme);

  const overlay = useMemo<MapOverlay>(
    () => ({
      route,
      routeDone,
      track,
      markers,
      userLocation,
      offRoute,
      colors: {
        route: colors.primary,
        track: colors.accent,
        user: colors.info,
        danger: colors.danger,
        halo: scheme === 'dark' ? '#0B1210' : '#FFFFFF',
      },
    }),
    [route, routeDone, track, markers, userLocation, offRoute, colors, scheme],
  );

  const style = useMemo<MapStyleSpec | null>(() => {
    if (!source) return null;
    try {
      return resolveMapStyle({
        variant: activeVariant,
        source,
        availableLayers,
        attribution,
        overlay,
        slopeShading,
        demSource,
        hillshade,
        terrain3d,
        terrainExaggeration,
      });
    } catch {
      return null;
    }
  }, [
    source,
    activeVariant,
    availableLayers,
    attribution,
    overlay,
    slopeShading,
    demSource,
    hillshade,
    terrain3d,
    terrainExaggeration,
  ]);

  const onError = useCallback(
    (reason: MapFallbackReason) => {
      setFailure((prev) => prev ?? reason);
      onFallback?.(reason);
    },
    [onFallback],
  );

  const reason = fallbackReason({
    hasSource: Boolean(source),
    hasStyle: Boolean(style),
    engineStatus: engine.status,
    hasEngineComponent: Boolean(engine.Component),
    failure,
  });

  if (reason) {
    return (
      <View
        style={[styles.root, { height, borderColor: colors.border }]}
        testID={testID ? `${testID}-fallback` : undefined}
      >
        {fallback}
        <Chrome attribution={attribution} sourceLabel={sourceLabel} />
      </View>
    );
  }

  const Engine = engine.Component;
  return (
    <View
      style={[
        styles.root,
        { height, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
      ]}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {Engine && style ? <Engine {...props} style={style} onError={onError} /> : null}
      {sourceLabel ? <Chrome sourceLabel={sourceLabel} /> : null}
    </View>
  );
}

/** Harita üstü künye: kaynak etiketi (sol alt) ve atıf (sağ alt). */
function Chrome({ attribution, sourceLabel }: { attribution?: string; sourceLabel?: string }) {
  const { colors } = useTheme();
  return (
    <>
      {sourceLabel ? (
        <View style={[styles.pill, styles.sourcePill, { backgroundColor: colors.overlay }]}>
          <Text variant="caption" style={styles.pillText} numberOfLines={1}>
            {sourceLabel}
          </Text>
        </View>
      ) : null}
      {attribution ? (
        <View style={[styles.pill, styles.attribution, { backgroundColor: colors.overlay }]}>
          <Text variant="caption" style={styles.pillText} numberOfLines={1}>
            {attribution}
          </Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    bottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    maxWidth: '60%',
  },
  pillText: { color: '#FFFFFF' },
  attribution: { right: spacing.xs },
  sourcePill: { left: spacing.xs },
});
