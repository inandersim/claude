import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Icon, IconButton, Input, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { ADVENTURE_TYPES, ADVENTURE_TYPE_META, type AdventureType } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { LiveBadge } from '@/features/live/components/LiveBadge';
import { useEndStream, useStartStream } from '@/features/live/hooks';

/**
 * Yayın başlatma ekranı. Kamera önizlemesi cihaz kamerasından gelir;
 * gerçek yayın için bir sağlayıcı (LiveKit/Mux) entegre edilene kadar
 * yayın kaydı demo modunda oluşturulur.
 */
export default function StartStreamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const [permission, requestPermission] = useCameraPermissions();
  const start = useStartStream();
  const end = useEndStream();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState(me.locationName);
  const [type, setType] = useState<AdventureType>(me.favoriteTypes[0] ?? 'hiking');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [error, setError] = useState<string | null>(null);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  React.useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const cameraGranted = permission?.granted ?? false;
  const cameraSupported = Platform.OS !== 'web' || Boolean(permission);

  const onStart = () => {
    if (!title.trim()) {
      setError(t('live.titleRequired'));
      return;
    }
    setError(null);
    start.mutate(
      { title, description, adventureType: type, locationName, coords: location.coords },
      {
        onSuccess: (stream) => {
          setLiveId(stream.id);
          setStartedAt(Date.now());
          toast(t('live.startedToast'), 'success');
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  const onEnd = () => {
    if (!liveId) return router.back();
    Alert.alert(t('live.endStream'), t('live.endConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('live.endStream'),
        style: 'destructive',
        onPress: () =>
          end.mutate(liveId, {
            onSuccess: () => {
              toast(t('live.endedToast'), 'info');
              router.back();
            },
          }),
      },
    ]);
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <View style={styles.root}>
      {/* Kamera önizleme */}
      <View style={StyleSheet.absoluteFill}>
        {cameraGranted ? (
          <CameraView style={StyleSheet.absoluteFill} facing={facing} mode="video" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noCamera, { backgroundColor: '#0B1210' }]}>
            <Icon name="camera-off" size={40} color="rgba(255,255,255,0.5)" strokeWidth={1.6} />
            <Text variant="title" color="#FFFFFF" align="center">
              {t('live.cameraPermission')}
            </Text>
            <Text
              variant="bodySm"
              color="rgba(255,255,255,0.7)"
              align="center"
              style={{ maxWidth: 280 }}
            >
              {cameraSupported
                ? t('live.cameraPermissionDescription')
                : t('live.cameraUnavailable')}
            </Text>
            {cameraSupported && !cameraGranted ? (
              <Button
                label={t('live.grantCamera')}
                icon="camera"
                size="sm"
                onPress={() => requestPermission()}
              />
            ) : null}
          </View>
        )}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,6,0.35)' }]}
          pointerEvents="none"
        />
      </View>

      <View style={[styles.top, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="x"
          variant="blur"
          onPress={liveId ? onEnd : () => router.back()}
          accessibilityLabel={t('common.close')}
        />
        {liveId ? (
          <View style={styles.liveRow}>
            <LiveBadge />
            <View style={styles.timer}>
              <Text variant="label" weight="extrabold" color="#FFFFFF">
                {mm}:{ss}
              </Text>
            </View>
          </View>
        ) : null}
        <IconButton
          icon="switch-camera"
          variant="blur"
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          accessibilityLabel={t('live.flipCamera')}
          disabled={!cameraGranted}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomWrap}
        pointerEvents="box-none"
      >
        {liveId ? (
          <View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.lg, backgroundColor: 'rgba(11,18,16,0.85)' },
            ]}
          >
            <Text variant="h3" color="#FFFFFF" numberOfLines={2}>
              {title}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.7)">
              {t(ADVENTURE_TYPE_META[type].labelKey)} · {locationName}
            </Text>
            <Button
              label={t('live.endStream')}
              variant="danger"
              icon="square"
              fullWidth
              size="lg"
              onPress={onEnd}
              loading={end.isPending}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.sheet,
              { paddingBottom: insets.bottom + spacing.lg, backgroundColor: 'rgba(11,18,16,0.88)' },
            ]}
          >
            <Text variant="h2" color="#FFFFFF">
              {t('live.goLive')}
            </Text>
            <Input
              label={t('live.streamTitle')}
              value={title}
              onChangeText={setTitle}
              placeholder={t('live.streamTitlePlaceholder')}
              error={error}
            />
            <Input
              label={t('live.streamDescription')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('live.streamDescriptionPlaceholder')}
            />
            <Input
              label={t('post.location')}
              icon="map-pin"
              value={locationName}
              onChangeText={setLocationName}
              placeholder={t('post.locationPlaceholder')}
            />
            <View style={styles.chips}>
              {ADVENTURE_TYPES.map((item) => {
                const meta = ADVENTURE_TYPE_META[item];
                return (
                  <Chip
                    key={item}
                    size="sm"
                    label={t(meta.labelKey)}
                    icon={meta.icon}
                    color={meta.color}
                    selected={type === item}
                    onPress={() => setType(item)}
                  />
                );
              })}
            </View>
            <Button
              label={t('live.startStream')}
              icon="radio"
              variant="danger"
              size="lg"
              fullWidth
              onPress={onStart}
              loading={start.isPending}
              style={{ backgroundColor: '#E5484D' }}
            />
            <Text variant="caption" color={colors.textSubtle} align="center">
              {t('live.notice')}
            </Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  noCamera: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
  },
  top: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timer: {
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    justifyContent: 'center',
  },
  bottomWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: spacing.lg,
    gap: spacing.md,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
