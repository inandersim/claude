import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, IconButton, Screen, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import type { AiAction, VisionAdvice, VisionSituation } from '@/domain';
import { imageSizeGuard, situationPrompt, visionQuickQuestions } from '@/domain';
import { TypingDots } from '@/features/ai/components/TypingDots';
import { useCurrentUser } from '@/features/auth/session.store';
import { AdviceCard } from '@/features/vision/components/AdviceCard';
import { CameraOverlay } from '@/features/vision/components/CameraOverlay';
import { SituationChips } from '@/features/vision/components/SituationChips';
import { useCameraFrame, useVisionAnalyze, type CameraFrame } from '@/features/vision/hooks';

const IS_WEB = Platform.OS === 'web';

/**
 * Kamera ile AI tavsiye (tam ekran modal): kamera → çekim → önizleme → analiz → tavsiye kartı.
 * Web'de kamera yerine galeri/dosya seçici kullanılır.
 */
export default function VisionScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const me = useCurrentUser();
  const { coords, isFallback } = useLocation(me.coords);
  const [permission, requestPermission] = useCameraPermissions();
  const { cameraRef, markReady, isReady, isCapturing, capture, pickFromLibrary } = useCameraFrame();
  const analyze = useVisionAnalyze();

  const [situation, setSituation] = useState<VisionSituation>('terrain');
  const [question, setQuestion] = useState('');
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [photo, setPhoto] = useState<CameraFrame | null>(null);
  const [advice, setAdvice] = useState<VisionAdvice | null>(null);

  const quickQuestions = visionQuickQuestions(situation, locale);

  const close = () => goBack(router, '/');

  const onCapture = async () => {
    const frame = await capture();
    if (!frame) {
      toast(t('vision.captureError'), 'error');
      return;
    }
    setPhoto(frame);
  };

  const onPick = async () => {
    const frame = await pickFromLibrary();
    if (frame) setPhoto(frame);
  };

  const onAnalyze = () => {
    if (!photo) {
      toast(t('vision.noImage'), 'error');
      return;
    }
    const guard = imageSizeGuard(photo.base64);
    if (guard.needsResize) toast(t('vision.tooLarge'), 'info');
    analyze.mutate(
      {
        imageUri: photo.uri,
        // Sınırı aşan görüntü gateway'e gönderilmez; yerel kontrol listesi üretilir
        imageBase64: guard.ok ? photo.base64 : null,
        situation,
        question: question.trim(),
        coords: isFallback ? null : coords,
        altitudeM: null,
        locale,
      },
      {
        onSuccess: setAdvice,
        onError: () => toast(t('vision.analyzeError'), 'error'),
      },
    );
  };

  const retake = () => {
    setPhoto(null);
    setAdvice(null);
    analyze.reset();
  };

  const continueInChat = () => {
    const summary = advice
      ? [question.trim() || situationPrompt(situation, locale), ...advice.observations.slice(0, 2)]
          .filter(Boolean)
          .join(' ')
      : question.trim() || situationPrompt(situation, locale);
    router.push({
      pathname: '/assistant/[threadId]',
      params: { threadId: 'new', initial: summary },
    });
  };

  const openHistory = () => router.push('/assistant/vision-history');
  const onAction = (action: AiAction) => router.push(action.href as Href);

  /* ------------------------------ Önizleme + sonuç ------------------------------ */

  if (photo) {
    const busy = analyze.isPending;
    return (
      <Screen edges={['top', 'bottom']}>
        <StatusBar style="auto" />
        <View style={styles.previewTop}>
          <IconButton
            icon="x"
            variant="ghost"
            onPress={close}
            accessibilityLabel={t('vision.close')}
          />
          <Text variant="title">{advice ? t('vision.title') : t('vision.preview')}</Text>
          <IconButton
            icon="clock"
            variant="ghost"
            onPress={openHistory}
            accessibilityLabel={t('vision.history')}
          />
        </View>
        <ScrollView
          contentContainerStyle={styles.previewContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.imageWrap, { backgroundColor: colors.surfaceMuted }]}>
            <Image
              source={{ uri: photo.uri }}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={t('vision.preview')}
              accessibilityIgnoresInvertColors
            />
          </View>

          {!advice ? (
            <>
              <SituationChips value={situation} onChange={setSituation} disabled={busy} />
              {question ? (
                <Text variant="bodySm" color="textMuted" style={styles.question}>
                  “{question}”
                </Text>
              ) : null}
            </>
          ) : null}

          {busy ? (
            <View style={styles.loading}>
              <TypingDots label={t('vision.analyzing')} />
              <Text variant="caption" color="textMuted" align="center">
                {t('vision.analyzing')}
              </Text>
            </View>
          ) : null}

          {advice ? (
            <View style={styles.result}>
              <AdviceCard advice={advice} onAction={onAction} />
            </View>
          ) : null}

          <View style={styles.actions}>
            {!advice ? (
              <Button
                label={t('vision.analyze')}
                icon="sparkles"
                onPress={onAnalyze}
                loading={busy}
                disabled={busy}
                fullWidth
                size="lg"
              />
            ) : (
              <Button
                label={t('vision.continueInChat')}
                icon="message-circle"
                onPress={continueInChat}
                fullWidth
                size="lg"
              />
            )}
            <View style={styles.actionRow}>
              <Button
                label={t('vision.retake')}
                icon="refresh-cw"
                variant="secondary"
                onPress={retake}
                disabled={busy}
                style={styles.flex}
              />
              <Button
                label={t('vision.history')}
                icon="clock"
                variant="ghost"
                onPress={openHistory}
                style={styles.flex}
              />
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  /* ------------------------------ Web / izin yok ------------------------------ */

  const granted = Boolean(permission?.granted);
  if (IS_WEB || !granted) {
    const canAsk = !IS_WEB && permission !== null && !granted && permission.canAskAgain;
    return (
      <Screen edges={['top', 'bottom']}>
        <StatusBar style="auto" />
        <View style={styles.previewTop}>
          <IconButton
            icon="x"
            variant="ghost"
            onPress={close}
            accessibilityLabel={t('vision.close')}
          />
          <Text variant="title">{t('vision.title')}</Text>
          <IconButton
            icon="clock"
            variant="ghost"
            onPress={openHistory}
            accessibilityLabel={t('vision.history')}
          />
        </View>
        <ScrollView
          contentContainerStyle={styles.fallbackContent}
          keyboardShouldPersistTaps="handled"
        >
          <EmptyState
            icon={IS_WEB ? 'image-plus' : 'camera-off'}
            title={IS_WEB ? t('vision.title') : t('vision.permission.title')}
            description={
              IS_WEB
                ? t('vision.webNote')
                : permission === null
                  ? t('vision.permission.body')
                  : canAsk
                    ? t('vision.permission.body')
                    : t('vision.permission.denied')
            }
            action={
              canAsk
                ? {
                    label: t('vision.permission.grant'),
                    icon: 'camera',
                    onPress: () => void requestPermission(),
                  }
                : {
                    label: t('vision.permission.gallery'),
                    icon: 'image',
                    onPress: () => void onPick(),
                  }
            }
            compact
          />
          {canAsk ? (
            <Button
              label={t('vision.permission.gallery')}
              icon="image"
              variant="secondary"
              onPress={() => void onPick()}
              loading={isCapturing}
              style={styles.center}
            />
          ) : null}
          <View style={styles.fallbackChips}>
            <Text variant="label" color="textMuted" style={styles.chipsLabel}>
              {t('vision.situationTitle').toLocaleUpperCase(locale)}
            </Text>
            <SituationChips value={situation} onChange={setSituation} size="md" />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  /* ------------------------------ Kamera ------------------------------ */

  const topBar = (
    <View style={styles.topBar}>
      <IconButton
        icon="x"
        variant="blur"
        color="#FFFFFF"
        onPress={close}
        accessibilityLabel={t('vision.close')}
      />
      <View style={styles.topRight}>
        <IconButton
          icon="zap"
          variant="blur"
          color={flash === 'off' ? 'rgba(255,255,255,0.6)' : colors.warning}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
          accessibilityLabel={flash === 'off' ? t('vision.flashOff') : t('vision.flashOn')}
        />
        <IconButton
          icon="switch-camera"
          variant="blur"
          color="#FFFFFF"
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          accessibilityLabel={t('vision.flip')}
        />
        <IconButton
          icon="clock"
          variant="blur"
          color="#FFFFFF"
          onPress={openHistory}
          accessibilityLabel={t('vision.history')}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.cameraRoot}>
      <StatusBar style="light" />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        mode="picture"
        onCameraReady={markReady}
        accessibilityLabel={t('vision.title')}
      />
      <CameraOverlay
        situation={situation}
        onSituationChange={setSituation}
        question={question}
        onQuestionChange={setQuestion}
        quickQuestions={quickQuestions}
        onCapture={() => void onCapture()}
        onPickFromLibrary={() => void onPick()}
        capturing={isCapturing}
        ready={isReady}
        topBar={topBar}
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
  cameraRoot: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  previewContent: { paddingBottom: spacing.xxxl, gap: spacing.md },
  imageWrap: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
  },
  image: { width: '100%', height: '100%' },
  question: { paddingHorizontal: spacing.lg },
  loading: { gap: spacing.sm, paddingVertical: spacing.md },
  result: { paddingHorizontal: spacing.lg },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  fallbackContent: { paddingBottom: spacing.xxxl, gap: spacing.md },
  fallbackChips: { gap: spacing.sm },
  chipsLabel: { paddingHorizontal: spacing.lg },
});
