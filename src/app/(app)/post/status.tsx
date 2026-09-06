import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
  Avatar,
  Button,
  Chip,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import {
  activeToken,
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  MAX_STATUS_LENGTH,
  MAX_STATUS_PHOTOS,
  parseHashtags,
  replaceActiveToken,
  validateStatusInput,
  type AdventureType,
  type User,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { HashtagChip } from '@/features/social/components/HashtagChip';
import { ImageCarousel } from '@/features/social/components/ImageCarousel';
import { RichText } from '@/features/social/components/RichText';
import {
  HashtagSuggestions,
  MentionSuggestions,
  PhotoPickerGrid,
} from '@/features/social/components/StatusComposer';
import { useCreateStatus, useTrendingHashtags, useUserSearch } from '@/features/social/hooks';

export default function StatusPostScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const me = useCurrentUser();
  const createStatus = useCreateStatus();
  const trending = useTrendingHashtags(12);

  const [caption, setCaption] = useState('');
  const [cursor, setCursor] = useState(0);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [locationName, setLocationName] = useState('');
  const [adventureType, setAdventureType] = useState<AdventureType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => activeToken(caption, cursor), [caption, cursor]);
  const mentionQuery = token?.kind === 'mention' ? token.query : '';
  const users = useUserSearch(mentionQuery, token?.kind === 'mention');
  const hashtags = useMemo(() => parseHashtags(caption), [caption]);
  const previewType: AdventureType = adventureType ?? me.favoriteTypes[0] ?? 'hiking';

  const insert = (replacement: string) => {
    const next = replaceActiveToken(caption, cursor, replacement);
    setCaption(next.text);
    setCursor(next.cursor);
  };

  const appendHashtag = (tag: string) => {
    if (token?.kind === 'hashtag') return insert(`#${tag}`);
    const sep = caption.length === 0 || /\s$/.test(caption) ? '' : ' ';
    const next = `${caption}${sep}#${tag} `;
    setCaption(next);
    setCursor(next.length);
  };

  const pickUser = (user: User) => insert(`@${user.username}`);

  const submit = () => {
    const problem = validateStatusInput({ caption, imageUris });
    if (problem === 'captionRequired') return setError(t('social.status.captionRequired'));
    if (problem === 'photosLimit') {
      return setError(t('social.photosLimit', { max: MAX_STATUS_PHOTOS }));
    }
    if (problem === 'tooLong') return setError(t('social.status.tooLong'));
    setError(null);
    createStatus.mutate(
      {
        caption,
        imageUris,
        locationName: locationName.trim() || null,
        adventureType,
      },
      {
        onSuccess: () => {
          toast(t('social.status.published'), 'success');
          goBack(router);
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('social.status.title')}
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
          {/* Metin */}
          <View style={styles.composer}>
            <Avatar uri={me.avatarUrl} name={me.displayName} size={40} verified={me.isVerified} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <View
                style={[
                  styles.captionWrap,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: error ? colors.danger : colors.border,
                  },
                ]}
              >
                <TextInput
                  value={caption}
                  onChangeText={(v) => {
                    setCaption(v);
                    if (error) setError(null);
                  }}
                  onSelectionChange={(e) => setCursor(e.nativeEvent.selection.end)}
                  placeholder={t('social.status.placeholder')}
                  placeholderTextColor={colors.textSubtle}
                  multiline
                  autoFocus
                  maxLength={MAX_STATUS_LENGTH}
                  style={[styles.caption, { color: colors.text, fontFamily: fontFamily.medium }]}
                  accessibilityLabel={t('social.status.placeholder')}
                />
              </View>
              <View style={styles.captionMeta}>
                <Text variant="caption" color={error ? 'danger' : 'textSubtle'} style={{ flex: 1 }}>
                  {error ?? `${t('social.hashtagHint')} · ${t('social.mentionHint')}`}
                </Text>
                <Text variant="caption" color="textSubtle">
                  {t('social.status.charCount', { count: caption.length, max: MAX_STATUS_LENGTH })}
                </Text>
              </View>
              {token?.kind === 'mention' ? (
                <MentionSuggestions users={users.data ?? []} onPick={pickUser} />
              ) : null}
            </View>
          </View>

          {/* Etiket önerileri */}
          {trending.data && trending.data.length > 0 ? (
            <Section title={t('social.status.suggestions')}>
              <HashtagSuggestions
                tags={trending.data.filter((h) => !hashtags.includes(h.tag))}
                query={token?.kind === 'hashtag' ? token.query : ''}
                onPick={appendHashtag}
              />
            </Section>
          ) : null}

          {/* Fotoğraflar */}
          <Section title={t('social.status.photos')}>
            <PhotoPickerGrid
              uris={imageUris}
              onChange={setImageUris}
              adventureType={previewType}
              onLimit={() => toast(t('social.photosLimit', { max: MAX_STATUS_PHOTOS }), 'info')}
            />
          </Section>

          {/* Konum */}
          <Input
            label={t('social.status.location')}
            icon="map-pin"
            value={locationName}
            onChangeText={setLocationName}
            placeholder={t('social.status.locationPlaceholder')}
          />

          {/* Macera türü (isteğe bağlı) */}
          <Section title={t('social.status.adventureType')}>
            <View style={styles.chips}>
              <Chip
                label={t('social.status.none')}
                selected={adventureType === null}
                onPress={() => setAdventureType(null)}
                size="sm"
              />
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
                    size="sm"
                  />
                );
              })}
            </View>
          </Section>

          {/* Önizleme */}
          {caption.trim() || imageUris.length > 0 ? (
            <Section title={t('social.status.preview')}>
              <View
                style={[
                  styles.preview,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.previewHead}>
                  <Avatar uri={me.avatarUrl} name={me.displayName} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" weight="bold">
                      {me.displayName}
                    </Text>
                    <View style={styles.previewMeta}>
                      <Icon name="map-pin" size={11} color={colors.textSubtle} />
                      <Text variant="caption" color="textMuted" numberOfLines={1}>
                        {locationName.trim() || me.locationName}
                      </Text>
                    </View>
                  </View>
                </View>
                {imageUris.length > 0 ? (
                  <ImageCarousel images={imageUris} adventureType={previewType} />
                ) : null}
                {caption.trim() ? <RichText text={caption} interactive={false} /> : null}
                {hashtags.length > 0 ? (
                  <View style={styles.chips}>
                    {hashtags.map((tag) => (
                      <HashtagChip key={tag} tag={tag} size="sm" onPress={() => undefined} />
                    ))}
                  </View>
                ) : null}
              </View>
            </Section>
          ) : null}
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
            label={t('social.status.publish')}
            size="lg"
            fullWidth
            icon="send"
            loading={createStatus.isPending}
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
  composer: { flexDirection: 'row', gap: spacing.sm + 2, alignItems: 'flex-start' },
  captionWrap: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 120,
  },
  caption: {
    fontSize: 16,
    lineHeight: 23,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    minHeight: 110,
  },
  captionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  label: { marginLeft: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preview: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
