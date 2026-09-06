import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Input,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { filterSpecies } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { AnswerRow } from '@/features/wildlife/components/AnswerRow';
import { SpeciesCard } from '@/features/wildlife/components/SpeciesCard';
import {
  useAcceptAnswer,
  useAnswerWildlife,
  useSpecies,
  useUpvoteAnswer,
  useWildlifeQuestion,
} from '@/features/wildlife/hooks';

/** Soru detayı: tür tahmini kartı, cevaplar (5 sn canlı), cevap yazma, kabul ve oy. */
export default function WildlifeQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const [now] = useState(() => new Date());

  const question = useWildlifeQuestion(id);
  const answer = useAnswerWildlife(id);
  const upvote = useUpvoteAnswer(id);
  const accept = useAcceptAnswer(id);
  const allSpecies = useSpecies({});

  const [body, setBody] = useState('');
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const speciesOptions = useMemo(
    () => filterSpecies(allSpecies.data ?? [], { query: speciesQuery }).slice(0, 8),
    [allSpecies.data, speciesQuery],
  );
  const pickedSpecies = allSpecies.data?.find((s) => s.id === speciesId) ?? null;

  const q = question.data;
  const openSpecies = (sid: string) =>
    router.push({ pathname: '/wildlife/species/[id]', params: { id: sid } });

  const send = () => {
    if (!body.trim()) return;
    answer.mutate(
      { body: body.trim(), speciesId },
      {
        onSuccess: () => {
          setBody('');
          setSpeciesId(null);
          setShowPicker(false);
          toast(t('wildlife.question.sent'), 'success');
        },
        onError: () => toast(t('wildlife.question.sendError'), 'error'),
      },
    );
  };

  if (question.isError)
    return (
      <Screen edges={['top', 'bottom']}>
        <Header showBack />
        <ErrorState onRetry={() => void question.refetch()} />
      </Screen>
    );

  if (question.isLoading || !q)
    return (
      <Screen scroll edges={['top', 'bottom']}>
        <Header title={t('wildlife.question.title')} showBack />
        {question.isLoading ? (
          <View style={styles.content}>
            <Skeleton height={30} width="80%" />
            <Skeleton height={90} />
            <Skeleton height={120} />
          </View>
        ) : (
          <EmptyState icon="message-circle" title={t('wildlife.question.notFound')} />
        )}
      </Screen>
    );

  const isOwner = q.authorId === me.id;
  const statusColor =
    q.status === 'resolved'
      ? colors.success
      : q.status === 'answered'
        ? colors.info
        : colors.textMuted;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={t('wildlife.question.title')} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {q.urgent && q.status !== 'resolved' ? (
          <View
            style={[
              styles.banner,
              { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
            ]}
            accessibilityRole="alert"
          >
            <Icon name="siren" size={18} color={colors.danger} />
            <Text variant="bodySm" weight="bold" color={colors.danger} style={styles.flex}>
              {t('wildlife.question.urgentBanner')}
            </Text>
          </View>
        ) : null}

        <View style={styles.badges}>
          {q.urgent ? (
            <Badge
              label={t('wildlife.questions.urgent')}
              color={colors.danger}
              icon="siren"
              soft={false}
            />
          ) : null}
          <Badge label={t(`wildlife.questions.${q.status}`)} color={statusColor} />
          <View style={styles.online}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text variant="caption" color={colors.success} weight="bold">
              {t('wildlife.onlineHelpers', { count: q.onlineHelpers })}
            </Text>
          </View>
        </View>

        <Text variant="h2">{q.title}</Text>
        <View style={styles.author}>
          <Avatar
            uri={q.author.avatarUrl}
            name={q.author.displayName}
            size={28}
            verified={q.author.isVerified}
          />
          <Text variant="caption" color="textMuted" style={styles.flex} numberOfLines={1}>
            {q.author.displayName} · {formatRelative(q.createdAt, now, locale)} · {q.locationName}
          </Text>
        </View>
        {q.imageUrl ? (
          <Image
            source={{ uri: q.imageUrl }}
            style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
            contentFit="cover"
            accessibilityLabel={q.title}
          />
        ) : null}
        <Text variant="body">{q.body}</Text>

        {q.speciesGuess ? (
          <>
            <SectionHeader title={t('wildlife.question.guessTitle')} />
            <SpeciesCard species={q.speciesGuess} onPress={() => openSpecies(q.speciesGuess!.id)} />
          </>
        ) : null}

        <SectionHeader
          title={`${t('wildlife.question.answers')} (${q.answers.length})`}
          subtitle={t('wildlife.question.refreshing')}
        />
        {q.answers.length === 0 ? (
          <EmptyState icon="hourglass" title={t('wildlife.question.noAnswers')} compact />
        ) : (
          <View style={styles.list}>
            {q.answers.map((a) => (
              <AnswerRow
                key={a.id}
                answer={a}
                accepted={a.id === q.acceptedAnswerId}
                canAccept={isOwner && q.status !== 'resolved'}
                isQuestionAuthor={a.authorId === q.authorId}
                now={now}
                onUpvote={() =>
                  upvote.mutate(a.id, {
                    onError: () => toast(t('wildlife.question.upvoteError'), 'error'),
                  })
                }
                onAccept={() =>
                  accept.mutate(a.id, {
                    onSuccess: () => toast(t('wildlife.question.acceptedToast'), 'success'),
                    onError: () => toast(t('wildlife.question.acceptError'), 'error'),
                  })
                }
                onOpenSpecies={openSpecies}
              />
            ))}
          </View>
        )}

        <SectionHeader title={t('wildlife.question.write')} />
        <Input
          placeholder={t('wildlife.question.placeholder')}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={3}
          style={styles.textArea}
          editable={!answer.isPending}
        />
        {pickedSpecies ? (
          <View style={styles.pickedRow}>
            <Chip label={pickedSpecies.commonName} selected icon="search" size="sm" />
            <Button
              label={t('wildlife.question.clearSpecies')}
              variant="ghost"
              size="sm"
              icon="x"
              onPress={() => setSpeciesId(null)}
            />
          </View>
        ) : (
          <Button
            label={t('wildlife.question.pickSpecies')}
            variant="ghost"
            size="sm"
            icon={showPicker ? 'chevron-down' : 'search'}
            onPress={() => setShowPicker((v) => !v)}
            style={styles.selfStart}
          />
        )}
        {showPicker && !pickedSpecies ? (
          <View
            style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Input
              icon="search"
              placeholder={t('wildlife.ask.guessSearch')}
              value={speciesQuery}
              onChangeText={setSpeciesQuery}
            />
            <View style={styles.chips}>
              {speciesOptions.map((s) => (
                <Chip
                  key={s.id}
                  label={s.commonName}
                  size="sm"
                  onPress={() => {
                    setSpeciesId(s.id);
                    setShowPicker(false);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}
        <Button
          label={t('wildlife.question.send')}
          icon="send"
          onPress={send}
          loading={answer.isPending}
          disabled={!body.trim() || answer.isPending}
          fullWidth
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  online: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  list: { gap: spacing.sm },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selfStart: { alignSelf: 'flex-start' },
  picker: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
