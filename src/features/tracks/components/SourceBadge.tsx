import React from 'react';

import { Badge } from '@/components/ui';
import { useT } from '@/core/i18n';
import type { TrackSource } from '@/domain';

import { SOURCE_META } from './meta';

interface Props {
  source: TrackSource;
}

/** Parça kaynağı rozeti (Kayıt / GPX / Strava / Komoot …) */
export function SourceBadge({ source }: Props) {
  const { t } = useT();
  const meta = SOURCE_META[source];
  return <Badge label={t(`tracks.source.${source}`)} color={meta.color} icon={meta.icon} soft />;
}
