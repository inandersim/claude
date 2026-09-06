import type { IconName } from '@/components/ui';
import type { TranslationKey } from '@/core/i18n';
import type { Palette } from '@/core/theme';
import type {
  AmsSeverity,
  DestinationStage,
  DestinationType,
  StageKind,
  TransportMode,
} from '@/domain';

/** Etap türü → ikon (yalnızca mevcut Icon kayıtları). */
export const STAGE_KIND_ICON: Record<StageKind, IconName> = {
  trailhead: 'flag',
  village: 'house',
  teahouse: 'store',
  camp: 'tent',
  hut: 'house',
  base_camp: 'tent',
  pass: 'mountain',
  summit: 'mountain-snow',
  viewpoint: 'eye',
};

/** Ulaşım modu → ikon. */
export const TRANSPORT_ICON: Record<TransportMode, IconName> = {
  flight: 'navigation',
  bus: 'route',
  jeep: 'compass',
  train: 'milestone',
  ferry: 'ship',
  trek: 'footprints',
  taxi: 'map-pin',
};

/** Bağlantı → ikon. */
export const CONNECTIVITY_ICON: Record<DestinationStage['connectivity'], IconName> = {
  none: 'wifi-off',
  sat_only: 'satellite',
  '2g': 'signal',
  '4g': 'signal',
  wifi: 'wifi',
};

/** Destinasyon türü → ikon. */
export const DESTINATION_TYPE_ICON: Record<DestinationType, IconName> = {
  trek: 'footprints',
  expedition: 'mountain-snow',
  climbing_area: 'mountain',
  dive_region: 'waves-arrow-up',
  ski_region: 'snowflake',
  multi_sport: 'sparkles',
};

/** AMS şiddeti → tema rengi. */
export function amsSeverityColor(severity: AmsSeverity, colors: Palette): string {
  switch (severity) {
    case 'none':
      return colors.success;
    case 'mild':
      return colors.info;
    case 'moderate':
      return colors.warning;
    case 'severe':
      return colors.danger;
  }
}

/** AMS şiddeti → yumuşak arka plan. */
export function amsSeveritySoft(severity: AmsSeverity, colors: Palette): string {
  switch (severity) {
    case 'none':
      return colors.successSoft;
    case 'mild':
      return colors.infoSoft;
    case 'moderate':
      return colors.warningSoft;
    case 'severe':
      return colors.dangerSoft;
  }
}

const COUNTRY_KEYS: Record<string, TranslationKey> = {
  NP: 'destinations.countries.NP',
  TZ: 'destinations.countries.TZ',
  CL: 'destinations.countries.CL',
  PE: 'destinations.countries.PE',
  FR: 'destinations.countries.FR',
  CH: 'destinations.countries.CH',
  IT: 'destinations.countries.IT',
  AR: 'destinations.countries.AR',
  RU: 'destinations.countries.RU',
  TR: 'destinations.countries.TR',
  MA: 'destinations.countries.MA',
};

/** Ülke kodu → çeviri anahtarı (bilinmeyen kod için null; ekran kodu gösterir). */
export function countryLabelKey(countryCode: string): TranslationKey | null {
  return COUNTRY_KEYS[countryCode.toUpperCase()] ?? null;
}
