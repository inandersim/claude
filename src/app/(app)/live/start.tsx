import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { goBack } from '@/core/navigation';
import { confirmDialog } from '@/core/utils/confirm';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Icon, IconButton, Input, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPES,
  ADVENTURE_TYPE_META,
  canUseDrone,
  type AdventureType,
  type StreamSource,
} from '@/domain';
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
  const [source, setSource] = useState<StreamSource>('camera');
  const droneAllowed = canUseDrone(me.plan);
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
      { title, description, adventureType: type, locationName, coords: location.coords, source },
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

  const finish = (id: string) =>
    end.mutate(id, {
      onSuccess: () => {
        toast(t('live.endedToast'), 'info');
        goBack(router, '/live');
      },
      onError: () => toast(t('common.error'), 'error'),
    });

  const onEnd = () => {
    if (!liveId) return goBack(router, '/live');
    // `Alert` web'de sessizce yok sayılır; orada tarayıcı onayı kullanılır.
    if (Platform.OS === 'web') {
      const ok =
        typeof window === 'undefined' ||
        window.confirm(`${t('live.endStream')}\n${t('live.endConfirm')}`);
      if (ok) finish(liveId);
      return;
    }
    confirmDialog(
      t('live.endStream'),
      t('live.endConfirm'),
      t('live.endStream'),
      t('common.cancel'),
      () => finish(liveId),
    );
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
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,6,0.35)' }, { pointerEvents: 'none' }]}
        />
      </View>

      <View style={[styles.top, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="x"
          variant="blur"
          onPress={liveId ? onEnd : () => goBack(router, '/live')}
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
        style={[styles.bottomWrap, { pointerEvents: 'box-none' }]}
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
            {source === 'drone' ? (
              <View style={styles.rtmp}>
                <Text variant="label" color="rgba(255,255,255,0.6)">
                  {t('drone.rtmpUrl')}
                </Text>
                <Text variant="caption" weight="bold" color="#FFFFFF" selectable>
                  rtmp://ingest.zirtan.app/live/{liveId}
                </Text>
              </View>
            ) : null}
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
              {
                paddingTop: insets.top + 42 + spacing.lg + spacing.sm,
                paddingBottom: insets.bottom + spacing.lg,
                backgroundColor: 'rgba(11,18,16,0.88)',
              },
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
            <Text variant="caption" color={colors.textSubtle}>
              {t('drone.source')}
            </Text>
            <View style={styles.chips}>
              <Chip
                label={t('drone.camera')}
                icon="camera"
                selected={source === 'camera'}
                onPress={() => setSource('camera')}
              />
              <Chip
                label={t('drone.drone')}
                icon="radio-tower"
                selected={source === 'drone'}
                onPress={() => {
                  if (!droneAllowed) return toast(t('drone.proRequired'), 'info');
                  setSource('drone');
                }}
              />
            </View>
            {source === 'drone' ? (
              <Text variant="caption" color={colors.textSubtle}>
                {t('drone.setupNotice')}
              </Text>
            ) : null}
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
  rtmp: {
    marginTop: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 2,
  },
});
