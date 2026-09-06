import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Header, Icon, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { INVITE_CODE_LENGTH, normalizeInviteCode } from '@/domain';
import { useJoinByCode } from '@/features/groups/hooks';

export default function JoinByCodeScreen() {
  const { code: initial } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const join = useJoinByCode();
  const [code, setCode] = useState(() => normalizeInviteCode(initial ?? ''));
  const [touched, setTouched] = useState(false);

  const normalized = normalizeInviteCode(code);
  const valid = normalized.length === INVITE_CODE_LENGTH;
  const error = touched && !valid ? t('groups.codeInvalid') : null;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    join.mutate(normalized, {
      onSuccess: (g) => {
        toast(t('groups.joinScreen.success'), 'success');
        router.replace({ pathname: '/groups/[id]', params: { id: g.id } });
      },
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('groups.joinScreen.title')} showBack onBack={() => goBack(router, '/')} />
      <View style={styles.content}>
        <View style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
          <Icon name="key-round" size={32} color={colors.primary} />
        </View>
        <Text variant="body" color="textMuted" align="center">
          {t('groups.joinScreen.subtitle')}
        </Text>
        <Input
          label={t('groups.code')}
          placeholder={t('groups.codePlaceholder')}
          value={code}
          onChangeText={(v) => setCode(normalizeInviteCode(v).slice(0, INVITE_CODE_LENGTH))}
          onBlur={() => setTouched(true)}
          error={error}
          hint={t('groups.codeHint')}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          maxLength={INVITE_CODE_LENGTH + 1}
          returnKeyType="go"
          onSubmitEditing={submit}
          style={styles.codeInput}
        />
        <Button
          label={t('groups.joinScreen.submit')}
          icon="arrow-right"
          size="lg"
          fullWidth
          disabled={!valid}
          loading={join.isPending}
          onPress={submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  hero: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInput: { letterSpacing: 4, fontSize: 20 },
});
