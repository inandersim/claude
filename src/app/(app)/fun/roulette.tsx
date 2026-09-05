import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Button, Card, Chip, Icon, Screen, Header, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT, type TranslationKey } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPES,
  ADVENTURE_TYPE_META,
  formatDistance,
  type AdventureType,
  type RouletteSuggestion,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { RouletteWheel } from '@/features/fun/components/RouletteWheel';
import { useRoulette } from '@/features/fun/hooks';

export default function RouletteScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const { coords } = useLocation(me.coords);
  const { width } = useWindowDimensions();
  const spin = useRoulette();

  const [prefs, setPrefs] = useState<AdventureType[]>(() => me.favoriteTypes.slice(0, 3));
  const [suggestion, setSuggestion] = useState<RouletteSuggestion | null>(null);
  const [spinId, setSpinId] = useState(0);
  const [settled, setSettled] = useState(false);

  const wheelSize = Math.min(300, Math.min(width, layout.maxContentWidth) - spacing.lg * 2);
  const busy = spin.isPending || (suggestion !== null && !settled);

  const togglePref = (type: AdventureType) =>
    setPrefs((prev) => (prev.includes(type) ? prev.filter((p) => p !== type) : [...prev, type]));

  const handleSpin = () => {
    setSettled(false);
    setSuggestion(null);
    const seed = Date.now() + spinId;
    spin.mutate(
      { origin: coords, preferences: prefs, seed },
      {
        onSuccess: (s) => {
          setSuggestion(s);
          setSpinId((n) => n + 1);
        },
        onError: () => toast(t('fun.roulette.error'), 'error'),
      },
    );
  };

  const onSettled = useCallback(() => setSettled(true), []);

  const meta = suggestion ? ADVENTURE_TYPE_META[suggestion.adventureType] : null;
  const distanceLabel =
    suggestion?.distanceKm !== null && suggestion?.distanceKm !== undefined
      ? formatDistance(suggestion.distanceKm, locale)
      : null;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('fun.roulette.title')} subtitle={t('fun.roulette.subtitle')} showBack />
      <View style={styles.content}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color="textMuted">
            {t('fun.roulette.preferences').toLocaleUpperCase('tr-TR')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={{ marginHorizontal: -spacing.lg }}
          >
            {ADVENTURE_TYPES.map((type) => (
              <Chip
                key={type}
                label={t(ADVENTURE_TYPE_META[type].labelKey)}
                icon={ADVENTURE_TYPE_META[type].icon}
                color={ADVENTURE_TYPE_META[type].color}
                selected={prefs.includes(type)}
                onPress={() => togglePref(type)}
                size="sm"
              />
            ))}
          </ScrollView>
          <Text variant="caption" color="textSubtle">
            {t('fun.roulette.preferencesHint')}
          </Text>
        </View>

        <View style={styles.wheelWrap}>
          <RouletteWheel
            size={wheelSize}
            target={suggestion?.adventureType ?? null}
            spinId={spinId}
            onSettled={onSettled}
          />
        </View>

        <Button
          label={
            busy
              ? t('fun.roulette.spinning')
              : suggestion
                ? t('fun.roulette.spinAgain')
                : t('fun.roulette.spin')
          }
          icon="refresh-cw"
          size="lg"
          onPress={handleSpin}
          disabled={busy}
          loading={spin.isPending}
          fullWidth
        />

        {suggestion && settled && meta ? (
          <Animated.View entering={FadeInUp.duration(320)}>
            <Card elevated style={[styles.result, { borderColor: meta.color }]}>
              <View style={styles.resultHead}>
                <View style={[styles.resultIcon, { backgroundColor: meta.softColor }]}>
                  <Icon name={meta.icon} size={22} color={meta.color} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="label" color="textMuted">
                    {t('fun.roulette.result').toLocaleUpperCase('tr-TR')}
                  </Text>
                  <Text variant="h3" numberOfLines={2}>
                    {suggestion.placeName}
                  </Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <View style={[styles.pill, { backgroundColor: meta.softColor }]}>
                  <Text variant="label" color={meta.color}>
                    {t(meta.labelKey)}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
                  <Icon name="map-pin" size={12} color={colors.textMuted} />
                  <Text variant="label" color="textMuted">
                    {distanceLabel
                      ? t('fun.roulette.distance', { distance: distanceLabel })
                      : t('fun.roulette.unknownDistance')}
                  </Text>
                </View>
              </View>
              <Text variant="body">
                {t(suggestion.reason as TranslationKey, {
                  name: suggestion.placeName,
                  distance: distanceLabel ?? '',
                  type: t(meta.labelKey).toLocaleLowerCase('tr-TR'),
                })}
              </Text>
              {suggestion.placeId ? (
                <Button
                  label={t('fun.roulette.openInLibrary')}
                  icon="book-open"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/library/[id]', params: { id: suggestion.placeId! } })
                  }
                  fullWidth
                />
              ) : null}
            </Card>
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  wheelWrap: { alignItems: 'center' },
  result: { gap: spacing.md, borderWidth: 1.5 },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
