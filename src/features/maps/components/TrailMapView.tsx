import React, { useMemo } from 'react';
import { Platform } from 'react-native';

import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import type { GeoPoint, ID, TrailGraph, TrailNode } from '@/domain';

import { useMapPacks } from '../hooks';
import { getPackManager } from '../pack-manager';
import { graphBounds, nearestNode } from '../vector/graph-source';
import { resolveSource, useTileServerPacks } from '../vector/source';
import { boundsOfPoints } from '../vector/style';
import type { MapMarker } from '../vector/types';

import { MapView } from './MapView';
import { RouteMap } from './RouteMap';

interface Props {
  graph: TrailGraph;
  /** Bölge merkezi — hangi karo paketinin kullanılacağını belirler */
  center?: GeoPoint | null;
  /** Planlanan rotanın düğüm sırası */
  routeNodeIds?: ID[];
  /** Rota çizgisinin gerçek geometrisi (yoksa düğümlerden türetilir) */
  routePoints?: GeoPoint[];
  startId?: ID | null;
  endId?: ID | null;
  onNodePress?: (node: TrailNode) => void;
  height?: number;
  showLabels?: boolean;
  /** Eğim açısı gölgelendirmesi (çığ bantları); paket taşımıyorsa yok sayılır */
  slopeShading?: boolean;
}


/** Web'de kalıcı dosya sistemi yok; paket kaynağı yalnızca yerel platformlarda geçerli. */
const packInstalled = (packId: string) =>
  Platform.OS !== 'web' && getPackManager().isInstalled(packId);

/** Düğüm sayısı bunun altındaysa hepsi işaretlenir; üstündeyse yalnızca anlamlı olanlar. */
const MARKER_LIMIT = 80;

/**
 * Patika grafı için gerçek vektör harita. Kaynak sırası:
 * indirilmiş paket → karo sunucusu → grafın kendisinden türetilen GeoJSON.
 * Hiçbiri yoksa (ya da MapLibre yüklenemezse) mevcut SVG görünümüne düşer.
 */
export function TrailMapView({
  graph,
  center = null,
  routeNodeIds = [],
  routePoints,
  startId = null,
  endId = null,
  onNodePress,
  height = 320,
  showLabels = true,
  slopeShading = false,
}: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  const packs = useMapPacks();
  const server = useTileServerPacks();

  const graphCenter = useMemo<GeoPoint | null>(() => {
    if (center) return center;
    const b = graphBounds(graph);
    if (!b) return null;
    return { longitude: (b[0] + b[2]) / 2, latitude: (b[1] + b[3]) / 2 };
  }, [center, graph]);

  const resolved = useMemo(
    () =>
      resolveSource({
        center: graphCenter,
        localPacks: packs.data ?? [],
        serverPacks: server.data ?? [],
        isInstalled: packInstalled,
        graph,
      }),
    [graphCenter, packs.data, server.data, graph],
  );

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const route = useMemo<GeoPoint[]>(() => {
    if (routePoints?.length) return routePoints;
    return routeNodeIds.map((id) => nodeById.get(id)?.coords).filter((c): c is GeoPoint => !!c);
  }, [routePoints, routeNodeIds, nodeById]);

  const markers = useMemo<MapMarker[]>(() => {
    const onRoute = new Set(routeNodeIds);
    const showAll = graph.nodes.length <= MARKER_LIMIT;
    return graph.nodes
      .filter((n) => showAll || n.name || onRoute.has(n.id) || n.id === startId || n.id === endId)
      .map((n) => ({
        id: n.id,
        coords: n.coords,
        label: n.id === startId ? 'A' : n.id === endId ? 'B' : (n.name ?? undefined),
        kind:
          n.id === startId
            ? ('start' as const)
            : n.id === endId
              ? ('end' as const)
              : ('poi' as const),
        color:
          n.id === startId
            ? colors.success
            : n.id === endId
              ? colors.danger
              : onRoute.has(n.id)
                ? colors.primary
                : colors.surface,
        // Seçilmemiş düğümler zeminle karışmasın diye belirgin çerçeve alır
        stroke:
          n.id === startId || n.id === endId || onRoute.has(n.id)
            ? colors.textInverse
            : colors.borderStrong,
      }));
  }, [graph, routeNodeIds, startId, endId, colors]);

  // Rota varsa kamera rotayı çerçeveler; yoksa tüm patika ağı görünür.
  const bounds = useMemo(
    () => (route.length >= 2 ? boundsOfPoints(route) : graphBounds(graph)),
    [route, graph],
  );

  return (
    <MapView
      height={height}
      source={resolved.source}
      availableLayers={resolved.availableLayers}
      slopeShading={slopeShading}
      center={graphCenter}
      zoom={12}
      bounds={bounds}
      route={route}
      markers={markers}
      sourceLabel={t(`maps.mapSource.${resolved.kind}`)}
      accessibilityLabel={t('maps.mapOf', { name: graph.regionId })}
      testID="trail-map"
      onMarkerPress={
        onNodePress
          ? (id) => {
              const node = nodeById.get(id);
              if (node) onNodePress(node);
            }
          : undefined
      }
      onPress={
        onNodePress
          ? (point) => {
              const node = nearestNode(graph, point);
              if (node) onNodePress(node);
            }
          : undefined
      }
      fallback={
        <RouteMap
          graph={graph}
          routeNodeIds={routeNodeIds}
          startId={startId}
          endId={endId}
          onNodePress={onNodePress}
          height={height}
          showLabels={showLabels}
        />
      }
    />
  );
}
