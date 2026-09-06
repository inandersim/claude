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
import { currentLocale, useT } from '@/core/i18n';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPES,
  ADVENTURE_TYPE_META,
  DIFFICULTY_GRADES,
  DIFFICULTY_META,
  TRAIL_CONDITIONS,
  TRAIL_CONDITION_META,
  type AdventureType,
  type DifficultyGrade,
  type TrailCondition,
} from '@/domain';
import { useCreatePost } from '@/features/feed/hooks';

interface Metric {
  key: 'altitudeM' | 'distanceKm' | 'temperatureC' | 'windKmh' | 'durationMin';
  label: string;
  unit: string;
  icon: 'mountain-snow' | 'route' | 'thermometer' | 'wind' | 'timer';
  color: string;
}

export default function NewPostScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const createPost = useCreatePost();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState('');
  const [adventureType, setAdventureType] = useState<AdventureType>('hiking');
  const [difficulty, setDifficulty] = useState<DifficultyGrade>('moderate');
  const [trailCondition, setTrailCondition] = useState<TrailCondition>('good');
  const [metrics, setMetrics] = useState<Record<Metric['key'], string>>({
    altitudeM: '',
    distanceKm: '',
    temperatureC: '',
    windKmh: '',
    durationMin: '',
  });
  const [errors, setErrors] = useState<{ caption?: string; locationName?: string }>({});

  const metricFields: Metric[] = [
    {
      key: 'altitudeM',
      label: t('home.altitude'),
      unit: 'm',
      icon: 'mountain-snow',
      color: '#6CB4FF',
    },
    { key: 'distanceKm', label: t('home.distance'), unit: 'km', icon: 'route', color: '#5EE39B' },
    {
      key: 'temperatureC',
      label: t('home.temperature'),
      unit: '°C',
      icon: 'thermometer',
      color: '#FFB547',
    },
    { key: 'windKmh', label: t('home.wind'), unit: 'km/s', icon: 'wind', color: '#CE93D8' },
    { key: 'durationMin', label: t('home.duration'), unit: 'dk', icon: 'timer', color: '#FF8A5B' },
  ];

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const parse = (value: string) => {
    const n = parseFloat(value.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!caption.trim()) next.caption = t('post.captionRequired');
    if (!locationName.trim()) next.locationName = t('post.locationRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    createPost.mutate(
      {
        caption,
        imageUri,
        locationName,
        adventureType,
        difficulty,
        trailCondition,
        altitudeM: Math.round(parse(metrics.altitudeM)),
        distanceKm: Math.round(parse(metrics.distanceKm) * 10) / 10,
        temperatureC: Math.round(parse(metrics.temperatureC)),
        windKmh: Math.round(parse(metrics.windKmh)),
        durationMin: Math.round(parse(metrics.durationMin)),
      },
      {
        onSuccess: () => {
          toast(t('post.published'), 'success');
          goBack(router);
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('post.newTitle')}
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
          {/* Fotoğraf */}
          <Tappable
            onPress={pickImage}
            scaleTo={0.985}
            accessibilityRole="button"
            accessibilityLabel={t('post.addPhoto')}
          >
            {imageUri ? (
              <AdventureImage
                uri={imageUri}
                adventureType={adventureType}
                style={styles.image}
                overlay
              >
                <View style={styles.changePhoto}>
                  <Icon name="camera" size={14} color="#FFFFFF" />
                  <Text variant="caption" weight="bold" color="#FFFFFF">
                    {t('post.changePhoto')}
                  </Text>
                </View>
              </AdventureImage>
            ) : (
              <View
                style={[
                  styles.imagePlaceholder,
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

          {/* Açıklama */}
          <View>
            <Text variant="caption" color="textMuted" style={styles.label}>
              {t('post.caption')}
            </Text>
            <View
              style={[
                styles.captionWrap,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: errors.caption ? colors.danger : colors.border,
                },
              ]}
            >
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={t('post.captionPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={800}
                style={[styles.caption, { color: colors.text, fontFamily: fontFamily.medium }]}
              />
            </View>
            {errors.caption ? (
              <Text variant="caption" color="danger" style={styles.helper}>
                {errors.caption}
              </Text>
            ) : null}
          </View>

          <Input
            label={t('post.location')}
            icon="map-pin"
            value={locationName}
            onChangeText={setLocationName}
            placeholder={t('post.locationPlaceholder')}
            error={errors.locationName}
          />

          {/* Macera türü */}
          <Section title={t('post.adventureType')}>
            <View style={styles.chips}>
              {ADVENTURE_TYPES.map((type) => {
                const meta = ADVENTURE_TYPE_META[type];
                return (
                  <Chip
                    key={type}
                    label={t(meta.labelKey)}
                    icon={meta.icon}
                    color={meta.color}
                    selected={adventureType === type}
                    onPress={() => setAdventureType(type)}
                  />
                );
              })}
            </View>
          </Section>

          {/* Zorluk */}
          <Section title={t('post.difficulty')}>
            <View style={styles.chips}>
              {DIFFICULTY_GRADES.map((grade) => {
                const meta = DIFFICULTY_META[grade];
                return (
                  <Chip
                    key={grade}
                    label={t(meta.labelKey)}
                    color={meta.color}
                    selected={difficulty === grade}
                    onPress={() => setDifficulty(grade)}
                    size="sm"
                  />
                );
              })}
            </View>
          </Section>

          {/* Rota durumu */}
          <Section title={t('post.trailCondition')}>
            <View style={styles.chips}>
              {TRAIL_CONDITIONS.map((condition) => {
                const meta = TRAIL_CONDITION_META[condition];
                return (
                  <Chip
                    key={condition}
                    label={t(meta.labelKey)}
                    color={meta.color}
                    selected={trailCondition === condition}
                    onPress={() => setTrailCondition(condition)}
                    size="sm"
                  />
                );
              })}
            </View>
          </Section>

          {/* Teknik veriler */}
          <Section title={t('post.metrics')}>
            <View style={styles.metricGrid}>
              {metricFields.map((field) => (
                <View
                  key={field.key}
                  style={[
                    styles.metric,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  ]}
                >
                  <Icon name={field.icon} size={16} color={field.color} strokeWidth={2.4} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label" color="textSubtle">
                      {field.label.toLocaleUpperCase(currentLocale())}
                    </Text>
                    <View style={styles.metricInputRow}>
                      <TextInput
                        value={metrics[field.key]}
                        onChangeText={(v) => setMetrics((m) => ({ ...m, [field.key]: v }))}
                        keyboardType="numbers-and-punctuation"
                        placeholder="0"
                        placeholderTextColor={colors.textSubtle}
                        style={[
                          styles.metricInput,
                          { color: colors.text, fontFamily: fontFamily.extrabold },
                        ]}
                        accessibilityLabel={field.label}
                      />
                      <Text variant="caption" color="textMuted">
                        {field.unit}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Section>
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
            label={t('post.publish')}
            size="lg"
            fullWidth
            icon="send"
            loading={createPost.isPending}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
  image: { aspectRatio: 4 / 3, borderRadius: radius.xl },
  imagePlaceholder: {
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
  changePhoto: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
  },
  label: { marginLeft: spacing.xs },
  captionWrap: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 110,
    marginTop: spacing.xs + 2,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  helper: { marginTop: spacing.xs + 2, marginLeft: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  metricInput: { fontSize: 18, minWidth: 40, paddingVertical: 2 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
