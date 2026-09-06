import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing } from '@/core/theme';

const HERO =
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=80';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();

  return (
    <View style={styles.root}>
      <Image
        source={{ uri: HERO }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={600}
      />
      <LinearGradient
        colors={['rgba(11,18,16,0.15)', 'rgba(11,18,16,0.55)', '#0B1210']}
        locations={[0, 0.5, 0.86]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.brand}>
          <View style={styles.logo}>
            <Icon name="mountain-snow" size={22} color="#06120B" strokeWidth={2.6} />
          </View>
          <Text variant="h3" color="#F2F7F4">
            {t('common.appName')}
          </Text>
        </Animated.View>

        <View style={{ flex: 1 }} />

        <Animated.View entering={FadeInUp.delay(250).duration(700)} style={styles.copy}>
          <View style={styles.pill}>
            <Icon name="sparkles" size={12} color="#5EE39B" strokeWidth={2.6} />
            <Text variant="label" weight="extrabold" color="#5EE39B">
              {t('common.tagline').toLocaleUpperCase(locale)}
            </Text>
          </View>
          <Text variant="display" color="#F2F7F4">
            {t('auth.welcomeTitle')}
          </Text>
          <Text variant="body" color="rgba(242,247,244,0.78)">
            {t('auth.welcomeSubtitle')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(450).duration(700)} style={styles.actions}>
          {/* Birincil yol: telefon numarası + SMS doğrulama */}
          <Button
            label={t('phoneAuth.continueWithPhone')}
            size="lg"
            fullWidth
            icon="phone"
            iconRight="arrow-right"
            onPress={() => router.push('/phone')}
            accessibilityLabel={t('phoneAuth.continueWithPhone')}
          />
          {/* İkincil yol: e-posta/şifre — sunucusuz geliştirme için korunur */}
          <Tappable
            onPress={() => router.push('/sign-in')}
            haptic="selection"
            style={styles.secondary}
            accessibilityRole="button"
            accessibilityLabel={t('phoneAuth.continueWithEmail')}
          >
            <Text variant="bodySm" weight="bold" color="rgba(242,247,244,0.7)">
              {t('phoneAuth.continueWithEmail')}
            </Text>
          </Tappable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1210' },
  content: { flex: 1, paddingHorizontal: spacing.xxl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: '#5EE39B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: spacing.md, marginBottom: spacing.xxxl },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: 'rgba(94,227,155,0.14)',
  },
  actions: { gap: spacing.lg },
  secondary: { alignItems: 'center', paddingVertical: spacing.xs },
});
