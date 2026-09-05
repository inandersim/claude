import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Input,
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  StatTile,
  Tappable,
  Text,
  type IconName,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  checkinPresetBody,
  LINK_TYPES,
  SAT_DEVICE_META,
  SAT_DEVICE_TYPES,
  summarizeQueue,
  type CheckinPresetId,
  type LinkType,
  type SatDeviceType,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { CheckinPresetChips } from '@/features/satellite/components/CheckinPresetChips';
import { CoverageGauge } from '@/features/satellite/components/CoverageGauge';
import { DeviceCard } from '@/features/satellite/components/DeviceCard';
import { LinkBanner } from '@/features/satellite/components/LinkBanner';
import {
  useLinkStatus,
  usePairDevice,
  useSatDevices,
  useSatMessages,
  useSendSatMessage,
  useSetLink,
  useUnpairDevice,
} from '@/features/satellite/hooks';

export default function SatelliteScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);

  const link = useLinkStatus();
  const setLink = useSetLink();
  const devices = useSatDevices();
  const pair = usePairDevice();
  const unpair = useUnpairDevice();
  const messages = useSatMessages();
  const send = useSendSatMessage();

  const [showPair, setShowPair] = useState(false);
  const [pairType, setPairType] = useState<SatDeviceType>('inreach');
  const [pairName, setPairName] = useState('');
  const [pairImei, setPairImei] = useState('');
  const [pairError, setPairError] = useState<string | null>(null);
  const [busyPreset, setBusyPreset] = useState<CheckinPresetId | null>(null);
  const [unpairingId, setUnpairingId] = useState<string | null>(null);

  const primaryDevice = devices.data?.[0] ?? null;
  const queue = summarizeQueue(messages.data ?? []);
  const needsImei = pairType !== 'phone_satellite' && pairType !== 'starlink_mini';

  const submitPair = () => {
    const name = pairName.trim();
    if (!name) {
      setPairError(t('satellite.nameRequired'));
      return;
    }
    const imei = pairImei.trim();
    if (imei && !/^\d{15}$/.test(imei)) {
      setPairError(t('satellite.imeiInvalid'));
      return;
    }
    setPairError(null);
    pair.mutate(
      { type: pairType, name, imei: imei || null },
      {
        onSuccess: (device) => {
          toast(t('satellite.paired', { name: device.name }), 'success');
          setShowPair(false);
          setPairName('');
          setPairImei('');
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const sendPreset = (id: CheckinPresetId) => {
    setBusyPreset(id);
    send.mutate(
      {
        kind: 'checkin',
        body: checkinPresetBody(id),
        coords: location.coords,
        toContacts: me.emergencyContacts.map((c) => c.phone),
      },
      {
        onSuccess: (m) =>
          toast(
            m.status === 'queued' ? t('satellite.checkinQueued') : t('satellite.checkinSent'),
            m.status === 'queued' ? 'info' : 'success',
          ),
        onError: (e) => toast(e.message, 'error'),
        onSettled: () => setBusyPreset(null),
      },
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('satellite.title')}
        subtitle={t('satellite.subtitle')}
        showBack
        right={
          <Button
            label={t('satellite.openSos')}
            icon="siren"
            size="sm"
            variant="danger"
            onPress={() => router.push('/satellite/sos')}
          />
        }
      />
      <View style={styles.content}>
        {link.isError ? (
          <ErrorState onRetry={() => link.refetch()} />
        ) : link.data ? (
          <LinkBanner status={link.data} />
        ) : (
          <Skeleton height={76} style={{ borderRadius: radius.xl }} />
        )}

        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color="textSubtle">
            {t('satellite.demoSwitch')}
          </Text>
          <SegmentedControl<LinkType>
            segments={LINK_TYPES.map((l) => ({ value: l, label: t(`satellite.link.${l}`) }))}
            value={link.data?.link ?? 'cellular'}
            onChange={(l) => setLink.mutate(l)}
          />
        </View>

        <SectionHeader
          title={t('satellite.devices')}
          actionLabel={showPair ? undefined : t('satellite.pair')}
          onAction={showPair ? undefined : () => setShowPair(true)}
        />
        {showPair ? (
          <View
            style={[
              styles.pairCard,
              { backgroundColor: colors.surface, borderColor: colors.borderStrong },
            ]}
          >
            <View style={styles.pairHead}>
              <Icon name="bluetooth" size={18} color={colors.info} />
              <Text variant="title" style={{ flex: 1 }}>
                {t('satellite.pair')}
              </Text>
            </View>
            <View style={styles.typeRow}>
              {SAT_DEVICE_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={t(SAT_DEVICE_META[type].labelKey)}
                  icon={SAT_DEVICE_META[type].icon as IconName}
                  selected={pairType === type}
                  onPress={() => setPairType(type)}
                  size="sm"
                />
              ))}
            </View>
            <Input
              label={t('satellite.deviceName')}
              placeholder={t('satellite.deviceNamePlaceholder')}
              value={pairName}
              onChangeText={setPairName}
              icon="pencil"
              error={pairError === t('satellite.nameRequired') ? pairError : null}
            />
            {needsImei ? (
              <Input
                label={t('satellite.imei')}
                hint={t('satellite.imeiHint')}
                value={pairImei}
                onChangeText={setPairImei}
                keyboardType="number-pad"
                maxLength={15}
                icon="hexagon"
                error={pairError === t('satellite.imeiInvalid') ? pairError : null}
              />
            ) : null}
            <View style={styles.pairActions}>
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => {
                  setShowPair(false);
                  setPairError(null);
                }}
                style={{ flex: 1 }}
              />
              <Button
                label={pair.isPending ? t('satellite.pairing') : t('satellite.pair')}
                icon="link"
                onPress={submitPair}
                loading={pair.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ) : null}
        {devices.isError ? (
          <ErrorState onRetry={() => devices.refetch()} />
        ) : devices.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} height={132} style={{ borderRadius: radius.lg }} />)
        ) : devices.data && devices.data.length > 0 ? (
          devices.data.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              unpairing={unpairingId === d.id && unpair.isPending}
              onUnpair={() => {
                setUnpairingId(d.id);
                unpair.mutate(d.id, {
                  onSuccess: () => toast(t('satellite.unpaired'), 'info'),
                  onError: (e) => toast(e.message, 'error'),
                  onSettled: () => setUnpairingId(null),
                });
              }}
            />
          ))
        ) : !showPair ? (
          <EmptyState
            icon="satellite"
            title={t('satellite.noDevices')}
            description={t('satellite.noDevicesDescription')}
            action={{ label: t('satellite.pair'), icon: 'link', onPress: () => setShowPair(true) }}
            compact
          />
        ) : null}

        <CoverageGauge
          coords={location.coords}
          deviceType={primaryDevice?.type ?? 'phone_satellite'}
          deviceName={primaryDevice?.name}
        />

        <SectionHeader
          title={t('satellite.quickCheckin')}
          subtitle={t('satellite.quickCheckinHint')}
        />
        <CheckinPresetChips onSelect={sendPreset} disabled={send.isPending} busyId={busyPreset} />

        <SectionHeader
          title={t('satellite.queue')}
          actionLabel={t('satellite.openMessages')}
          onAction={() => router.push('/satellite/messages')}
        />
        {messages.isError ? (
          <ErrorState onRetry={() => messages.refetch()} />
        ) : messages.isLoading ? (
          <Skeleton height={84} style={{ borderRadius: radius.lg }} />
        ) : (
          <View style={styles.statRow}>
            <StatTile
              icon="hourglass"
              label={t('satellite.status.queued')}
              value={String(queue.queued)}
              color={colors.warning}
              compact
              style={{ flex: 1 }}
            />
            <StatTile
              icon="check-check"
              label={t('satellite.status.delivered')}
              value={String(queue.delivered)}
              color={colors.success}
              compact
              style={{ flex: 1 }}
            />
            <StatTile
              icon="circle-x"
              label={t('satellite.status.failed')}
              value={String(queue.failed)}
              color={colors.danger}
              compact
              style={{ flex: 1 }}
            />
          </View>
        )}

        <View style={styles.links}>
          <Tappable
            onPress={() => router.push('/satellite/messages')}
            style={[
              styles.linkCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('satellite.messages')}
          >
            <Icon name="message-circle" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{t('satellite.messages')}</Text>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {t('satellite.messagesSubtitle')}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textSubtle} />
          </Tappable>
          <Tappable
            onPress={() => router.push('/satellite/sos')}
            style={[
              styles.linkCard,
              { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('satellite.sos.title')}
          >
            <Icon name="siren" size={20} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{t('satellite.sos.title')}</Text>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {t('satellite.sos.subtitle')}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.danger} />
          </Tappable>
        </View>

        <Text variant="caption" color="textSubtle">
          {t('satellite.info')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  pairCard: {
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  pairHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pairActions: { flexDirection: 'row', gap: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  links: { gap: spacing.sm },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
