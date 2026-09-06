import React from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';

import { copyText } from '../clipboard';

/** Davet kodu kartı: büyük kod, kopyala ve paylaş düğmeleri. */
export function InviteCodeCard({ code, groupName }: { code: string; groupName: string }) {
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();

  const copy = async () => {
    const ok = await copyText(code);
    if (ok) toast(t('groups.copied'), 'success');
  };
  const share = () => {
    Share.share({ message: t('groups.shareMessage', { name: groupName, code }) }).catch(
      () => undefined,
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Icon name="key-round" size={16} color={colors.primary} />
        <Text variant="caption" weight="bold" color="textMuted">
          {t('groups.inviteCodeTitle')}
        </Text>
      </View>
      <Text
        variant="h2"
        weight="extrabold"
        style={[styles.code, { color: colors.text, fontFamily: fontFamily.bold }]}
        accessibilityLabel={`${t('groups.code')}: ${code.split('').join(' ')}`}
        selectable
      >
        {code.slice(0, 4)} {code.slice(4)}
      </Text>
      <Text variant="caption" color="textMuted">
        {t('groups.inviteCodeHint')}
      </Text>
      <View style={styles.actions}>
        <Button label={t('groups.copy')} icon="copy" variant="secondary" size="sm" onPress={copy} />
        <Button label={t('groups.share')} icon="share-2" size="sm" onPress={share} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  code: { letterSpacing: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
