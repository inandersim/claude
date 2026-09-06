import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, ErrorState, Header, Icon, SectionHeader, Skeleton, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import type { DeterrentAnimal, DeterrentSound } from '@/domain';
import { animalEmoji, playPlan, soundMeta } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { BehaviorList } from '@/features/wildlife/components/BehaviorList';
import { DeterrentAnimalGrid } from '@/features/wildlife/components/DeterrentAnimalGrid';
import { PanicButton } from '@/features/wildlife/components/PanicButton';
import { SoundPicker } from '@/features/wildlife/components/SoundPicker';
import { useDeterrentPlayer, useDeterrents, useLogDeterrent } from '@/features/wildlife/hooks';

const IS_WEB = Platform.OS === 'web';

/**
 * Acil canlı tepkisi (tam ekran): hayvan seç → önerilen/alternatif ses → dev başlat/durdur
 * düğmesi (ses + titreşim + fener) → yap/yapma, uyarılar, kanıt notu, ilk yardım ve SOS bağlantıları.
 */
export default function DeterrentScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const { coords, isFallback } = useLocation(me.coords);
  const [permission, requestPermission] = useCameraPermissions();
  const deterrents = useDeterrents();
  const logDeterrent = useLogDeterrent();
  const player = useDeterrentPlayer();

  const [animal, setAnimal] = useState<DeterrentAnimal | null>(null);
  const [sound, setSound] = useState<DeterrentSound | null>(null);
  const [flashOn, setFlashOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);

  const profile = animal ? deterrents.data?.find((p) => p.animal === animal) : null;
  const plan = animal ? playPlan(animal) : null;
  const activeSound: DeterrentSound | null = sound ?? plan?.sound ?? null;
  const torchAllowed = !IS_WEB && Boolean(permission?.granted);

  const pickAnimal = (next: DeterrentAnimal) => {
    if (player.playing) stop();
    setAnimal(next);
    setSound(null);
    const nextPlan = playPlan(next);
    setFlashOn(nextPlan.flash);
    setVibrateOn(nextPlan.vibrate);
  };

  const stop = () => {
    const seconds = player.stop();
    if (animal && activeSound && seconds > 0) {
      logDeterrent.mutate(
        { animal, sound: activeSound, coords: isFallback ? null : coords, durationS: seconds },
        { onSuccess: () => toast(t('wildlife.panic.logged', { seconds }), 'info') },
      );
    }
  };

  const start = async () => {
    if (!animal || !activeSound) return;
    if (flashOn && !IS_WEB && !permission?.granted && permission?.canAskAgain !== false)
      await requestPermission().catch(() => undefined);
    await player.start(activeSound, { vibrate: vibrateOn, flash: flashOn });
    if (player.error) toast(t('wildlife.panic.playError'), 'error');
  };

  const toggle = () => {
    if (player.playing) stop();
    else void start();
  };

  const changeSound = (next: DeterrentSound) => {
    setSound(next);
    if (player.playing) void player.start(next, { vibrate: vibrateOn, flash: flashOn });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="auto" />
      {/* Fener için görünmez kamera: yalnızca izin varken ve fener seçiliyken bağlanır */}
      {torchAllowed && flashOn && player.playing ? (
        <CameraView style={styles.torchCamera} enableTorch={player.torch} facing="back" />
      ) : null}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Header
          title={t('wildlife.panic.title')}
          subtitle={t('wildlife.panic.subtitle')}
          showBack
          onBack={() => {
            if (player.playing) stop();
            goBack(router, '/');
          }}
        />

        <View style={styles.content}>
          <SectionHeader title={t('wildlife.panic.pickAnimal')} />
          {deterrents.isError ? (
            <ErrorState onRetry={() => void deterrents.refetch()} />
          ) : deterrents.isLoading ? (
            <Skeleton height={300} style={styles.skeleton} />
          ) : (
            <DeterrentAnimalGrid value={animal} onChange={pickAnimal} />
          )}

          {profile && plan && activeSound ? (
            <>
              <View
                style={[
                  styles.planBox,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={styles.planEmoji}>{animalEmoji(profile.animal)}</Text>
                <View style={styles.flex}>
                  <Text variant="caption" color="textMuted">
                    {t('wildlife.panic.recommended')}
                  </Text>
                  <Text variant="title">
                    {t(soundMeta(plan.sound).labelKey)} ·{' '}
                    {t('wildlife.panic.duration', { seconds: plan.durationS })} ×{plan.repeat}
                  </Text>
                  <Text
                    variant="caption"
                    color={plan.animal === 'snake' ? colors.warning : 'textMuted'}
                  >
                    {t(plan.noteKey)}
                  </Text>
                </View>
              </View>

              <PanicButton
                active={player.playing}
                onPress={toggle}
                label={
                  player.playing
                    ? `${t('wildlife.panic.playing')}: ${t(soundMeta(activeSound).labelKey)}`
                    : undefined
                }
              />

              <View style={styles.toggles}>
                <Button
                  label={t('wildlife.panic.vibrate')}
                  icon="activity"
                  size="sm"
                  variant={vibrateOn ? 'primary' : 'secondary'}
                  disabled={IS_WEB}
                  onPress={() => setVibrateOn((v) => !v)}
                  style={styles.flex}
                />
                <Button
                  label={t('wildlife.panic.flash')}
                  icon="zap"
                  size="sm"
                  variant={flashOn ? 'primary' : 'secondary'}
                  disabled={IS_WEB}
                  onPress={() => setFlashOn((v) => !v)}
                  style={styles.flex}
                />
              </View>
              <Text variant="caption" color="textMuted" align="center">
                {IS_WEB ? t('wildlife.panic.webNote') : t('wildlife.panic.volumeHint')}
              </Text>

              <SectionHeader title={t('wildlife.panic.alternatives')} />
            </>
          ) : null}
        </View>

        {profile ? (
          <View style={styles.pickerWrap}>
            <SoundPicker
              sounds={profile.sounds}
              value={activeSound ?? profile.sounds[0]!.sound}
              onChange={changeSound}
            />
          </View>
        ) : null}

        {profile ? (
          <View style={styles.content}>
            <SectionHeader title={t('wildlife.panic.behaviorTitle')} />
            <BehaviorList doList={profile.behaviorDo} dontList={profile.behaviorDont} />

            <SectionHeader title={t('wildlife.behavior.warnings')} />
            <View
              style={[
                styles.warnBox,
                { backgroundColor: colors.warningSoft, borderColor: colors.warning },
              ]}
            >
              {profile.warnings.map((w, i) => (
                <View key={i} style={styles.warnRow}>
                  <Icon name="triangle-alert" size={14} color={colors.warning} />
                  <Text variant="bodySm" style={styles.flex}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.evidence, { backgroundColor: colors.surfaceMuted }]}>
              <Icon name="info" size={14} color={colors.textMuted} />
              <Text variant="caption" color="textMuted" style={styles.flex}>
                {t('wildlife.evidence')}
              </Text>
            </View>

            <Text variant="label" color="textMuted">
              {t('wildlife.panic.sosHint').toUpperCase()}
            </Text>
            <View style={styles.links}>
              <Button
                label={t('wildlife.firstAid')}
                icon="heart-pulse"
                variant="secondary"
                onPress={() => router.push('/first-aid')}
                style={styles.flex}
              />
              <Button
                label={t('wildlife.sos')}
                icon="satellite"
                variant="danger"
                onPress={() => router.push('/satellite/sos')}
                style={styles.flex}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: spacing.huge },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  flex: { flex: 1 },
  torchCamera: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  skeleton: { borderRadius: radius.lg },
  planBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  planEmoji: { fontSize: 40 },
  toggles: { flexDirection: 'row', gap: spacing.sm },
  pickerWrap: { paddingVertical: spacing.sm },
  warnBox: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  evidence: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  links: { flexDirection: 'row', gap: spacing.sm },
});
