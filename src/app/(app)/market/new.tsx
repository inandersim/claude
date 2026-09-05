import * as ImagePicker from 'expo-image-picker';
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

import {
  AdventureImage,
  Button,
  Chip,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPES,
  ADVENTURE_TYPE_META,
  LISTING_CATEGORIES,
  LISTING_CATEGORY_META,
  LISTING_CONDITIONS,
  LISTING_CONDITION_META,
  type AdventureType,
  type ListingCategory,
  type ListingCondition,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useCreateListing } from '@/features/market/hooks';

export default function NewListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const create = useCreateListing();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ListingCategory>('equipment');
  const [condition, setCondition] = useState<ListingCondition>('good');
  const [types, setTypes] = useState<AdventureType[]>(me.favoriteTypes.slice(0, 1));
  const [locationName, setLocationName] = useState(me.locationName);
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const toggleType = (type: AdventureType) =>
    setTypes((list) => (list.includes(type) ? list.filter((x) => x !== type) : [...list, type]));

  const submit = () => {
    const next: typeof errors = {};
    const priceValue = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!title.trim()) next.title = t('market.titleRequired');
    if (!Number.isFinite(priceValue) || priceValue < 0) next.price = t('market.priceRequired');
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate(
      {
        title,
        description,
        priceTry: priceValue,
        category,
        condition,
        imageUri,
        locationName,
        adventureTypes: types,
      },
      {
        onSuccess: () => {
          toast(t('market.published'), 'success');
          goBack(router);
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('market.newListing')}
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
          showsVerticalScrollIndicator={false}
        >
          <Tappable
            onPress={pickImage}
            scaleTo={0.985}
            accessibilityRole="button"
            accessibilityLabel={t('post.addPhoto')}
          >
            {imageUri ? (
              <AdventureImage
                uri={imageUri}
                adventureType={types[0] ?? 'hiking'}
                style={styles.image}
              />
            ) : (
              <View
                style={[
                  styles.placeholder,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
                ]}
              >
                <View style={[styles.imageIcon, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="image-plus" size={26} color={colors.primary} strokeWidth={1.8} />
                </View>
                <Text variant="title">{t('post.addPhoto')}</Text>
              </View>
            )}
          </Tappable>

          <Input
            label={t('market.listingTitle')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('market.listingTitlePlaceholder')}
            error={errors.title}
          />
          <Input
            label={t('market.price')}
            icon="banknote"
            value={price}
            onChangeText={setPrice}
            placeholder="0"
            keyboardType="numeric"
            error={errors.price}
          />

          <View>
            <Text variant="caption" color="textMuted" style={styles.label}>
              {t('market.description')}
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
                placeholder={t('market.descriptionPlaceholder')}
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

          <Field title={t('market.category')}>
            <View style={styles.chips}>
              {LISTING_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={t(LISTING_CATEGORY_META[c].labelKey)}
                  icon={LISTING_CATEGORY_META[c].icon}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
          </Field>
          <Field title={t('market.condition')}>
            <View style={styles.chips}>
              {LISTING_CONDITIONS.map((c) => (
                <Chip
                  key={c}
                  size="sm"
                  label={t(LISTING_CONDITION_META[c].labelKey)}
                  color={LISTING_CONDITION_META[c].color}
                  selected={condition === c}
                  onPress={() => setCondition(c)}
                />
              ))}
            </View>
          </Field>
          <Field title={t('market.suitableFor')}>
            <View style={styles.chips}>
              {ADVENTURE_TYPES.map((type) => (
                <Chip
                  key={type}
                  size="sm"
                  label={t(ADVENTURE_TYPE_META[type].labelKey)}
                  icon={ADVENTURE_TYPE_META[type].icon}
                  color={ADVENTURE_TYPE_META[type].color}
                  selected={types.includes(type)}
                  onPress={() => toggleType(type)}
                />
              ))}
            </View>
          </Field>
          <Input
            label={t('post.location')}
            icon="map-pin"
            value={locationName}
            onChangeText={setLocationName}
            placeholder={t('post.locationPlaceholder')}
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
            label={t('market.publish')}
            icon="tag"
            size="lg"
            fullWidth
            loading={create.isPending}
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
      <Text variant="caption" color="textMuted" style={styles.label}>
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
  image: { aspectRatio: 1, borderRadius: radius.xl },
  placeholder: {
    aspectRatio: 16 / 9,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  imageIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginLeft: spacing.xs },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
