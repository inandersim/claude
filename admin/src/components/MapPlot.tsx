import type { GeoPoint } from '@/domain';

export interface MapMarker {
  id: string;
  coords: GeoPoint;
  label: string;
  tone: 'danger' | 'warning' | 'success' | 'info';
  selected?: boolean;
}

const TONE_COLORS: Record<MapMarker['tone'], string> = {
  danger: 'var(--c-danger)',
  warning: 'var(--c-warning)',
  success: 'var(--c-success)',
  info: 'var(--c-info)',
};

/**
 * Basit eşdikdörtgen (equirectangular) izdüşümlü harita.
 * Harici harita kütüphanesi kullanılmaz; noktalar enlem/boylam kutusuna göre
 * ölçeklenir, ızgara ve koordinat etiketleri çizilir.
 */
export function MapPlot({
  markers,
  height = 300,
  onSelect,
  label,
}: {
  markers: MapMarker[];
  height?: number;
  onSelect?: (id: string) => void;
  label: string;
}) {
  const width = 760;
  const pad = 26;

  if (markers.length === 0) {
    return <div className="empty">{label}</div>;
  }

  const lats = markers.map((m) => m.coords.latitude);
  const lons = markers.map((m) => m.coords.longitude);
  const minLat = Math.min(...lats) - 0.8;
  const maxLat = Math.max(...lats) + 0.8;
  const minLon = Math.min(...lons) - 0.8;
  const maxLon = Math.max(...lons) + 0.8;

  const x = (lon: number) => pad + ((lon - minLon) / (maxLon - minLon || 1)) * (width - pad * 2);
  const y = (lat: number) => pad + ((maxLat - lat) / (maxLat - minLat || 1)) * (height - pad * 2);

  const gridLons = Array.from({ length: 6 }, (_, i) => minLon + ((maxLon - minLon) * i) / 5);
  const gridLats = Array.from({ length: 5 }, (_, i) => minLat + ((maxLat - minLat) * i) / 4);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={label}>
      <rect x={0} y={0} width={width} height={height} fill="var(--c-surface-muted)" rx={12} />
      {gridLons.map((lon) => (
        <g key={`lon-${lon}`}>
          <line x1={x(lon)} x2={x(lon)} y1={pad} y2={height - pad} stroke="var(--c-chart-grid)" strokeWidth={1} />
          <text x={x(lon)} y={height - 8} fontSize={9} textAnchor="middle" fill="var(--c-text-subtle)">
            {lon.toFixed(1)}°D
          </text>
        </g>
      ))}
      {gridLats.map((lat) => (
        <g key={`lat-${lat}`}>
          <line x1={pad} x2={width - pad} y1={y(lat)} y2={y(lat)} stroke="var(--c-chart-grid)" strokeWidth={1} />
          <text x={4} y={y(lat) + 3} fontSize={9} fill="var(--c-text-subtle)">
            {lat.toFixed(1)}°K
          </text>
        </g>
      ))}
      {markers.map((marker) => (
        <g
          key={marker.id}
          onClick={onSelect ? () => onSelect(marker.id) : undefined}
          style={{ cursor: onSelect ? 'pointer' : 'default' }}
        >
          <title>{marker.label}</title>
          {marker.tone === 'danger' ? (
            <circle cx={x(marker.coords.longitude)} cy={y(marker.coords.latitude)} r={14} fill={TONE_COLORS.danger} opacity={0.18} />
          ) : null}
          <circle
            cx={x(marker.coords.longitude)}
            cy={y(marker.coords.latitude)}
            r={marker.selected ? 9 : 6}
            fill={TONE_COLORS[marker.tone]}
            stroke="var(--c-surface)"
            strokeWidth={2}
          />
        </g>
      ))}
    </svg>
  );
}
