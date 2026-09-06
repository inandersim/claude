import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Chip, Header, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  programKindMeta,
  validateSubmission,
  type AdventureType,
  type TvProgramKind,
  type TvSubmissionValidation,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useSubmitProgram } from '@/features/tv/hooks';

const COMMUNITY_CHANNEL_ID = 'ch_topluluk';
const SUBMIT_KINDS: TvProgramKind[] = ['short', 'documentary', 'tutorial', 'live_replay'];

export default function SubmitProgramScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const submit = useSubmitProgram();

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TvProgramKind>('short');
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [types, setTypes] = useState<AdventureType[]>(me.favoriteTypes.slice(0, 1));
  const [kidsFriendly, setKidsFriendly] = useState(false);
  const [credits, setCredits] = useState('');
  const [errors, setErrors] = useState<TvSubmissionValidation['errors']>({});

  const toggleType = (type: AdventureType) =>
    setTypes((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]));

  const onSubmit = () => {
    const durationMin = Number(duration.replace(',', '.'));
    const validation = validateSubmission({ title, videoUrl, durationMin, description, kind });
    setErrors(validation.errors);
    if (!validation.ok) return;
    submit.mutate(
      {
        channelId: COMMUNITY_CHANNEL_ID,
        title: title.trim(),
        kind,
        description: description.trim(),
        thumbnailUrl: null,
        videoUrl: videoUrl.trim(),
        durationMin,
        adventureTypes: types.length > 0 ? types : ['hiking'],
        destinationId: null,
        countryCode: 'TR',
        seriesTitle: null,
        episode: null,
        languages: ['tr'],
        subtitles: [],
        kidsFriendly,
        creditsNote: credits.trim() || `${me.displayName} (${t('tv.channelKind.community')})`,
      },
      {
        onSuccess: (program) => {
          toast(t('tv.submit.sent'), 'success');
          router.replace({ pathname: '/tv/watch/[id]', params: { id: program.id } });
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title={t('tv.submit.title')} subtitle={t('tv.submit.subtitle')} showBack />
        <View style={styles.content}>
          <Input
            label={t('tv.submit.titleLabel')}
            placeholder={t('tv.submit.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
            error={errors.title ? t(errors.title) : null}
            icon="video"
            maxLength={120}
          />

          <View style={styles.field}>
            <Text variant="caption" weight="bold" color="textMuted" style={styles.label}>
              {t('tv.submit.kindLabel')}
            </Text>
            <View style={styles.chips}>
              {SUBMIT_KINDS.map((k) => (
                <Chip
                  key={k}
                  label={t(programKindMeta[k].labelKey)}
                  icon={programKindMeta[k].icon}
                  color={programKindMeta[k].color}
                  size="sm"
                  selected={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </View>
          </View>

          <Input
            label={t('tv.submit.urlLabel')}
            placeholder={t('tv.submit.urlPlaceholder')}
            value={videoUrl}
            onChangeText={setVideoUrl}
            error={errors.videoUrl ? t(errors.videoUrl) : null}
            hint={t('tv.submit.urlHint')}
            icon="link"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Input
            label={t('tv.submit.durationLabel')}
            placeholder="12"
            value={duration}
            onChangeText={setDuration}
            error={errors.durationMin ? t(errors.durationMin) : null}
            icon="clock"
            keyboardType="numeric"
          />

          <Input
            label={t('tv.submit.descriptionLabel')}
            placeholder={t('tv.submit.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            error={errors.description ? t(errors.description) : null}
            multiline
            numberOfLines={4}
            style={styles.multiline}
            maxLength={2000}
          />

          <View style={styles.field}>
            <Text variant="caption" weight="bold" color="textMuted" style={styles.label}>
              {t('tv.submit.adventureTypes')}
            </Text>
            <View style={styles.chips}>
              {ADVENTURE_TYPES.map((type) => {
                const meta = ADVENTURE_TYPE_META[type];
                return (
                  <Chip
                    key={type}
                    label={t(meta.labelKey)}
                    icon={meta.icon}
                    color={meta.color}
                    size="sm"
                    selected={types.includes(type)}
                    onPress={() => toggleType(type)}
                  />
                );
              })}
            </View>
          </View>

          <Card style={styles.switchCard}>
            <View style={styles.switchText}>
              <Text variant="title" weight="bold">
                {t('tv.submit.kidsFriendly')}
              </Text>
              <Text variant="caption" color="textMuted">
                {t('tv.submit.kidsFriendlyHint')}
              </Text>
            </View>
            <Switch
              value={kidsFriendly}
              onValueChange={setKidsFriendly}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={t('tv.submit.kidsFriendly')}
            />
          </Card>

          <Input
            label={t('tv.submit.creditsLabel')}
            placeholder={t('tv.submit.creditsPlaceholder')}
            value={credits}
            onChangeText={setCredits}
            icon="stamp"
            maxLength={300}
          />

          <Button
            label={t('tv.submit.send')}
            icon="upload"
            onPress={onSubmit}
            loading={submit.isPending}
            fullWidth
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  field: { gap: spacing.sm },
  label: { marginLeft: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  switchCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchText: { flex: 1, gap: 2 },
});
