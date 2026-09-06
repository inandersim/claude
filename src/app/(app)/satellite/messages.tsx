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
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  compressText,
  encodeSatMessage,
  formatPriceTry,
  messageCostEstimate,
  SAT_MESSAGE_MAX_LEN,
  summarizeQueue,
  type SatMessageKind,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { LinkBanner } from '@/features/satellite/components/LinkBanner';
import { MessageRow } from '@/features/satellite/components/MessageRow';
import {
  useFlushQueue,
  useLinkStatus,
  useSatDevices,
  useSatMessages,
  useSendSatMessage,
} from '@/features/satellite/hooks';

/** Serbest metin girişinin üst sınırı; kodlama başlığı (~35 karakter) için pay bırakır. */
const BODY_MAX = 120;

export default function SatelliteMessagesScreen() {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);

  const link = useLinkStatus();
  const devices = useSatDevices();
  const messages = useSatMessages();
  const send = useSendSatMessage();
  const flush = useFlushQueue();

  const [body, setBody] = useState('');
  const [kind, setKind] = useState<SatMessageKind>('text');
  const [attachLocation, setAttachLocation] = useState(true);
  // Önizleme için sabit zaman: render içinde Date.now() çağrılmaz
  const [previewTime] = useState(() => new Date());

  const preview = encodeSatMessage(
    { kind, body, coords: attachLocation ? location.coords : null, toContacts: [] },
    previewTime,
  );
  const device = devices.data?.find((d) => d.type !== 'starlink_mini') ?? devices.data?.[0] ?? null;
  const cost = messageCostEstimate(preview, link.data?.link === 'satellite' ? device : null);
  const queue = summarizeQueue(messages.data ?? []);
  const remaining = BODY_MAX - body.length;
  // Sıkıştırılmış metin 160 karaktere sığmadıysa encodeSatMessage kırpar → uyar
  const compressed = kind === 'location' ? '' : compressText(body);
  const willTruncate = compressed.length > 0 && !preview.endsWith(compressed);
  const nearLimit = preview.length > SAT_MESSAGE_MAX_LEN - 10;
  const canSend = (body.trim().length > 0 || kind === 'location') && !send.isPending;

  const onSend = () => {
    send.mutate(
      {
        kind,
        body: kind === 'location' ? '' : body.trim(),
        coords: attachLocation || kind === 'location' ? location.coords : null,
        toContacts: me.emergencyContacts.map((c) => c.phone),
      },
      {
        onSuccess: (m) => {
          setBody('');
          toast(
            m.status === 'queued' ? t('satellite.queuedToast') : t('satellite.sent'),
            m.status === 'queued' ? 'info' : 'success',
          );
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );
  };

  const onFlush = () =>
    flush.mutate(undefined, {
      onSuccess: (list) => toast(t('satellite.flushed', { count: list.length }), 'info'),
      onError: (e) => toast(e.message, 'error'),
    });

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('satellite.messages')}
        subtitle={t('satellite.messagesSubtitle')}
        showBack
        right={
          <Button
            label={t('satellite.flush')}
            icon="repeat"
            size="sm"
            variant="secondary"
            onPress={onFlush}
            loading={flush.isPending}
            disabled={queue.queued + queue.failed === 0}
          />
        }
      />
      <View style={styles.content}>
        {link.data ? <LinkBanner status={link.data} /> : null}

        <View
          style={[styles.compose, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <SectionHeader title={t('satellite.compose')} />
          <View style={styles.kindRow}>
            {(['text', 'checkin', 'location'] as SatMessageKind[]).map((k) => (
              <Chip
                key={k}
                label={t(`satellite.kind.${k}`)}
                selected={kind === k}
                onPress={() => setKind(k)}
                size="sm"
              />
            ))}
            <Chip
              label={t('satellite.attachLocation')}
              icon="map-pin"
              selected={attachLocation || kind === 'location'}
              onPress={kind === 'location' ? undefined : () => setAttachLocation((v) => !v)}
              color={colors.info}
              size="sm"
            />
          </View>
          {kind !== 'location' ? (
            <Input
              placeholder={t('satellite.composePlaceholder')}
              value={body}
              onChangeText={(v) => setBody(v.slice(0, BODY_MAX))}
              multiline
              maxLength={BODY_MAX}
              hint={t('satellite.remaining', { count: remaining })}
              accessibilityLabel={t('satellite.compose')}
            />
          ) : null}

          <View style={[styles.preview, { backgroundColor: colors.surfaceMuted }]}>
            <View style={styles.previewHead}>
              <Text variant="label" color="textSubtle">
                {t('satellite.compressedPreview')}
              </Text>
              <Text variant="label" color={nearLimit ? 'danger' : 'textSubtle'}>
                {preview.length}/{SAT_MESSAGE_MAX_LEN}
              </Text>
            </View>
            <Text variant="bodySm" style={styles.mono} selectable>
              {preview}
            </Text>
            {willTruncate || nearLimit ? (
              <View style={styles.limitRow}>
                <Icon name="triangle-alert" size={13} color={colors.danger} />
                <Text variant="caption" color="danger" style={{ flex: 1 }}>
                  {t('satellite.info')}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.costRow}>
            <Icon name="ticket" size={14} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('satellite.cost')}: {t('satellite.credits', { count: cost.credits })} ·{' '}
              {cost.overQuota ? formatPriceTry(cost.priceTry, locale, false) : t('satellite.free')}
            </Text>
          </View>

          <Button
            label={t('satellite.send')}
            icon="send"
            onPress={onSend}
            disabled={!canSend}
            loading={send.isPending}
            fullWidth
          />
        </View>

        <SectionHeader
          title={t('satellite.queue')}
          subtitle={
            queue.queued + queue.failed === 0
              ? t('satellite.queueEmpty')
              : t('satellite.queueSummary', { queued: queue.queued, failed: queue.failed })
          }
        />
        {messages.isError ? (
          <ErrorState onRetry={() => messages.refetch()} />
        ) : messages.isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={96} style={{ borderRadius: radius.lg }} />)
        ) : messages.data && messages.data.length > 0 ? (
          messages.data.map((m) => <MessageRow key={m.id} message={m} />)
        ) : (
          <EmptyState
            icon="inbox"
            title={t('satellite.noMessages')}
            description={t('satellite.noMessagesDescription')}
            compact
          />
        )}
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
  compose: {
    padding: spacing.md,
    gap: spacing.sm + 2,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preview: { padding: spacing.sm + 2, borderRadius: radius.md, gap: 4 },
  previewHead: { flexDirection: 'row', justifyContent: 'space-between' },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  mono: { fontFamily: 'monospace' },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
});
