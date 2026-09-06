import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon, IconButton, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import type { GroupMessageWithSender } from '@/domain';

export type AttachmentKind = 'photo' | 'location' | 'poll' | 'route';

/**
 * Mesaj yazma alanı: metin, ek menüsü (fotoğraf/konum/anket/rota), yanıt önizlemesi, gönder.
 * `disabledLabel` verilirse yalnızca bilgilendirme satırı çizilir (kanal salt okunur vb.).
 */
export function Composer({
  value,
  onChange,
  onSend,
  onAttach,
  replyTo,
  onCancelReply,
  sending = false,
  disabledLabel,
  bottomInset = 0,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onAttach: (kind: AttachmentKind) => void;
  replyTo?: GroupMessageWithSender | null;
  onCancelReply?: () => void;
  sending?: boolean;
  disabledLabel?: string | null;
  bottomInset?: number;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  if (disabledLabel) {
    return (
      <View
        style={[
          styles.readOnly,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Math.max(bottomInset, spacing.md),
          },
        ]}
      >
        <Icon name="lock" size={16} color={colors.textMuted} />
        <Text variant="bodySm" color="textMuted">
          {disabledLabel}
        </Text>
      </View>
    );
  }

  const attachments: { kind: AttachmentKind; icon: IconName; label: string }[] = [
    { kind: 'photo', icon: 'image', label: t('groups.composer.photo') },
    { kind: 'location', icon: 'map-pin', label: t('groups.composer.location') },
    { kind: 'poll', icon: 'chart-bar', label: t('groups.composer.poll') },
    { kind: 'route', icon: 'route', label: t('groups.composer.route') },
  ];

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(bottomInset, spacing.md),
        },
      ]}
    >
      {replyTo ? (
        <View
          style={[
            styles.reply,
            { backgroundColor: colors.surfaceMuted, borderLeftColor: colors.primary },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="label" weight="bold" color={colors.primary}>
              {t('groups.replyingTo', { name: replyTo.sender.displayName })}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {replyTo.text ||
                t(
                  `groups.preview.${replyTo.type === 'text' || replyTo.type === 'system' ? 'image' : replyTo.type}`,
                )}
            </Text>
          </View>
          <IconButton
            icon="x"
            size={28}
            iconSize={14}
            variant="ghost"
            onPress={onCancelReply}
            accessibilityLabel={t('groups.composer.cancelReply')}
          />
        </View>
      ) : null}

      {menuOpen ? (
        <View style={styles.attachRow}>
          {attachments.map((a) => (
            <Tappable
              key={a.kind}
              onPress={() => {
                setMenuOpen(false);
                onAttach(a.kind);
              }}
              haptic="selection"
              style={[
                styles.attachItem,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <Icon name={a.icon} size={20} color={colors.primary} />
              <Text variant="label" weight="bold" color="textMuted">
                {a.label}
              </Text>
            </Tappable>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        <IconButton
          icon={menuOpen ? 'x' : 'plus'}
          variant="ghost"
          size={40}
          onPress={() => setMenuOpen((v) => !v)}
          accessibilityLabel={t('groups.composer.attach')}
        />
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={t('groups.composer.placeholder')}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
            multiline
            maxLength={2000}
            accessibilityLabel={t('groups.composer.placeholder')}
          />
        </View>
        <IconButton
          icon="send"
          onPress={onSend}
          disabled={!value.trim() || sending}
          color={colors.onPrimary}
          style={{ backgroundColor: colors.primary }}
          accessibilityLabel={t('groups.composer.send')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  attachRow: { flexDirection: 'row', gap: spacing.sm },
  attachItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  inputWrap: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 42,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: { fontSize: 15, paddingVertical: spacing.sm + 2 },
});
