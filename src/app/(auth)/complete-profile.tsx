import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Header, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT, type TranslationKey } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { getDataProvider } from '@/data';
import {
  asOtpError,
  maskPhone,
  normalizeUsername,
  suggestUsernameFromPhone,
  validateDisplayName,
  validateUsername,
} from '@/domain';
import { usePhoneAuthStore } from '@/features/auth/phoneAuth.store';
import { useSessionStore } from '@/features/auth/session.store';

type Availability = 'idle' | 'checking' | 'free' | 'taken';

/**
 * Telefonla kayıt — 3. adım: görünen ad + kullanıcı adı.
 *
 * Yalnızca numarasını **ilk kez** doğrulayan kullanıcıya gösterilir. Kullanıcı
 * adı yazarken gecikmeli (400 ms) benzersizlik sorgusu yapılır; kayıt yine de
 * sunucuda benzersizlik kısıtıyla korunur (`profiles_username_key`).
 */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const { t } = useT();
  const toast = useToast();

  const phone = usePhoneAuthStore((s) => s.phone);
  const reset = usePhoneAuthStore((s) => s.reset);
  const completeProfile = useSessionStore((s) => s.completeProfile);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState(() =>
    phone ? suggestUsernameFromPhone(phone) : '',
  );
  const [errors, setErrors] = useState<{ displayName?: string; username?: string }>({});
  /** Sunucudan dönen son benzersizlik yanıtı (hangi ad için verildiği ile). */
  const [checked, setChecked] = useState<{ handle: string; free: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = normalizeUsername(username);
  const handleValid = validateUsername(handle) === null;

  useEffect(() => {
    if (!phone) router.replace('/phone');
  }, [phone, router]);

  // Kullanıcı adı benzersizliği: yazma durunca (400 ms) sorgulanır.
  useEffect(() => {
    if (!handleValid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      getDataProvider()
        .auth.isUsernameAvailable(handle)
        .then((free) => {
          if (!cancelled) setChecked({ handle, free });
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle, handleValid]);

  // Durum render sırasında türetilir: yanıt hâlâ yazılan ada aitse geçerlidir.
  const availability: Availability = !handleValid
    ? 'idle'
    : checked?.handle === handle
      ? checked.free
        ? 'free'
        : 'taken'
      : 'checking';

  const submit = async () => {
    if (!phone) return;
    const next: typeof errors = {};

    const nameError = validateDisplayName(displayName);
    if (nameError) {
      next.displayName = t(
        `phoneAuth.errors.displayName${nameError[0]!.toUpperCase()}${nameError.slice(1)}` as TranslationKey,
      );
    }
    const usernameError = validateUsername(handle);
    if (usernameError) {
      next.username = t(
        `phoneAuth.errors.username${usernameError[0]!.toUpperCase()}${usernameError.slice(1)}` as TranslationKey,
      );
    } else if (availability === 'taken') {
      next.username = t('phoneAuth.errors.usernameTaken');
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await completeProfile({ phone, displayName: displayName.trim(), username: handle });
      reset();
      toast(t('phoneAuth.accountCreated'), 'success');
    } catch (err) {
      const otpError = asOtpError(err);
      if (otpError?.code === 'usernameTaken') {
        setErrors({ username: t('phoneAuth.errors.usernameTaken') });
        setChecked({ handle, free: false });
      } else if (otpError?.code === 'notVerified') {
        toast(t('phoneAuth.errors.notVerified'), 'error');
        router.replace('/phone');
      } else {
        toast(err instanceof Error ? err.message : t('common.error'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const usernameHint =
    availability === 'checking'
      ? t('phoneAuth.usernameChecking')
      : availability === 'free'
        ? t('phoneAuth.usernameAvailable')
        : undefined;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}>
            <Text variant="h1">{t('phoneAuth.profileTitle')}</Text>
            <Text variant="body" color="textMuted">
              {t('phoneAuth.profileSubtitle')}
            </Text>
            {phone ? (
              <Text variant="caption" color="textSubtle" testID="verified-phone">
                {maskPhone(phone)}
              </Text>
            ) : null}
          </View>

          <View style={styles.form}>
            <Input
              label={t('phoneAuth.displayNameLabel')}
              icon="user"
              value={displayName}
              onChangeText={setDisplayName}
              error={errors.displayName}
              autoComplete="name"
              placeholder={t('phoneAuth.displayNamePlaceholder')}
              testID="display-name-input"
            />
            <Input
              label={t('phoneAuth.usernameLabel')}
              icon="at-sign"
              value={username}
              onChangeText={(value) => setUsername(normalizeUsername(value))}
              error={errors.username ?? (availability === 'taken' ? t('phoneAuth.usernameTakenHint') : undefined)}
              hint={usernameHint}
              autoCapitalize="none"
              placeholder={t('phoneAuth.usernamePlaceholder')}
              onSubmitEditing={submit}
              returnKeyType="go"
              testID="username-input"
            />
          </View>

          <Button
            label={t('phoneAuth.finish')}
            size="lg"
            fullWidth
            loading={loading}
            disabled={availability === 'taken'}
            onPress={submit}
            accessibilityLabel={t('phoneAuth.finish')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  heading: { gap: spacing.xs, marginTop: spacing.md },
  form: { gap: spacing.lg },
});
