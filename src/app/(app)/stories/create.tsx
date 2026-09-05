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
import { ADVENTURE_TYPES, ADVENTURE_TYPE_META, type AdventureType } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useCreateStory } from '@/features/stories/hooks';

export default function CreateStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const create = useCreateStory();
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState(me.locationName);
  const [type, setType] = useState<AdventureType>(me.favoriteTypes[0] ?? 'hiking');
  const [error, setError] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true, aspect: [9, 16] })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsEditing: true,
          aspect: [9, 16],
        });
    if (!result.canceled && result.assets[0]) setMediaUri(result.assets[0].uri);
  };

  const submit = () => {
    if (!mediaUri && !caption.trim()) {
      setError(t('stories.photoRequired'));
      return;
    }
    create.mutate(
      { mediaUri, caption, adventureType: type, locationName },
      {
        onSuccess: () => {
          toast(t('stories.published'), 'success');
          goBack(router);
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('stories.create')}
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
          {mediaUri ? (
            <Tappable
              onPress={() => pick(false)}
              scaleTo={0.985}
              accessibilityRole="button"
              accessibilityLabel={t('post.addPhoto')}
            >
              <AdventureImage uri={mediaUri} adventureType={type} style={styles.preview} />
            </Tappable>
          ) : (
            <View
              style={[
                styles.placeholder,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
              ]}
            >
              <View style={styles.pickRow}>
                <IconButton
                  icon="image-plus"
                  size={56}
                  iconSize={24}
                  onPress={() => pick(false)}
                  accessibilityLabel={t('post.addPhoto')}
                />
                <IconButton
                  icon="camera"
                  size={56}
                  iconSize={24}
                  onPress={() => pick(true)}
                  accessibilityLabel={t('post.addPhoto')}
                />
              </View>
              <Text variant="title">{t('post.addPhoto')}</Text>
            </View>
          )}
          <View>
            <Text variant="caption" color="textMuted" style={{ marginLeft: spacing.xs }}>
              {t('stories.caption')}
            </Text>
            <View
              style={[
                styles.textarea,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: error ? colors.danger : colors.border,
                },
              ]}
            >
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder={t('stories.captionPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={200}
                style={[
                  styles.textareaInput,
                  { color: colors.text, fontFamily: fontFamily.medium },
                ]}
              />
            </View>
            {error ? (
              <Text
                variant="caption"
                color="danger"
                style={{ marginTop: 4, marginLeft: spacing.xs }}
              >
                {error}
              </Text>
            ) : null}
          </View>
          <Input
            label={t('post.location')}
            icon="map-pin"
            value={locationName}
            onChangeText={setLocationName}
          />
          <View style={styles.chips}>
            {ADVENTURE_TYPES.map((item) => {
              const meta = ADVENTURE_TYPE_META[item];
              return (
                <Chip
                  key={item}
                  size="sm"
                  label={t(meta.labelKey)}
                  icon={meta.icon}
                  color={meta.color}
                  selected={type === item}
                  onPress={() => setType(item)}
                />
              );
            })}
          </View>
          <View style={[styles.hint, { backgroundColor: colors.primarySoft }]}>
            <Icon name="clock" size={14} color={colors.primary} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('stories.subtitle')}
            </Text>
          </View>
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
            label={t('stories.publish')}
            icon="sparkles"
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

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  preview: { aspectRatio: 9 / 14, borderRadius: radius.xl },
  placeholder: {
    aspectRatio: 16 / 10,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  pickRow: { flexDirection: 'row', gap: spacing.md },
  textarea: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 90,
    marginTop: spacing.xs + 2,
  },
  textareaInput: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
