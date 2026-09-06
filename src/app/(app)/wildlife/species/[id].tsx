import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { getFirstAidGuide } from '@/data/content/firstAid';
import { COUNTRY_FLAG, dangerRank, encounterAdvice, groupEmoji } from '@/domain';
import { BehaviorList } from '@/features/wildlife/components/BehaviorList';
import { DangerBadge, dangerColor } from '@/features/wildlife/components/DangerBadge';
import { EncounterSteps } from '@/features/wildlife/components/EncounterSteps';
import { useSpeciesDetail } from '@/features/wildlife/hooks';

const MONTHS_TR = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];
const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Tür detayı: tanımlama, yap/yapma, ilk yardım, zehir, benzerleri, aktif aylar, kaynaklar. */
export default function SpeciesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const species = useSpeciesDetail(id);
  const s = species.data;
  const months = locale.startsWith('tr') ? MONTHS_TR : MONTHS_EN;

  if (species.isError)
    return (
      <Screen edges={['top', 'bottom']}>
        <Header showBack />
        <ErrorState onRetry={() => void species.refetch()} />
      </Screen>
    );

  if (species.isLoading || !s)
    return (
      <Screen scroll edges={['top', 'bottom']}>
        <Header showBack />
        {species.isLoading ? (
          <View style={styles.content}>
            <Skeleton height={220} style={styles.hero} />
            <Skeleton height={28} width="60%" />
            <Skeleton height={80} />
          </View>
        ) : (
          <EmptyState icon="search" title={t('wildlife.species.notFound')} />
        )}
      </Screen>
    );

  const guide = s.firstAidSlug ? getFirstAidGuide(locale, s.firstAidSlug) : null;
  const color = dangerColor(s.danger, colors);
  const rank = dangerRank(s.danger);
  const steps = encounterAdvice(s);

  const ask = () =>
    router.push({
      pathname: '/wildlife/ask',
      params: { speciesId: s.id, title: `${s.commonName} — ${t('wildlife.questions.ask')}` },
    });
  const doctor = () =>
    router.push(`/telemed/request?speciesId=${encodeURIComponent(s.id)}` as Href);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={s.commonName} subtitle={s.scientificName} showBack />
      <View style={styles.content}>
        <View style={[styles.hero, { backgroundColor: colors.surfaceMuted }]}>
          {s.imageUrl ? (
            <Image
              source={{ uri: s.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={s.commonName}
            />
          ) : (
            <Text style={styles.heroEmoji}>{groupEmoji(s.group)}</Text>
          )}
          <View style={styles.heroBadges}>
            <DangerBadge level={s.danger} solid />
            <Badge label={t(`wildlife.group.${s.group}`)} color={colors.surface} soft={false} />
          </View>
        </View>

        {rank >= 2 ? (
          <View style={[styles.alert, { backgroundColor: colors.dangerSoft, borderColor: color }]}>
            <Icon name="shield-alert" size={18} color={color} />
            <Text variant="bodySm" weight="bold" color={color} style={styles.flex}>
              {rank >= 3 ? t('wildlife.species.deadlyNote') : t('wildlife.species.dangerNote')}
            </Text>
          </View>
        ) : null}

        <Text variant="body">{s.description}</Text>

        <View style={styles.chips}>
          {s.countryCodes.map((c) => (
            <Chip key={c} label={`${COUNTRY_FLAG(c)} ${c}`} size="sm" />
          ))}
        </View>

        <SectionHeader title={t('wildlife.species.identification')} />
        <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {s.identification.map((item, i) => (
            <View key={i} style={styles.row}>
              <Icon name="eye" size={14} color={colors.primary} />
              <Text variant="bodySm" style={styles.flex}>
                {item}
              </Text>
            </View>
          ))}
        </View>

        <SectionHeader title={t('wildlife.species.steps')} />
        <EncounterSteps steps={steps} highlightFirst={rank >= 2} />

        <SectionHeader title={t('wildlife.species.encounter')} />
        <BehaviorList doList={s.encounterDo} dontList={s.encounterDont} />

        {guide ? (
          <Button
            label={t('wildlife.species.firstAidLink', { name: guide.title })}
            icon="heart-pulse"
            variant={rank >= 2 ? 'danger' : 'secondary'}
            onPress={() =>
              router.push({ pathname: '/first-aid/[slug]', params: { slug: guide.slug } })
            }
            fullWidth
          />
        ) : null}

        {s.venomNote ? (
          <>
            <SectionHeader title={t('wildlife.species.venom')} />
            <View
              style={[
                styles.box,
                { backgroundColor: colors.warningSoft, borderColor: colors.warning },
              ]}
            >
              <Text variant="bodySm">{s.venomNote}</Text>
            </View>
          </>
        ) : null}

        <SectionHeader
          title={t('wildlife.species.activeMonths')}
          subtitle={t(`wildlife.species.hours.${s.activeHours}`)}
        />
        <View style={styles.months}>
          {months.map((m, i) => {
            const active = s.activeMonths.includes(i + 1);
            return (
              <View
                key={m}
                style={[
                  styles.month,
                  {
                    backgroundColor: active ? color : colors.surfaceMuted,
                    borderColor: active ? color : colors.border,
                  },
                ]}
                accessibilityLabel={`${m}${active ? ' ✓' : ''}`}
              >
                <Text variant="caption" weight="bold" color={active ? '#FFFFFF' : colors.textMuted}>
                  {m}
                </Text>
              </View>
            );
          })}
        </View>

        <SectionHeader title={t('wildlife.species.habitats')} />
        <View style={styles.chips}>
          {s.habitats.map((h) => (
            <Chip key={h} label={h} size="sm" icon="map-pin" />
          ))}
        </View>

        {s.lookalikes.length > 0 ? (
          <>
            <SectionHeader title={t('wildlife.species.lookalikes')} />
            <View style={styles.chips}>
              {s.lookalikes.map((l) => (
                <Chip key={l} label={l} size="sm" />
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader title={t('wildlife.species.sources')} />
        {s.sources.map((src) => (
          <Text key={src} variant="caption" color="textMuted">
            • {src}
          </Text>
        ))}

        <View style={styles.actions}>
          <Button
            label={t('wildlife.species.sawIt')}
            icon="message-circle"
            onPress={ask}
            fullWidth
          />
          <Button
            label={t('wildlife.doctor')}
            icon="heart-pulse"
            variant="secondary"
            onPress={doctor}
            fullWidth
          />
          {rank >= 2 && s.group === 'mammal' ? (
            <Button
              label={t('wildlife.identify.panic')}
              icon="siren"
              variant="danger"
              onPress={() => router.push('/wildlife/deterrent')}
              fullWidth
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  flex: { flex: 1 },
  hero: {
    height: 220,
    borderRadius: radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 96 },
  heroBadges: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  box: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  month: {
    width: 46,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
