import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Header, Input, Screen, Tappable, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { isValidEmail } from '@/core/utils/format';
import { useSessionStore } from '@/features/auth/session.store';

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useT();
  const toast = useToast();
  const signIn = useSessionStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = t('auth.invalidEmail');
    if (password.length < 6) next.password = t('auth.shortPassword');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await signIn({ email: email.trim(), password });
    } catch (error) {
      toast(error instanceof Error ? error.message : t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}>
            <Text variant="h1">{t('auth.signInTitle')}</Text>
            <Text variant="body" color="textMuted">
              {t('auth.signInSubtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.email')}
              icon="mail"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="sen@ornek.com"
            />
            <Input
              label={t('auth.password')}
              icon="lock"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secure
              autoComplete="password"
              textContentType="password"
              placeholder="••••••••"
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <Tappable
              haptic="selection"
              style={{ alignSelf: 'flex-end' }}
              accessibilityRole="button"
              accessibilityLabel={t('auth.forgotPassword')}
              onPress={() => toast(t('auth.demoHint'), 'info')}
            >
              <Text variant="caption" weight="bold" color="primary">
                {t('auth.forgotPassword')}
              </Text>
            </Tappable>
          </View>

          <Button label={t('auth.signIn')} size="lg" fullWidth loading={loading} onPress={submit} />

          <Text variant="caption" color="textSubtle" align="center">
            {t('auth.demoHint')}
          </Text>

          <Tappable
            onPress={() => router.replace('/sign-up')}
            haptic="selection"
            style={styles.switch}
            accessibilityRole="button"
          >
            <Text variant="bodySm" color="textMuted">
              {t('auth.noAccount')}{' '}
              <Text variant="bodySm" weight="bold" color="primary">
                {t('auth.signUp')}
              </Text>
            </Text>
          </Tappable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  heading: { gap: spacing.xs, marginTop: spacing.md },
  form: { gap: spacing.lg },
  switch: { alignItems: 'center', paddingVertical: spacing.sm },
});
