import { useRouter } from 'expo-router';
import { goBack } from '@/core/navigation';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Header, IconButton, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPES,
  ADVENTURE_TYPE_META,
  BUSINESS_TYPES,
  BUSINESS_TYPE_META,
  type AdventureType,
  type BusinessType,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useRegisterBusiness } from '@/features/stays/hooks';

export default function RegisterBusinessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const register = useRegisterBusiness();
  const [name, setName] = useState('');
  const [type, setType] = useState<BusinessType>('pension');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState(me.locationName);
  const [price, setPrice] = useState('');
  const [amenities, setAmenities] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [types, setTypes] = useState<AdventureType[]>(me.favoriteTypes.slice(0, 2));
  const [error, setError] = useState<string | null>(null);
  const isStay = BUSINESS_TYPE_META[type].stay;

  const submit = () => {
    if (!name.trim()) return setError(t('stays.nameRequired'));
    setError(null);
    const priceValue = parseFloat(price.replace(',', '.'));
    register.mutate(
      {
        name,
        type,
        description,
        locationName,
        priceFromTry: isStay && Number.isFinite(priceValue) ? Math.round(priceValue) : null,
        amenities: amenities
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        adventureTypes: types,
        phone: phone.trim() || null,
        website: website.trim() || null,
      },
      {
        onSuccess: () => {
          toast(t('stays.registered'), 'success');
          router.replace('/plans');
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('stays.registerTitle')}
        right={
          <IconButton
            icon="x"
            onPress={() => goBack(router)}
            accessibilityLabel={t('common.close')}
          />
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label={t('stays.businessName')}
            icon="store"
            value={name}
            onChangeText={setName}
            placeholder={t('stays.businessNamePlaceholder')}
            error={error}
          />
          <Field title={t('stays.businessType')}>
            <View style={styles.chips}>
              {BUSINESS_TYPES.map((b) => (
                <Chip
                  key={b}
                  label={t(BUSINESS_TYPE_META[b].labelKey)}
                  icon={BUSINESS_TYPE_META[b].icon}
                  selected={type === b}
                  onPress={() => setType(b)}
                />
              ))}
            </View>
          </Field>
          <View>
            <Text variant="caption" color="textMuted" style={{ marginLeft: spacing.xs }}>
              {t('stays.description')}
            </Text>
            <View
              style={[
                styles.textarea,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('stays.descriptionPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={800}
                style={[
                  styles.textareaInput,
                  { color: colors.text, fontFamily: fontFamily.medium },
                ]}
              />
            </View>
          </View>
          <Input
            label={t('post.location')}
            icon="map-pin"
            value={locationName}
            onChangeText={setLocationName}
          />
          {isStay ? (
            <Input
              label={t('stays.nightlyPrice')}
              icon="banknote"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="1500"
            />
          ) : null}
          <Input
            label={t('stays.amenitiesLabel')}
            icon="sparkles"
            value={amenities}
            onChangeText={setAmenities}
            placeholder={t('stays.amenitiesPlaceholder')}
          />
          <Field title={t('stays.suitableFor')}>
            <View style={styles.chips}>
              {ADVENTURE_TYPES.map((a) => (
                <Chip
                  key={a}
                  size="sm"
                  label={t(ADVENTURE_TYPE_META[a].labelKey)}
                  icon={ADVENTURE_TYPE_META[a].icon}
                  color={ADVENTURE_TYPE_META[a].color}
                  selected={types.includes(a)}
                  onPress={() =>
                    setTypes((l) => (l.includes(a) ? l.filter((x) => x !== a) : [...l, a]))
                  }
                />
              ))}
            </View>
          </Field>
          <Input
            label={t('library.phone')}
            icon="mail"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+90 …"
          />
          <Input
            label={t('library.website')}
            icon="globe"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://"
          />
        </ScrollView>
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <Button
            label={t('stays.register')}
            icon="store"
            size="lg"
            fullWidth
            loading={register.isPending}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" color="textMuted" style={{ marginLeft: spacing.xs }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  textarea: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 100,
    marginTop: spacing.xs + 2,
  },
  textareaInput: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
