import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button, Header, Icon, Screen, Tappable, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT, type TranslationKey } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  OTP_LENGTH,
  asOtpError,
  formatOtpCountdown,
  maskPhone,
  sanitizeOtpInput,
} from '@/domain';
import { usePhoneAuthStore } from '@/features/auth/phoneAuth.store';
import { useSessionStore } from '@/features/auth/session.store';

/**
 * Saniyede bir tikleyen geri sayım; hedef ana kalan saniyeyi döner.
 *
 * Kalan süre render sırasında türetilir (`hedef - şimdi`); efekt yalnızca
 * saatin ilerlemesini bildirir. Böylece efekt gövdesinde setState yapılmaz.
 */
function useCountdown(targetIso: string | null | undefined): number {
  const target = targetIso ? new Date(targetIso).getTime() : 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!target) return 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/**
 * Telefonla kayıt — 2. adım: 6 haneli kod.
 *
 * · Kutular otomatik ilerler, yapıştırılan kod tek seferde dağıtılır.
 * · "Yeniden gönder" geri sayımlıdır (üstel bekleme, `domain/phone.ts`).
 * · Yanlış kodda kalan deneme sayısı, hak bitince kilit süresi gösterilir.
 * · Mock sağlayıcıda üretilen kod geliştirme rozetinde görünür.
 */
export default function VerifyScreen() {
  const router = useRouter();
  const { t } = useT();
  const toast = useToast();
  const { colors } = useTheme();

  const phone = usePhoneAuthStore((s) => s.phone);
  const challenge = usePhoneAuthStore((s) => s.challenge);
  const refresh = usePhoneAuthStore((s) => s.refresh);
  const verifyOtp = useSessionStore((s) => s.verifyOtp);
  const requestOtp = useSessionStore((s) => s.requestOtp);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const submittedRef = useRef('');

  const expiresIn = useCountdown(challenge?.expiresAt);
  const resendIn = useCountdown(challenge?.resendAvailableAt);
  const lockIn = useCountdown(lockedUntil);

  const locked = lockIn > 0;
  const expired = expiresIn === 0;
  const digits = useMemo(() => code.padEnd(OTP_LENGTH, ' ').split(''), [code]);

  // Numara yoksa (doğrudan URL ile gelinmişse) akışın başına dön.
  useEffect(() => {
    if (!phone) router.replace('/phone');
  }, [phone, router]);

  const submit = useCallback(
    async (value: string) => {
      if (!phone || loading || locked) return;
      submittedRef.current = value;
      setLoading(true);
      setError(null);
      try {
        const result = await verifyOtp({ phone, code: value });
        if (result.needsProfile) {
          router.replace('/complete-profile');
          return;
        }
        toast(t('phoneAuth.welcomeBack'), 'success');
      } catch (err) {
        const otpError = asOtpError(err);
        if (otpError) {
          setError(
            t(`phoneAuth.errors.${otpError.code}` as TranslationKey, {
              time: formatOtpCountdown(otpError.retryAfterSec ?? 0),
            }),
          );
          setAttemptsLeft(otpError.attemptsRemaining);
          if (otpError.code === 'locked' && otpError.retryAfterSec) {
            setLockedUntil(new Date(Date.now() + otpError.retryAfterSec * 1000).toISOString());
          }
        } else {
          toast(err instanceof Error ? err.message : t('common.error'), 'error');
        }
        setCode('');
      } finally {
        setLoading(false);
      }
    },
    [phone, loading, locked, verifyOtp, router, toast, t],
  );

  const onChange = (value: string) => {
    const next = sanitizeOtpInput(value);
    setCode(next);
    if (error) setError(null);
    // Son hane girildiğinde otomatik doğrula (aynı kodu iki kez göndermeden).
    if (next.length === OTP_LENGTH && next !== submittedRef.current) void submit(next);
  };

  const resend = async () => {
    if (!phone || resendIn > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const next = await requestOtp({ phone });
      refresh(next);
      setCode('');
      setAttemptsLeft(null);
      submittedRef.current = '';
      toast(t('phoneAuth.resent'), 'success');
    } catch (err) {
      const otpError = asOtpError(err);
      if (otpError) {
        setError(
          t(`phoneAuth.errors.${otpError.code}` as TranslationKey, {
            time: formatOtpCountdown(otpError.retryAfterSec ?? 0),
          }),
        );
      } else {
        toast(err instanceof Error ? err.message : t('common.error'), 'error');
      }
    } finally {
      setResending(false);
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
            <Text variant="h1">{t('phoneAuth.verifyTitle')}</Text>
            <Text variant="body" color="textMuted" testID="verify-subtitle">
              {t('phoneAuth.verifySubtitle', { phone: phone ? maskPhone(phone) : '' })}
            </Text>
          </View>

          {challenge?.devCode ? (
            <View
              testID="dev-code-badge"
              style={[
                styles.devBadge,
                { backgroundColor: colors.warningSoft, borderColor: colors.warning },
              ]}
            >
              <Icon name="shield-alert" size={16} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" weight="extrabold" color={colors.warning}>
                  {t('phoneAuth.devBadgeTitle')}
                </Text>
                <Text variant="h3" testID="dev-code-value">
                  {challenge.devCode}
                </Text>
                <Text variant="caption" color="textSubtle">
                  {t('phoneAuth.devBadgeHint')}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Görünmez tek giriş; kutular yalnızca görsel. Yapıştırma da çalışır. */}
          <View>
            <Tappable
              accessibilityRole="button"
              accessibilityLabel={t('phoneAuth.verifyTitle')}
              onPress={() => inputRef.current?.focus()}
              style={styles.boxes}
            >
              {digits.map((digit, index) => {
                const active = index === code.length;
                return (
                  <View
                    key={index}
                    testID={`code-box-${index}`}
                    style={[
                      styles.box,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: error
                          ? colors.danger
                          : active
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                  >
                    <Text variant="h2">{digit.trim()}</Text>
                  </View>
                );
              })}
            </Tappable>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={onChange}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={OTP_LENGTH}
              editable={!locked}
              autoFocus
              testID="code-input"
              accessibilityLabel={t('phoneAuth.verifyTitle')}
              style={styles.hiddenInput}
            />
          </View>

          {/* Kilitliyken aynı ileti iki kez çıkmasın: kilit satırı yeterli. */}
          {error && !locked ? (
            <Text variant="bodySm" color="danger" align="center" testID="verify-error">
              {error}
            </Text>
          ) : null}

          {locked ? (
            <Text variant="bodySm" color="danger" align="center" testID="verify-locked">
              {t('phoneAuth.lockedFor', { time: formatOtpCountdown(lockIn) })}
            </Text>
          ) : attemptsLeft !== null && attemptsLeft > 0 ? (
            <Text variant="bodySm" color="textMuted" align="center" testID="verify-attempts">
              {t('phoneAuth.attemptsLeft', { count: attemptsLeft })}
            </Text>
          ) : null}

          {!locked ? (
            <Text
              variant="caption"
              color={expired ? 'danger' : 'textSubtle'}
              align="center"
              testID="verify-expiry"
            >
              {expired
                ? t('phoneAuth.codeExpired')
                : t('phoneAuth.expiresIn', { time: formatOtpCountdown(expiresIn) })}
            </Text>
          ) : null}

          <Button
            label={t('phoneAuth.verifyAction')}
            size="lg"
            fullWidth
            loading={loading}
            disabled={code.length !== OTP_LENGTH || locked}
            onPress={() => submit(code)}
          />

          <Tappable
            onPress={resend}
            disabled={resendIn > 0 || resending || locked}
            haptic="selection"
            accessibilityRole="button"
            testID="resend-button"
            style={styles.resend}
          >
            <Text
              variant="bodySm"
              weight="bold"
              color={resendIn > 0 || locked ? 'textSubtle' : 'primary'}
              testID="resend-label"
            >
              {resendIn > 0
                ? t('phoneAuth.resendIn', { time: formatOtpCountdown(resendIn) })
                : t('phoneAuth.resend')}
            </Text>
          </Tappable>

          <Tappable
            onPress={() => router.replace('/phone')}
            haptic="selection"
            accessibilityRole="button"
            testID="change-number"
            style={styles.resend}
          >
            <Text variant="caption" color="textMuted">
              {t('phoneAuth.changeNumber')}
            </Text>
          </Tappable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  heading: { gap: spacing.xs, marginTop: spacing.md },
  devBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  boxes: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  box: {
    flex: 1,
    height: 58,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 58,
    opacity: 0,
    color: 'transparent',
  },
  resend: { alignItems: 'center', paddingVertical: spacing.xs },
});
