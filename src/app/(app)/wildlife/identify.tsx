import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, IconButton, Input, Screen, Tappable, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import type { SpeciesIdentification } from '@/domain';
import { imageSizeGuard } from '@/domain';
import { TypingDots } from '@/features/ai/components/TypingDots';
import { useCurrentUser } from '@/features/auth/session.store';
import { useCameraFrame, type CameraFrame } from '@/features/vision/hooks';
import { IdentificationResult } from '@/features/wildlife/components/IdentificationResult';
import { useIdentifySpecies } from '@/features/wildlife/hooks';

const IS_WEB = Platform.OS === 'web';

/**
 * Fotoğrafla tanı (tam ekran): kamera/galeri → açıklama → analiz → aday listesi.
 * Web'de ve izin yokken galeri + açıklama ile çalışır; açıklama tek başına da yeterlidir.
 */
export default function IdentifyScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const me = useCurrentUser();
  const { coords, isFallback } = useLocation(me.coords);
  const [permission, requestPermission] = useCameraPermissions();
  const { cameraRef, markReady, isReady, isCapturing, capture, pickFromLibrary } = useCameraFrame();
  const identify = useIdentifySpecies();

  const [description, setDescription] = useState('');
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [photo, setPhoto] = useState<CameraFrame | null>(null);
  const [result, setResult] = useState<SpeciesIdentification | null>(null);
  /** Kamera atlanıp yalnızca açıklama ile devam edildi */
  const [textOnly, setTextOnly] = useState(false);

  const close = () => goBack(router, '/');

  const onCapture = async () => {
    const frame = await capture();
    if (!frame) {
      toast(t('wildlife.identify.captureError'), 'error');
      return;
    }
    setPhoto(frame);
  };

  const onPick = async () => {
    const frame = await pickFromLibrary();
    if (frame) setPhoto(frame);
  };

  const onAnalyze = () => {
    if (!photo && !description.trim()) {
      toast(t('wildlife.identify.noInput'), 'error');
      return;
    }
    const guard = photo ? imageSizeGuard(photo.base64) : null;
    identify.mutate(
      {
        imageUri: photo?.uri ?? null,
        imageBase64: guard?.ok ? (photo?.base64 ?? null) : null,
        description: description.trim(),
        coords: isFallback ? null : coords,
        locale,
      },
      {
        onSuccess: setResult,
        onError: () => toast(t('wildlife.identify.error'), 'error'),
      },
    );
  };

  const reset = () => {
    setPhoto(null);
    setResult(null);
    setTextOnly(false);
    identify.reset();
  };

  const openSpecies = (id: string) =>
    router.push({ pathname: '/wildlife/species/[id]', params: { id } });
  const askCommunity = () => {
    const top = result?.candidates[0];
    router.push({
      pathname: '/wildlife/ask',
      params: {
        speciesId: top?.speciesId ?? '',
        title: description.trim() ? description.trim().slice(0, 60) : '',
        body: description.trim(),
        imageUrl: photo?.uri ?? '',
      },
    });
  };
  const openPanic = () => router.push('/wildlife/deterrent');
  const openDoctor = () => {
    const top = result?.candidates.find((c) => c.speciesId);
    router.push(
      `/telemed/request${top?.speciesId ? `?speciesId=${encodeURIComponent(top.speciesId)}` : ''}` as Href,
    );
  };

  const topBar = (light: boolean) => (
    <View style={styles.topBar}>
      <IconButton
        icon="x"
        variant={light ? 'blur' : 'ghost'}
        color={light ? '#FFFFFF' : undefined}
        onPress={close}
        accessibilityLabel={t('wildlife.identify.close')}
      />
      <Text variant="title" color={light ? '#FFFFFF' : undefined}>
        {t('wildlife.identify.title')}
      </Text>
      <View style={styles.topRight}>
        {light ? (
          <>
            <IconButton
              icon="zap"
              variant="blur"
              color={flash === 'off' ? 'rgba(255,255,255,0.6)' : colors.warning}
              onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
              accessibilityLabel={
                flash === 'off' ? t('wildlife.identify.flashOff') : t('wildlife.identify.flashOn')
              }
            />
            <IconButton
              icon="switch-camera"
              variant="blur"
              color="#FFFFFF"
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              accessibilityLabel={t('wildlife.identify.flip')}
            />
          </>
        ) : (
          <View style={styles.topSpacer} />
        )}
      </View>
    </View>
  );

  /* ------------------------------ Önizleme / sonuç ------------------------------ */

  const granted = Boolean(permission?.granted);
  const showForm = photo !== null || textOnly || IS_WEB || !granted;

  if (showForm) {
    const busy = identify.isPending;
    const canAsk = !IS_WEB && permission !== null && !granted && permission.canAskAgain;
    return (
      <Screen edges={['top', 'bottom']}>
        <StatusBar style="auto" />
        {topBar(false)}
        <ScrollView
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {photo ? (
            <View style={[styles.imageWrap, { backgroundColor: colors.surfaceMuted }]}>
              <Image
                source={{ uri: photo.uri }}
                style={styles.image}
                resizeMode="cover"
                accessibilityLabel={t('wildlife.identify.title')}
                accessibilityIgnoresInvertColors
              />
            </View>
          ) : (
            <EmptyState
              icon={IS_WEB || !granted ? 'image-plus' : 'camera'}
              title={
                granted || IS_WEB
                  ? t('wildlife.identify.title')
                  : t('wildlife.identify.permissionTitle')
              }
              description={
                IS_WEB
                  ? t('wildlife.identify.webNote')
                  : granted
                    ? t('wildlife.identify.subtitle')
                    : t('wildlife.identify.permissionBody')
              }
              action={
                canAsk
                  ? {
                      label: t('wildlife.identify.permissionGrant'),
                      icon: 'camera',
                      onPress: () => void requestPermission(),
                    }
                  : {
                      label: t('wildlife.identify.gallery'),
                      icon: 'image',
                      onPress: () => void onPick(),
                    }
              }
              compact
            />
          )}

          {!result ? (
            <View style={styles.form}>
              <Input
                label={t('wildlife.identify.description')}
                placeholder={t('wildlife.identify.descriptionPlaceholder')}
                hint={t('wildlife.identify.descriptionHint')}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                editable={!busy}
                style={styles.textArea}
              />
              {busy ? (
                <View style={styles.loading}>
                  <TypingDots label={t('wildlife.identify.analyzing')} />
                  <Text variant="caption" color="textMuted" align="center">
                    {t('wildlife.identify.analyzing')}
                  </Text>
                </View>
              ) : null}
              <Button
                label={t('wildlife.identify.analyze')}
                icon="sparkles"
                onPress={onAnalyze}
                loading={busy}
                disabled={busy}
                fullWidth
                size="lg"
              />
              <View style={styles.actionRow}>
                <Button
                  label={t('wildlife.identify.gallery')}
                  icon="image"
                  variant="secondary"
                  onPress={() => void onPick()}
                  loading={isCapturing}
                  disabled={busy}
                  style={styles.flex}
                />
                {photo || textOnly ? (
                  <Button
                    label={t('wildlife.identify.retake')}
                    icon="refresh-cw"
                    variant="ghost"
                    onPress={reset}
                    disabled={busy}
                    style={styles.flex}
                  />
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <IdentificationResult
                result={result}
                onOpenSpecies={openSpecies}
                onAskCommunity={askCommunity}
                onPanic={openPanic}
                onDoctor={openDoctor}
              />
              <Button
                label={t('wildlife.identify.retake')}
                icon="refresh-cw"
                variant="ghost"
                onPress={reset}
                fullWidth
              />
            </View>
          )}
        </ScrollView>
      </Screen>
    );
  }

  /* ------------------------------ Kamera ------------------------------ */

  const disabled = isCapturing || !isReady;
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
        accessibilityLabel={t('wildlife.identify.title')}
      />
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
        <View
          style={[styles.overlayTop, { paddingTop: insets.top + spacing.sm }, { pointerEvents: 'box-none' }]}
        >
          {topBar(true)}
          <Text variant="caption" color="#FFFFFF" weight="bold" align="center" style={styles.hint}>
            {t('wildlife.identify.subtitle')}
          </Text>
        </View>
        <View style={[styles.overlayBottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={[styles.inputWrap, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('wildlife.identify.descriptionPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={[styles.input, { fontFamily: fontFamily.medium }]}
              accessibilityLabel={t('wildlife.identify.description')}
              returnKeyType="done"
            />
          </View>
          <View style={styles.shutterRow}>
            <IconButton
              icon="image"
              variant="blur"
              color="#FFFFFF"
              size={52}
              onPress={() => void onPick()}
              accessibilityLabel={t('wildlife.identify.gallery')}
            />
            <Tappable
              onPress={() => void onCapture()}
              disabled={disabled}
              style={[styles.shutter, { opacity: disabled ? 0.5 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t('wildlife.identify.capture')}
            >
              <View style={styles.shutterInner} />
            </Tappable>
            <IconButton
              icon="pencil"
              variant="blur"
              color="#FFFFFF"
              size={52}
              onPress={() => setTextOnly(true)}
              accessibilityLabel={t('wildlife.identify.description')}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cameraRoot: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 44 },
  topSpacer: { width: 44 },
  hint: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  overlayTop: { gap: spacing.xs },
  overlayBottom: { marginTop: 'auto', paddingHorizontal: spacing.lg, gap: spacing.lg },
  inputWrap: { borderRadius: radius.lg, paddingHorizontal: spacing.md },
  input: { color: '#FFFFFF', height: 46, fontSize: 15 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  formContent: { paddingBottom: spacing.xxxl, gap: spacing.md },
  imageWrap: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
  },
  image: { width: '100%', height: '100%' },
  form: { paddingHorizontal: spacing.lg, gap: spacing.md },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  loading: { gap: spacing.sm, paddingVertical: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
});
