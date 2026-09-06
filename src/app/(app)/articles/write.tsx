import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  canPublish,
  COUNTRY_FLAG,
  parseTagInput,
  validateArticle,
  type AdventureType,
  type Article,
  type ArticleCategory,
  type ArticleValidation,
} from '@/domain';
import { CategoryChips } from '@/features/articles/components/CategoryChips';
import { MarkdownEditor } from '@/features/articles/components/MarkdownEditor';
import {
  useCreateArticle,
  useMyArticles,
  useMyWriterProfile,
  useUpdateArticle,
} from '@/features/articles/hooks';
import { useDestinations } from '@/features/destinations/hooks';

export default function WriteArticleScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useT();
  const profile = useMyWriterProfile();
  const mine = useMyArticles();
  const editing = Boolean(id);
  const article = editing ? mine.data?.find((a) => a.id === id) : undefined;
  const loading = profile.isLoading || (editing && mine.isLoading);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={editing ? t('articles.write.editTitle') : t('articles.write.title')}
        showBack
        onBack={() => goBack(router, '/explore')}
      />
      <View style={styles.content}>
        {profile.isError ? (
          <ErrorState onRetry={() => profile.refetch()} />
        ) : loading ? (
          <>
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={160} style={{ borderRadius: radius.xl }} />
          </>
        ) : !canPublish(profile.data) ? (
          <EmptyState
            icon="pencil"
            title={t('articles.write.notWriter')}
            description={
              profile.data ? t('articles.apply.pendingDescription') : t('articles.apply.intro')
            }
            action={{
              label: profile.data
                ? t('articles.apply.statusTitle')
                : t('articles.write.notWriterAction'),
              icon: 'user-plus',
              onPress: () => router.replace('/articles/apply'),
            }}
          />
        ) : editing && !article ? (
          <EmptyState
            icon="book-open"
            title={t('articles.notFound')}
            description={t('articles.write.cannotEdit')}
          />
        ) : (
          <ArticleForm key={article?.id ?? 'new'} initial={article} />
        )}
      </View>
    </Screen>
  );
}

function ArticleForm({ initial }: { initial: Article | undefined }) {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const create = useCreateArticle();
  const update = useUpdateArticle();
  const destinations = useDestinations({});

  const [title, setTitle] = useState(initial?.title ?? '');
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '');
  const [cover, setCover] = useState<string | null>(initial?.coverUrl ?? null);
  const [category, setCategory] = useState<ArticleCategory>(initial?.category ?? 'trip_report');
  const [tagsText, setTagsText] = useState(initial?.tags.join(', ') ?? '');
  const [destinationId, setDestinationId] = useState<string | null>(initial?.destinationId ?? null);
  const [countryCode, setCountryCode] = useState<string | null>(initial?.countryCode ?? null);
  const [types, setTypes] = useState<AdventureType[]>(initial?.adventureTypes ?? []);
  const [body, setBody] = useState(initial?.body ?? '');
  const [errors, setErrors] = useState<ArticleValidation>({});

  // Ülke chip'leri destinasyon listesinden türetilir (React Compiler memoize eder)
  const countrySet = new Set<string>();
  for (const d of destinations.data ?? []) countrySet.add(d.countryCode);
  if (initial?.countryCode) countrySet.add(initial.countryCode);
  const countries = [...countrySet].sort();

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets[0]) setCover(result.assets[0].uri);
  };

  const toggleType = (type: AdventureType) =>
    setTypes((list) => (list.includes(type) ? list.filter((x) => x !== type) : [...list, type]));

  const selectDestination = (destId: string, code: string) => {
    if (destinationId === destId) {
      setDestinationId(null);
      return;
    }
    setDestinationId(destId);
    setCountryCode(code);
  };

  const pending = create.isPending || update.isPending;
  const isPublishedAlready = Boolean(initial && initial.status !== 'draft');

  const submit = (publish: boolean) => {
    const next = validateArticle({ title, body });
    setErrors(next);
    if (next.title || next.body) return;
    const input = {
      title,
      subtitle,
      coverUri: cover,
      category,
      body,
      tags: parseTagInput(tagsText),
      destinationId,
      countryCode,
      adventureTypes: types,
      publish,
    };
    const onError = (e: unknown) =>
      toast(e instanceof Error ? e.message : t('common.error'), 'error');
    if (initial) {
      update.mutate(
        { id: initial.id, input },
        {
          onSuccess: (a) => {
            toast(
              publish
                ? isPublishedAlready
                  ? t('articles.write.updated')
                  : t('articles.write.published')
                : t('articles.write.draftSaved'),
              'success',
            );
            router.replace({ pathname: '/articles/[slug]', params: { slug: a.slug } });
          },
          onError,
        },
      );
      return;
    }
    create.mutate(input, {
      onSuccess: (a) => {
        toast(publish ? t('articles.write.published') : t('articles.write.draftSaved'), 'success');
        router.replace({ pathname: '/articles/[slug]', params: { slug: a.slug } });
      },
      onError,
    });
  };

  return (
    <>
      <Input
        label={t('articles.write.articleTitle')}
        placeholder={t('articles.write.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        error={errors.title ? t(`articles.write.validation.${errors.title}`) : null}
      />
      <Input
        label={t('articles.write.subtitle')}
        placeholder={t('articles.write.subtitlePlaceholder')}
        value={subtitle}
        onChangeText={setSubtitle}
      />

      <View style={styles.field}>
        <Text variant="label" color="textSubtle">
          {t('articles.write.cover').toLocaleUpperCase('tr-TR')}
        </Text>
        {cover ? (
          <View style={styles.coverWrap}>
            <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" />
            <View style={styles.coverActions}>
              <IconButton
                icon="image"
                variant="blur"
                onPress={() => {
                  pickCover().catch(() => undefined);
                }}
                accessibilityLabel={t('articles.write.changeCover')}
              />
              <IconButton
                icon="trash"
                variant="blur"
                onPress={() => setCover(null)}
                accessibilityLabel={t('articles.write.removeCover')}
              />
            </View>
          </View>
        ) : (
          <Tappable
            onPress={() => {
              pickCover().catch(() => undefined);
            }}
            style={[
              styles.coverPlaceholder,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('articles.write.addCover')}
          >
            <Icon name="image-plus" size={28} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {t('articles.write.addCover')}
            </Text>
          </Tappable>
        )}
      </View>

      <View style={styles.field}>
        <Text variant="label" color="textSubtle">
          {t('articles.write.category').toLocaleUpperCase('tr-TR')}
        </Text>
        <CategoryChips
          value={category}
          onChange={(c) => c && setCategory(c)}
          withAll={false}
          wrap
        />
      </View>

      <Input
        label={t('articles.write.tags')}
        placeholder={t('articles.write.tagsPlaceholder')}
        hint={t('articles.write.tagsHint')}
        value={tagsText}
        onChangeText={setTagsText}
        autoCapitalize="none"
        icon="tag"
      />

      <View style={styles.field}>
        <Text variant="label" color="textSubtle">
          {t('articles.write.destination').toLocaleUpperCase('tr-TR')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          <Chip
            label={t('articles.write.noDestination')}
            size="sm"
            selected={destinationId === null}
            onPress={() => setDestinationId(null)}
          />
          {(destinations.data ?? []).map((d) => (
            <Chip
              key={d.id}
              label={`${COUNTRY_FLAG(d.countryCode)} ${d.name}`}
              size="sm"
              selected={destinationId === d.id}
              onPress={() => selectDestination(d.id, d.countryCode)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.field}>
        <Text variant="label" color="textSubtle">
          {t('articles.write.country').toLocaleUpperCase('tr-TR')}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          <Chip
            label={t('articles.write.noCountry')}
            size="sm"
            selected={countryCode === null}
            onPress={() => setCountryCode(null)}
          />
          {countries.map((code) => (
            <Chip
              key={code}
              label={`${COUNTRY_FLAG(code)} ${code}`}
              size="sm"
              selected={countryCode === code}
              onPress={() => setCountryCode(countryCode === code ? null : code)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.field}>
        <Text variant="label" color="textSubtle">
          {t('articles.write.adventureTypes').toLocaleUpperCase('tr-TR')}
        </Text>
        <View style={styles.chips}>
          {ADVENTURE_TYPES.map((type) => (
            <Chip
              key={type}
              label={t(ADVENTURE_TYPE_META[type].labelKey)}
              icon={ADVENTURE_TYPE_META[type].icon}
              color={ADVENTURE_TYPE_META[type].color}
              size="sm"
              selected={types.includes(type)}
              onPress={() => toggleType(type)}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text variant="label" color="textSubtle">
          {t('articles.write.body').toLocaleUpperCase('tr-TR')}
        </Text>
        <MarkdownEditor
          value={body}
          onChange={setBody}
          error={errors.body ? t(`articles.write.validation.${errors.body}`) : null}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label={t('articles.write.saveDraft')}
          icon="file-down"
          variant="secondary"
          loading={pending && !create.variables?.publish && !update.variables?.input.publish}
          disabled={pending}
          onPress={() => submit(false)}
          style={{ flex: 1 }}
        />
        <Button
          label={isPublishedAlready ? t('articles.write.update') : t('articles.write.publish')}
          icon="send"
          loading={pending && Boolean(create.variables?.publish || update.variables?.input.publish)}
          disabled={pending}
          onPress={() => submit(true)}
          style={{ flex: 1 }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.huge,
  },
  field: { gap: spacing.sm },
  coverWrap: { borderRadius: radius.xl, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 16 / 9 },
  coverActions: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  coverPlaceholder: {
    height: 140,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chipScroll: { marginHorizontal: -spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
