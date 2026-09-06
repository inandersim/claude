import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Chip,
  ErrorState,
  Header,
  Icon,
  Input,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ARTICLE_CATEGORIES,
  topicMeta,
  validateWriterApplication,
  type ArticleCategory,
  type WriterProfile,
} from '@/domain';
import { WriterBadge } from '@/features/articles/components/WriterBadge';
import { useApplyWriter, useMyWriterProfile } from '@/features/articles/hooks';
import { useCurrentUser } from '@/features/auth/session.store';

export default function ApplyWriterScreen() {
  const router = useRouter();
  const { t } = useT();
  const profile = useMyWriterProfile();

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('articles.apply.title')}
        subtitle={t('articles.apply.subtitle')}
        showBack
        onBack={() => goBack(router, '/explore')}
      />
      <View style={styles.content}>
        {profile.isError ? (
          <ErrorState onRetry={() => profile.refetch()} />
        ) : profile.isLoading ? (
          <>
            <Skeleton height={80} style={{ borderRadius: radius.xl }} />
            <Skeleton height={48} />
            <Skeleton height={120} />
          </>
        ) : profile.data ? (
          <StatusCard profile={profile.data} />
        ) : (
          <ApplicationForm />
        )}
      </View>
    </Screen>
  );
}

function StatusCard({ profile }: { profile: WriterProfile }) {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const approved = Boolean(profile.approvedAt);
  return (
    <View
      style={[
        styles.status,
        {
          backgroundColor: approved ? colors.successSoft : colors.warningSoft,
          borderColor: approved ? colors.success : colors.warning,
        },
      ]}
    >
      <Icon
        name={approved ? 'circle-check' : 'hourglass'}
        size={28}
        color={approved ? colors.success : colors.warning}
      />
      <Text variant="label" color="textSubtle">
        {t('articles.apply.statusTitle').toLocaleUpperCase('tr-TR')}
      </Text>
      <Text variant="h3">
        {approved ? t('articles.apply.approved') : t('articles.apply.pending')}
      </Text>
      <Text variant="body" color="textMuted" align="center">
        {approved
          ? t('articles.apply.approvedDescription')
          : t('articles.apply.pendingDescription')}
      </Text>
      <View style={styles.statusMeta}>
        <WriterBadge writer={profile} />
        <Text variant="caption" color="textMuted">
          {profile.penName}
        </Text>
      </View>
      {approved ? (
        <Button
          label={t('articles.writeAction')}
          icon="pencil"
          fullWidth
          onPress={() => router.replace('/articles/write')}
        />
      ) : null}
    </View>
  );
}

function ApplicationForm() {
  const me = useCurrentUser();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const apply = useApplyWriter();
  const [penName, setPenName] = useState(me.displayName);
  const [bio, setBio] = useState('');
  const [languages, setLanguages] = useState('tr');
  const [topics, setTopics] = useState<ArticleCategory[]>([]);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validateWriterApplication>>({});

  const toggleTopic = (topic: ArticleCategory) =>
    setTopics((list) =>
      list.includes(topic) ? list.filter((x) => x !== topic) : [...list, topic],
    );

  const submit = () => {
    const next = validateWriterApplication({ penName, bio, topics });
    setErrors(next);
    if (Object.keys(next).length) return;
    apply.mutate(
      {
        penName,
        bio,
        languages: languages
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean),
        topics,
        website: website.trim() || null,
      },
      {
        onSuccess: () => toast(t('articles.apply.submitted'), 'success'),
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  return (
    <>
      <View style={[styles.intro, { backgroundColor: colors.primarySoft }]}>
        <Icon name="pencil" size={20} color={colors.primary} />
        <Text variant="bodySm" style={{ flex: 1 }}>
          {t('articles.apply.intro')}
        </Text>
      </View>
      <Input
        label={t('articles.apply.penName')}
        placeholder={t('articles.apply.penNamePlaceholder')}
        value={penName}
        onChangeText={setPenName}
        error={errors.penName ? t('articles.apply.validation.penName') : null}
        icon="user"
      />
      <Input
        label={t('articles.apply.bio')}
        placeholder={t('articles.apply.bioPlaceholder')}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
        style={{ minHeight: 96, textAlignVertical: 'top' }}
        error={errors.bio ? t('articles.apply.validation.bio') : null}
      />
      <Input
        label={t('articles.apply.languages')}
        hint={t('articles.apply.languagesHint')}
        value={languages}
        onChangeText={setLanguages}
        autoCapitalize="none"
        icon="languages"
      />
      <View style={styles.field}>
        <Text variant="label" color="textSubtle">
          {t('articles.apply.topics').toLocaleUpperCase('tr-TR')}
        </Text>
        <View style={styles.chips}>
          {ARTICLE_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={t(topicMeta[c].labelKey)}
              icon={topicMeta[c].icon}
              color={topicMeta[c].color}
              size="sm"
              selected={topics.includes(c)}
              onPress={() => toggleTopic(c)}
            />
          ))}
        </View>
        <Text variant="caption" color={errors.topics ? 'danger' : 'textSubtle'}>
          {errors.topics ? t('articles.apply.validation.topics') : t('articles.apply.topicsHint')}
        </Text>
      </View>
      <Input
        label={t('articles.apply.website')}
        placeholder={t('articles.apply.websitePlaceholder')}
        value={website}
        onChangeText={setWebsite}
        autoCapitalize="none"
        keyboardType="url"
        icon="globe"
      />
      <Button
        label={t('articles.apply.submit')}
        icon="send"
        fullWidth
        loading={apply.isPending}
        onPress={submit}
      />
      <Text variant="caption" color="textSubtle" align="center">
        {t('articles.apply.demoNote')}
      </Text>
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
    paddingBottom: spacing.xxl,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  field: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  status: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
