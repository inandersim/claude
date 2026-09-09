import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatTime } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  decodeSystemMessage,
  formatDistance,
  pollPercentages,
  senderColorIndex,
  type GroupMessageWithSender,
  type ID,
  type Route,
} from '@/domain';

import { copyText } from '../clipboard';

const SENDER_PALETTE = ['#E9930C', '#6CB4FF', '#C084FC', '#F472B6', '#2DD4BF', '#FB7185'];

export interface MessageBubbleProps {
  message: GroupMessageWithSender;
  mine: boolean;
  /** Önceki mesajla aynı gönderen (avatar/isim gizlenir) */
  grouped: boolean;
  /** Rota mesajı için rota bilgisi (ekran sağlar) */
  route?: Route | null;
  pinned?: boolean;
  canPin?: boolean;
  onReply?: (message: GroupMessageWithSender) => void;
  onPin?: (message: GroupMessageWithSender) => void;
  onVote?: (messageId: ID, optionIds: ID[]) => void;
}

/**
 * Sohbet balonu: kendi/karşı taraf, renkli gönderen adı, yanıt alıntısı, görsel,
 * konum kartı, rota kartı, anket ve ortalanmış sistem mesajı. Uzun basınca
 * yanıtla / sabitle / kopyala menüsü açılır.
 */
export function MessageBubble({
  message,
  mine,
  grouped,
  route,
  pinned = false,
  canPin = false,
  onReply,
  onPin,
  onVote,
}: MessageBubbleProps) {
  const { t } = useT();
  const { colors, isDark } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  if (message.type === 'system') {
    const sys = decodeSystemMessage(message.text);
    const label = sys ? t(`groups.system.${sys.kind}`, { name: sys.name }) : message.text;
    return (
      <View style={styles.systemRow}>
        <View style={[styles.systemPill, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="caption" color="textMuted" align="center">
            {label}
          </Text>
        </View>
      </View>
    );
  }

  const senderColor = mine
    ? colors.onPrimary
    : SENDER_PALETTE[senderColorIndex(message.senderId, SENDER_PALETTE.length)];
  const fg = mine ? colors.onPrimary : colors.text;
  const metaColor = mine ? 'rgba(6,18,11,0.6)' : colors.textSubtle;
  const innerBg = mine ? 'rgba(255,255,255,0.22)' : colors.surface;
  const bubbleBg = mine ? colors.primary : isDark ? colors.surfaceMuted : colors.surface;

  const menuItems: {
    key: string;
    icon: 'message-square' | 'bookmark' | 'copy';
    label: string;
    onPress: () => void;
  }[] = [];
  if (onReply) {
    menuItems.push({
      key: 'reply',
      icon: 'message-square',
      label: t('groups.reply'),
      onPress: () => onReply(message),
    });
  }
  if (canPin && onPin) {
    menuItems.push({
      key: 'pin',
      icon: 'bookmark',
      label: pinned ? t('groups.unpin') : t('groups.pin'),
      onPress: () => onPin(message),
    });
  }
  if (message.text) {
    menuItems.push({
      key: 'copy',
      icon: 'copy',
      label: t('groups.copy'),
      onPress: () => {
        copyText(message.text).catch(() => undefined);
      },
    });
  }

  return (
    <View
      style={[styles.row, mine ? styles.mineRow : styles.theirsRow, grouped && styles.groupedRow]}
    >
      {!mine ? (
        <View style={styles.avatarSlot}>
          {!grouped ? (
            <Avatar uri={message.sender.avatarUrl} name={message.sender.displayName} size={30} />
          ) : null}
        </View>
      ) : null}
      <Pressable
        onLongPress={() => menuItems.length && setMenuOpen(true)}
        delayLongPress={280}
        style={[
          styles.bubble,
          { backgroundColor: bubbleBg, borderColor: mine ? 'transparent' : colors.border },
          mine ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 },
          message.type === 'image' && styles.bubbleImage,
        ]}
        accessibilityRole="text"
        accessibilityLabel={`${message.sender.displayName}: ${message.text}`}
        accessibilityHint={menuItems.length ? t('groups.messageActions') : undefined}
      >
        {!mine && !grouped ? (
          <Text variant="caption" weight="bold" color={senderColor} numberOfLines={1}>
            {message.sender.displayName}
          </Text>
        ) : null}

        {message.replyTo ? (
          <View
            style={[
              styles.quote,
              {
                backgroundColor: innerBg,
                borderLeftColor: mine ? colors.onPrimary : colors.primary,
              },
            ]}
          >
            <Text variant="label" weight="bold" color={mine ? colors.onPrimary : colors.primary}>
              {message.replyTo.sender.displayName}
            </Text>
            <Text variant="caption" color={fg} numberOfLines={2}>
              {message.replyTo.text || t(`groups.preview.${quoteKind(message.replyTo.type)}`)}
            </Text>
          </View>
        ) : null}

        {message.type === 'image' && message.imageUrl ? (
          <Image
            source={{ uri: message.imageUrl }}
            style={styles.image}
            contentFit="cover"
            accessibilityLabel={t('groups.preview.image')}
          />
        ) : null}

        {message.type === 'location' && message.coords ? (
          <LocationCard coords={message.coords} inverse={mine} innerBg={innerBg} fg={fg} />
        ) : null}

        {message.type === 'route' ? (
          <RouteCard route={route ?? null} inverse={mine} innerBg={innerBg} fg={fg} />
        ) : null}

        {message.type === 'poll' && message.poll ? (
          <PollCard message={message} inverse={mine} fg={fg} innerBg={innerBg} onVote={onVote} />
        ) : null}

        {message.text ? (
          <Text variant="body" color={fg}>
            {message.text}
          </Text>
        ) : null}

        <View style={styles.meta}>
          {pinned ? <Icon name="bookmark" size={11} color={metaColor} strokeWidth={2.6} /> : null}
          <Text variant="label" color={metaColor}>
            {formatTime(message.createdAt)}
          </Text>
        </View>
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        {/* Arka plan ile sayfa kardeş durur: iç içe <button> oluşmaz (erişilebilirlik). */}
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setMenuOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheetWrap, { pointerEvents: 'box-none' }]}>
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
            <Text variant="caption" color="textMuted" numberOfLines={2} style={styles.sheetPreview}>
              {message.text || t(`groups.preview.${quoteKind(message.type)}`)}
            </Text>
            {menuItems.map((item) => (
              <Tappable
                key={item.key}
                onPress={() => {
                  setMenuOpen(false);
                  item.onPress();
                }}
                haptic="selection"
                style={[styles.sheetItem, { borderTopColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <Icon name={item.icon} size={18} color={colors.text} />
                <Text variant="body" weight="medium">
                  {item.label}
                </Text>
              </Tappable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function quoteKind(type: GroupMessageWithSender['type']): 'image' | 'location' | 'route' | 'poll' {
  return type === 'image' || type === 'location' || type === 'route' || type === 'poll'
    ? type
    : 'image';
}

function LocationCard({
  coords,
  inverse,
  innerBg,
  fg,
}: {
  coords: { latitude: number; longitude: number };
  inverse: boolean;
  innerBg: string;
  fg: string;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const pin = inverse ? colors.onPrimary : colors.danger;
  const open = () => {
    const { latitude, longitude } = coords;
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url).catch(() => undefined);
  };
  return (
    <View style={[styles.card, { backgroundColor: innerBg }]}>
      <Svg
        width={36}
        height={36}
        viewBox="0 0 24 24"
        accessibilityLabel={t('groups.location.shared')}
      >
        <Path d="M12 22s7-6.2 7-12A7 7 0 0 0 5 10c0 5.8 7 12 7 12z" fill={pin} opacity={0.9} />
        <Circle cx="12" cy="10" r="2.6" fill={inverse ? colors.primary : '#FFFFFF'} />
      </Svg>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" weight="bold" color={fg}>
          {t('groups.location.shared')}
        </Text>
        <Text variant="label" color={fg} style={{ opacity: 0.8 }}>
          {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
        </Text>
        <Tappable
          onPress={open}
          haptic="selection"
          style={styles.inlineAction}
          accessibilityRole="button"
          accessibilityLabel={t('groups.location.openInMaps')}
        >
          <Icon name="external-link" size={12} color={fg} strokeWidth={2.4} />
          <Text variant="label" weight="bold" color={fg}>
            {t('groups.location.openInMaps')}
          </Text>
        </Tappable>
      </View>
    </View>
  );
}

function RouteCard({
  route,
  inverse,
  innerBg,
  fg,
}: {
  route: Route | null;
  inverse: boolean;
  innerBg: string;
  fg: string;
}) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = route ? ADVENTURE_TYPE_META[route.adventureType] : null;
  const accent = inverse ? colors.onPrimary : (meta?.color ?? colors.primary);
  return (
    <View style={[styles.card, { backgroundColor: innerBg }]}>
      <View
        style={[
          styles.routeIcon,
          { backgroundColor: inverse ? 'rgba(255,255,255,0.25)' : colors.primarySoft },
        ]}
      >
        <Icon name={meta?.icon ?? 'route'} size={18} color={accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" color={fg} style={{ opacity: 0.8 }}>
          {t('groups.route.shared')}
        </Text>
        <Text variant="caption" weight="bold" color={fg} numberOfLines={2}>
          {route?.name ?? t('groups.route.unknown')}
        </Text>
        {route ? (
          <Text variant="label" color={fg} style={{ opacity: 0.85 }}>
            {formatDistance(route.distanceKm, locale)} · {t(`difficulty.${route.difficulty}`)}
            {route.elevationGainM ? ` · ↑${route.elevationGainM} m` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PollCard({
  message,
  inverse,
  fg,
  innerBg,
  onVote,
}: {
  message: GroupMessageWithSender;
  inverse: boolean;
  fg: string;
  innerBg: string;
  onVote?: (messageId: ID, optionIds: ID[]) => void;
}) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const poll = message.poll;
  const [pending, setPending] = useState<ID[]>([]);
  if (!poll) return null;
  const { total, byOption } = pollPercentages(poll);
  const mine = new Set(message.myVote ?? []);
  const selected = poll.multi && pending.length ? new Set(pending) : mine;
  const barColor = inverse ? 'rgba(255,255,255,0.35)' : colors.primarySoft;
  const strongBar = inverse ? 'rgba(255,255,255,0.55)' : colors.primary;

  const choose = (id: ID) => {
    if (!onVote) return;
    if (!poll.multi) {
      onVote(message.id, [id]);
      return;
    }
    setPending((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <View style={[styles.poll, { backgroundColor: innerBg }]}>
      <View style={styles.pollHeader}>
        <Icon name="chart-bar" size={14} color={fg} />
        <Text variant="caption" weight="bold" color={fg} style={{ flex: 1 }}>
          {poll.question}
        </Text>
      </View>
      {poll.multi ? (
        <Text variant="label" color={fg} style={{ opacity: 0.75 }}>
          {t('groups.poll.multiHint')}
        </Text>
      ) : null}
      {poll.options.map((o) => {
        const pct = byOption[o.id] ?? 0;
        const isSel = selected.has(o.id);
        return (
          <Tappable
            key={o.id}
            onPress={() => choose(o.id)}
            haptic="selection"
            scaleTo={0.99}
            disabled={!onVote}
            style={[styles.option, { borderColor: isSel ? strongBar : 'transparent' }]}
            accessibilityRole="button"
            accessibilityLabel={`${o.text}, ${t('groups.poll.votes', { count: o.votes })}`}
            accessibilityState={{ selected: isSel }}
          >
            <View
              style={[
                styles.optionBar,
                { width: `${Math.max(pct, 2)}%`, backgroundColor: isSel ? strongBar : barColor },
              ]}
            />
            <View style={styles.optionRow}>
              <Icon
                name={isSel ? 'circle-check' : 'square'}
                size={14}
                color={fg}
                strokeWidth={2.2}
              />
              <Text variant="bodySm" color={fg} style={{ flex: 1 }} numberOfLines={2}>
                {o.text}
              </Text>
              <Text variant="label" weight="bold" color={fg}>
                {pct}%
              </Text>
            </View>
          </Tappable>
        );
      })}
      <View style={styles.pollFooter}>
        <Text variant="label" color={fg} style={{ opacity: 0.75 }}>
          {total
            ? t('groups.poll.votes', { count: total.toLocaleString(locale) })
            : t('groups.poll.noVotes')}
        </Text>
        {poll.multi && onVote ? (
          <Tappable
            onPress={() => {
              onVote(message.id, pending.length ? pending : Array.from(mine));
              setPending([]);
            }}
            haptic="light"
            disabled={!pending.length && !mine.size}
            style={[styles.voteBtn, { backgroundColor: strongBar }]}
            accessibilityRole="button"
            accessibilityLabel={pending.length ? t('groups.poll.vote') : t('groups.poll.retract')}
          >
            <Text variant="label" weight="bold" color={inverse ? colors.primary : colors.onPrimary}>
              {pending.length || !mine.size ? t('groups.poll.vote') : t('groups.poll.retract')}
            </Text>
          </Tappable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: spacing.md, marginVertical: 3, gap: spacing.xs },
  groupedRow: { marginTop: 0 },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  avatarSlot: { width: 30, alignSelf: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  bubbleImage: { paddingHorizontal: 6, paddingTop: 6 },
  image: { width: 240, maxWidth: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  quote: {
    borderLeftWidth: 3,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    minWidth: 220,
  },
  routeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  poll: { borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs, minWidth: 240 },
  pollHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  option: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1.5 },
  optionBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.sm },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  pollFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  voteBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  systemRow: { alignItems: 'center', marginVertical: spacing.sm, paddingHorizontal: spacing.lg },
  systemPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  backdrop: { ...StyleSheet.absoluteFill },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.sm,
  },
  sheetPreview: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
