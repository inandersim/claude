import { useId, useMemo, useState } from 'react';

import type { TimePoint } from '../data/adminApi';

/**
 * Panelin grafikleri harici kütüphane olmadan, doğrudan SVG ile çizilir.
 * Renkler tema token'larından gelir; her grafik ayrıca metin özet (tablo)
 * ile erişilebilir kılınır.
 */

const W = 760;
const H = 220;
const PAD = { top: 14, right: 12, bottom: 26, left: 46 };

export interface Series {
  name: string;
  color: string;
  points: TimePoint[];
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(value * 100) / 100);
}

function shortDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}.${month}`;
}

export function LineChart({
  series,
  height = H,
  label,
  area = true,
}: {
  series: Series[];
  height?: number;
  label: string;
  area?: boolean;
}) {
  const gradientId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);

  const count = series[0]?.points.length ?? 0;
  const max = useMemo(
    () => niceMax(Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value)))),
    [series],
  );

  if (count === 0) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (count === 1 ? innerW / 2 : (index / (count - 1)) * innerW);
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: max * ratio,
    y: PAD.top + innerH - ratio * innerH,
  }));

  const labelStep = Math.max(1, Math.round(count / 7));

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={label}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`${gradientId}-${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--c-chart-grid)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={PAD.left - 8} y={tick.y + 4} textAnchor="end" fontSize={10} fill="var(--c-text-subtle)">
              {formatNumber(tick.value)}
            </text>
          </g>
        ))}

        {series.map((s, seriesIndex) => {
          const line = s.points.map((point, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(point.value)}`).join(' ');
          const fill = `${line} L${x(count - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;
          return (
            <g key={s.name}>
              {area ? <path d={fill} fill={`url(#${gradientId}-${seriesIndex})`} /> : null}
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}

        {series[0]?.points.map((point, i) =>
          // Son etiket bir öncekiyle çakışacaksa atlanır
          (i % labelStep === 0 && i <= count - 1 - Math.ceil(labelStep / 2)) || i === count - 1 ? (
            <text
              key={point.date}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--c-text-subtle)"
            >
              {shortDate(point.date)}
            </text>
          ) : null,
        )}

        {hover !== null ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--c-border-strong)"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.points[hover]?.value ?? 0)} r={3.5} fill={s.color} />
            ))}
          </g>
        ) : null}

        {series[0]?.points.map((point, i) => (
          <rect
            key={`hit-${point.date}`}
            x={x(i) - innerW / count / 2}
            y={PAD.top}
            width={innerW / count}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      <figcaption className="small muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <span key={s.name} className="row-tight">
            <span
              aria-hidden="true"
              style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }}
            />
            {s.name}
            {hover !== null ? (
              <strong>
                {' '}
                {formatNumber(s.points[hover]?.value ?? 0)} · {s.points[hover]?.date}
              </strong>
            ) : null}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function BarChart({
  data,
  color = 'var(--c-primary)',
  label,
  height = 200,
  formatValue,
}: {
  data: { label: string; value: number }[];
  color?: string;
  label: string;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const innerH = height - 34;
  const barW = data.length ? (W - PAD.left) / data.length : 0;
  const fmt = formatValue ?? formatNumber;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label={label} preserveAspectRatio="none">
        {data.map((item, i) => {
          const barHeight = (item.value / max) * innerH;
          const x = PAD.left + i * barW + barW * 0.16;
          const width = barW * 0.68;
          return (
            <g key={item.label}>
              <title>{`${item.label}: ${fmt(item.value)}`}</title>
              <rect x={x} y={14 + innerH - barHeight} width={width} height={Math.max(2, barHeight)} rx={5} fill={color} />
              <text x={x + width / 2} y={height - 16} textAnchor="middle" fontSize={10} fill="var(--c-text-subtle)">
                {item.label.length > 12 ? `${item.label.slice(0, 11)}…` : item.label}
              </text>
              <text x={x + width / 2} y={8 + innerH - barHeight} textAnchor="middle" fontSize={10} fill="var(--c-text-muted)">
                {fmt(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function DonutChart({
  data,
  label,
  size = 168,
}: {
  data: { label: string; value: number; color: string }[];
  label: string;
  size?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="row" style={{ gap: 18 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((item) => {
            const fraction = item.value / total;
            const dash = fraction * circumference;
            const element = (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={18}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${item.label}: ${item.value}`}</title>
              </circle>
            );
            offset += dash;
            return element;
          })}
        </g>
        <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={18} fontWeight={800} fill="var(--c-text)">
          {total}
        </text>
      </svg>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((item) => (
          <li key={item.label} className="row-tight small">
            <span
              aria-hidden="true"
              style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: 'inline-block' }}
            />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <span className="muted">%{((item.value / total) * 100).toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ points, color = 'var(--c-primary)', label }: { points: number[]; color?: string; label: string }) {
  const max = Math.max(1, ...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const d = points
    .map((value, i) => `${i === 0 ? 'M' : 'L'}${(i / Math.max(1, points.length - 1)) * 100},${28 - ((value - min) / span) * 24}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 30" width="100%" height={30} role="img" aria-label={label} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
