import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button, Header, Icon, Input, Screen, Tappable, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT, type TranslationKey } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  DEFAULT_COUNTRY_ISO2,
  PHONE_COUNTRIES,
  asOtpError,
  digitsOnly,
  findCountry,
  formatOtpCountdown,
  formatPhoneInput,
  validatePhone,
  type PhoneCountry,
} from '@/domain';
import { usePhoneAuthStore } from '@/features/auth/phoneAuth.store';
import { useSessionStore } from '@/features/auth/session.store';

/**
 * Telefonla kayıt — 1. adım: ülke kodu + numara.
 *
 * Numara `domain/phone.ts` kurallarıyla canlı biçimlendirilir; geçersizse
 * neyin yanlış olduğu (eksik hane, sabit hat, çok uzun) açıkça söylenir.
 * Kod isteme hız sınırına takılırsa kalan bekleme süresi gösterilir.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const { t } = useT();
  const toast = useToast();
  const { colors } = useTheme();

  const countryIso2 = usePhoneAuthStore((s) => s.countryIso2);
  const setCountry = usePhoneAuthStore((s) => s.setCountry);
  const start = usePhoneAuthStore((s) => s.start);
  const requestOtp = useSessionStore((s) => s.requestOtp);

  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const country = findCountry(countryIso2) ?? findCountry(DEFAULT_COUNTRY_ISO2);
  const display = formatPhoneInput(raw, country);
  const check = validatePhone(raw, countryIso2);

  /**
   * Numara ülkenin en uzun biçimine ulaştığı hâlde geçersizse hatayı beklemeden
   * gösterir (ör. sabit hat öneki). Düğme hiçbir zaman kilitlenmez: kullanıcı
   * "gönder"e basınca da nedeni açıkça görür.
   */
  const maxLength = country ? Math.max(...country.nsnLengths) : 15;
  const liveError =
    !check.valid && check.error && check.error !== 'empty' && raw.length >= maxLength
      ? t(`phoneAuth.errors.${check.error}` as TranslationKey)
      : null;

  const onChange = (value: string) => {
    setRaw(digitsOnly(value));
    if (error) setError(null);
  };

  const submit = async () => {
    const result = validatePhone(raw, countryIso2);
    if (!result.valid || !result.e164) {
      setError(t(`phoneAuth.errors.${result.error ?? 'invalidPhone'}` as TranslationKey));
      return;
    }

    setLoading(true);
    try {
      const challenge = await requestOtp({ phone: result.e164 });
      start(result.e164, challenge);
      router.push('/verify');
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
            <Text variant="h1">{t('phoneAuth.title')}</Text>
            <Text variant="body" color="textMuted">
              {t('phoneAuth.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <Text variant="caption" color="textMuted" style={styles.label}>
              {t('phoneAuth.numberLabel')}
            </Text>
            <View style={styles.row}>
              <Tappable
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={t('phoneAuth.countryLabel')}
                testID="country-picker-button"
                onPress={() => setPickerOpen(true)}
                style={[
                  styles.countryButton,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Text variant="body">{country?.flag ?? '🏳️'}</Text>
                <Text variant="body" weight="bold">
                  {country?.dialCode ?? '+'}
                </Text>
                <Icon name="chevron-down" size={16} color={colors.textSubtle} />
              </Tappable>

              <Input
                containerStyle={{ flex: 1 }}
                value={display}
                onChangeText={onChange}
                error={error ?? liveError}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder={country?.example ?? '555 555 55 55'}
                onSubmitEditing={submit}
                returnKeyType="go"
                testID="phone-input"
                accessibilityLabel={t('phoneAuth.numberLabel')}
              />
            </View>
            {!error && !liveError ? (
              <Text variant="caption" color="textSubtle" style={styles.helper}>
                {t('phoneAuth.smsNotice')}
              </Text>
            ) : null}
          </View>

          <Button
            label={t('phoneAuth.sendCode')}
            size="lg"
            fullWidth
            loading={loading}
            iconRight="arrow-right"
            onPress={submit}
            accessibilityLabel={t('phoneAuth.sendCode')}
          />

          <Text variant="caption" color="textSubtle" align="center">
            {t('phoneAuth.terms')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <CountryPicker
        open={pickerOpen}
        selected={countryIso2}
        onClose={() => setPickerOpen(false)}
        onSelect={(next) => {
          setCountry(next.iso2);
          setPickerOpen(false);
          setError(null);
        }}
      />
    </Screen>
  );
}

/** Ülke kodu seçici: ada, ISO koduna ya da arama koduna göre süzülür. */
function CountryPicker({
  open,
  selected,
  onClose,
  onSelect,
}: {
  open: boolean;
  selected: string;
  onClose: () => void;
  onSelect: (country: PhoneCountry) => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (c) =>
        c.name.toLocaleLowerCase('tr-TR').includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.dialCode.includes(q.replace('+', '')),
    );
  }, [query]);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
        <View style={styles.sheetHeader}>
          <Text variant="h3">{t('phoneAuth.countryPickerTitle')}</Text>
          <Tappable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="x" size={20} color={colors.textMuted} />
          </Tappable>
        </View>
        <Input
          icon="search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('phoneAuth.countrySearch')}
          autoCapitalize="none"
          testID="country-search"
        />
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetList}>
          {results.map((c) => (
            <Tappable
              key={c.iso2}
              haptic="selection"
              accessibilityRole="button"
              testID={`country-${c.iso2}`}
              onPress={() => onSelect(c)}
              style={[styles.countryRow, { borderBottomColor: colors.border }]}
            >
              <Text variant="body">{c.flag}</Text>
              <Text variant="body" style={{ flex: 1 }}>
                {c.name}
              </Text>
              <Text variant="bodySm" color="textMuted">
                {c.dialCode}
              </Text>
              {c.iso2 === selected ? (
                <Icon name="check" size={16} color={colors.primary} />
              ) : null}
            </Tappable>
          ))}
          {results.length === 0 ? (
            <Text variant="bodySm" color="textSubtle" style={{ padding: spacing.lg }}>
              {t('phoneAuth.countryEmpty')}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  heading: { gap: spacing.xs, marginTop: spacing.md },
  form: { gap: 0 },
  label: { marginBottom: spacing.xs + 2, marginLeft: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  helper: { marginTop: spacing.xs + 2, marginLeft: spacing.xs },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '80%',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetList: { maxHeight: 420 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
