import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Header, Input, Screen, Tappable, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { isValidEmail } from '@/core/utils/format';
import { useSessionStore } from '@/features/auth/session.store';

export default function SignUpScreen() {
  const router = useRouter();
  const { t } = useT();
  const toast = useToast();
  const signUp = useSessionStore((s) => s.signUp);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!displayName.trim()) next.displayName = t('auth.requiredField');
    if (!username.trim()) next.username = t('auth.requiredField');
    if (!isValidEmail(email)) next.email = t('auth.invalidEmail');
    if (password.length < 6) next.password = t('auth.shortPassword');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        username: username.trim(),
        displayName: displayName.trim(),
      });
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
            <Text variant="h1">{t('auth.signUpTitle')}</Text>
            <Text variant="body" color="textMuted">
              {t('auth.signUpSubtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.displayName')}
              icon="user"
              value={displayName}
              onChangeText={setDisplayName}
              error={errors.displayName}
              autoComplete="name"
              placeholder="Deniz Kaya"
            />
            <Input
              label={t('auth.username')}
              icon="at-sign"
              value={username}
              onChangeText={(v) => setUsername(v.replace(/[^a-z0-9._]/gi, '').toLowerCase())}
              error={errors.username}
              autoCapitalize="none"
              placeholder="deniz.kaya"
            />
            <Input
              label={t('auth.email')}
              icon="mail"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="sen@ornek.com"
            />
            <Input
              label={t('auth.password')}
              icon="lock"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secure
              autoComplete="new-password"
              placeholder="••••••••"
              onSubmitEditing={submit}
              returnKeyType="go"
            />
          </View>

          <Button label={t('auth.signUp')} size="lg" fullWidth loading={loading} onPress={submit} />

          <Text variant="caption" color="textSubtle" align="center">
            {t('auth.termsHint')}
          </Text>

          <Tappable
            onPress={() => router.replace('/sign-in')}
            haptic="selection"
            style={styles.switch}
            accessibilityRole="button"
          >
            <Text variant="bodySm" color="textMuted">
              {t('auth.haveAccount')}{' '}
              <Text variant="bodySm" weight="bold" color="primary">
                {t('auth.signIn')}
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
