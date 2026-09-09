import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  SkeletonGroup,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import {
  ASCENT_STYLES,
  COMMUNITY_CONFIRMATION_THRESHOLD,
  GRADE_SYSTEMS,
  canConfirm,
  effectiveSystem,
  formatGrade,
  gradeFamily,
  gradeVariants,
  gradesFor,
  type AscentStyle,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useUser } from '@/features/profile/hooks';
import { AscentRow } from '@/features/climbing/components/AscentRow';
import { GradeBadge } from '@/features/climbing/components/GradeBadge';
import { Stars } from '@/features/climbing/components/RouteRow';
import { VerificationBadge } from '@/features/climbing/components/VerificationBadge';
import {
  useAscents,
  useClimbingRoute,
  useConfirmRoute,
  useGradeSystem,
  useLogAscent,
} from '@/features/climbing/hooks';
import {
  ASCENT_STYLE_META,
  CLIMB_TYPE_META,
  GRADE_SYSTEM_LABEL_KEY,
} from '@/features/climbing/meta';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const { system } = useGradeSystem();
  const route = useClimbingRoute(id);
  const ascents = useAscents(id);
  const confirm = useConfirmRoute();
  const logAscent = useLogAscent();
  const [sheetOpen, setSheetOpen] = useState(false);

  const data = route.data;
  const displaySystem = data ? effectiveSystem(data.gradeSystem, system) : system;
  const variants = useMemo(
    () => (data ? gradeVariants(data.grade, data.gradeSystem) : null),
    [data],
  );
  // Repo onay listesini geri döndürmediği için kendi onayımız cihazda tutulur
  const confirmedByMe = data?.confirmedByMe ?? false;
  const myConfirmations = confirmedByMe && id ? [{ userId: me.id, routeId: id }] : [];
  const mayConfirm = data ? canConfirm(data, me.id, myConfirmations) : false;
  const alreadyConfirmed = confirmedByMe || confirm.isSuccess;
  const isMine = data?.submittedBy === me.id;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={data?.name ?? t('climbing.title')}
        subtitle={data ? `${data.crag.name} · ${data.sector.name}` : undefined}
        showBack
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {route.isError ? (
          <ErrorState onRetry={() => route.refetch()} />
        ) : route.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={140} style={{ borderRadius: radius.xl }} />
            <Skeleton height={90} style={{ borderRadius: radius.xl }} />
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : data && variants ? (
          <>
            <View
              style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <GradeBadge
                grade={formatGrade(data, displaySystem)}
                system={displaySystem}
                size="lg"
              />
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="h2">{data.name}</Text>
                <View style={styles.badges}>
                  <View
                    style={[
                      styles.typePill,
                      { backgroundColor: `${CLIMB_TYPE_META[data.type].color}22` },
                    ]}
                  >
                    <Icon
                      name={CLIMB_TYPE_META[data.type].icon}
                      size={12}
                      color={CLIMB_TYPE_META[data.type].color}
                      strokeWidth={2.4}
                    />
                    <Text variant="label" weight="bold" color={CLIMB_TYPE_META[data.type].color}>
                      {t(CLIMB_TYPE_META[data.type].labelKey)}
                    </Text>
                  </View>
                  <VerificationBadge status={data.verification} />
                </View>
                <View style={styles.starsRow}>
                  <Stars value={data.stars} size={13} />
                  <Text variant="caption" color="textSubtle">
                    · {t('climbing.ascentsCount', { count: data.ascentCount })}
                  </Text>
                </View>
              </View>
            </View>

            <Tappable
              onPress={() =>
                router.push({ pathname: '/climbing/[cragId]', params: { cragId: data.cragId } })
              }
              haptic="selection"
              style={[styles.cragLink, { backgroundColor: colors.surfaceMuted }]}
              accessibilityRole="button"
              accessibilityLabel={data.crag.name}
            >
              <Icon name="mountain" size={16} color={colors.primary} strokeWidth={2.4} />
              <Text variant="bodySm" weight="bold" style={{ flex: 1 }} numberOfLines={1}>
                {data.crag.name} · {data.sector.name}
              </Text>
              <Text variant="caption" color="textSubtle">
                {t('climbing.orientation')} {data.sector.orientation}
              </Text>
              <Icon name="chevron-right" size={16} color={colors.textSubtle} />
            </Tappable>

            {/* Derece karşılıkları */}
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text variant="title" style={{ marginBottom: spacing.sm }}>
                {t('climbing.gradeTable')}
              </Text>
              <View style={styles.gradeTable}>
                {GRADE_SYSTEMS.filter((s) => gradeFamily(s) === gradeFamily(data.gradeSystem)).map(
                  (s) => (
                    <View
                      key={s}
                      style={[
                        styles.gradeCell,
                        {
                          backgroundColor:
                            s === data.gradeSystem ? colors.primarySoft : colors.surfaceMuted,
                          borderColor: s === data.gradeSystem ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text variant="label" color="textSubtle">
                        {t(GRADE_SYSTEM_LABEL_KEY[s])}
                      </Text>
                      <Text variant="h3">{variants[s] ?? '–'}</Text>
                    </View>
                  ),
                )}
              </View>
            </View>

            <View
              style={[
                styles.facts,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {data.lengthM ? (
                <Fact icon="ruler" label={t('climbing.length')} value={`${data.lengthM} m`} />
              ) : null}
              <Fact
                icon="layers"
                label={t('climbing.pitches')}
                value={t('climbing.pitchesValue', { count: data.pitches })}
              />
              {data.bolts !== null ? (
                <Fact icon="anchor" label={t('climbing.bolts')} value={`${data.bolts}`} />
              ) : null}
              <Fact
                icon="flag"
                label={t('climbing.firstAscent')}
                value={data.firstAscent ?? '–'}
                last
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text variant="title">{t('climbing.description')}</Text>
              <Text variant="body" color="textMuted">
                {data.description || t('climbing.noDescription')}
              </Text>
            </View>

            <VerificationBadge
              status={data.verification}
              explained
              confirmations={data.confirmations}
              needed={COMMUNITY_CONFIRMATION_THRESHOLD}
            />

            {data.submittedBy ? (
              <SubmitterRow userId={data.submittedBy} createdAt={data.createdAt} />
            ) : null}

            <View style={styles.actions}>
              <Button
                label={t('climbing.logAscent')}
                icon="circle-check"
                size="lg"
                fullWidth
                onPress={() => setSheetOpen(true)}
              />
              {data.verification !== 'verified' ? (
                <>
                  <Button
                    label={alreadyConfirmed ? t('climbing.confirmed') : t('climbing.confirm')}
                    icon={alreadyConfirmed ? 'check-check' : 'shield-check'}
                    variant="secondary"
                    size="lg"
                    fullWidth
                    disabled={!mayConfirm || alreadyConfirmed}
                    loading={confirm.isPending}
                    onPress={() =>
                      confirm.mutate(data.id, {
                        onSuccess: () => toast(t('climbing.confirmedToast'), 'success'),
                        onError: () => toast(t('common.error'), 'error'),
                      })
                    }
                  />
                  <Text variant="caption" color="textSubtle" align="center">
                    {isMine
                      ? t('climbing.cannotConfirm')
                      : alreadyConfirmed
                        ? t('climbing.confirmedToast')
                        : t('climbing.confirmHint')}
                  </Text>
                </>
              ) : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="h3">{t('climbing.ascents')}</Text>
              {ascents.isError ? (
                <ErrorState onRetry={() => ascents.refetch()} />
              ) : ascents.isLoading ? (
                <SkeletonGroup>
                  <Skeleton height={72} style={{ borderRadius: radius.lg }} />
                  <Skeleton height={72} style={{ borderRadius: radius.lg }} />
                </SkeletonGroup>
              ) : (ascents.data ?? []).length === 0 ? (
                <EmptyState
                  compact
                  icon="footprints"
                  title={t('climbing.noAscents')}
                  description={t('climbing.noAscentsDescription')}
                />
              ) : (
                (ascents.data ?? []).map((a) => <AscentRow key={a.id} ascent={a} />)
              )}
            </View>
          </>
        ) : (
          <EmptyState
            icon="compass"
            title={t('notFound.contentTitle')}
            description={t('notFound.contentDescription')}
          />
        )}
      </ScrollView>

      {data ? (
        <LogAscentSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          routeName={data.name}
          gradeSystem={data.gradeSystem}
          grade={data.grade}
          pending={logAscent.isPending}
          onSubmit={(style, note, feltGrade) =>
            logAscent.mutate(
              { routeId: data.id, style, note, feltGrade },
              {
                onSuccess: () => {
                  setSheetOpen(false);
                  toast(t('climbing.ascentLogged'), 'success');
                },
                onError: () => toast(t('common.error'), 'error'),
              },
            )
          }
        />
      ) : null}
    </Screen>
  );
}

/** Rotayı gönderen kullanıcı satırı. */
function SubmitterRow({ userId, createdAt }: { userId: string; createdAt: string }) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const user = useUser(userId);
  return (
    <Tappable
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: userId } })}
      haptic="selection"
      style={[styles.submitter, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={t('climbing.submittedBy')}
    >
      {user.data ? (
        <Avatar
          uri={user.data.avatarUrl}
          name={user.data.displayName}
          size={36}
          verified={user.data.isVerified}
        />
      ) : (
        <View style={[styles.submitterIcon, { backgroundColor: colors.surfaceMuted }]}>
          <Icon name="user" size={18} color={colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text variant="caption" color="textSubtle">
          {t('climbing.submittedBy')}
        </Text>
        <Text variant="title" numberOfLines={1}>
          {user.data?.displayName ?? '…'}
        </Text>
      </View>
      <Text variant="caption" color="textSubtle">
        {formatRelative(createdAt, new Date(), locale)}
      </Text>
    </Tappable>
  );
}

/** Alt sayfa: stil seçimi, not ve hissedilen derece. */
function LogAscentSheet({
  visible,
  onClose,
  routeName,
  grade,
  gradeSystem,
  pending,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  routeName: string;
  grade: string;
  gradeSystem: (typeof GRADE_SYSTEMS)[number];
  pending: boolean;
  onSubmit: (style: AscentStyle, note: string, feltGrade: string | null) => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [style, setStyle] = useState<AscentStyle>('redpoint');
  const [note, setNote] = useState('');
  const [feltGrade, setFeltGrade] = useState<string | null>(null);
  const grades = gradesFor(gradeSystem);
  const baseIndex = grades.indexOf(grade);
  // Hissedilen derece için resmi derecenin ±3 komşusu
  const options = grades.slice(Math.max(0, baseIndex - 3), baseIndex + 4);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.sheetWrap, { pointerEvents: 'box-none' }]}
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceElevated, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{t('climbing.logAscentTitle')}</Text>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {routeName} · {grade}
              </Text>
            </View>
            <IconButton icon="x" onPress={onClose} accessibilityLabel={t('common.close')} />
          </View>

          <Text variant="caption" color="textMuted" style={styles.label}>
            {t('climbing.styleLabel')}
          </Text>
          <View style={styles.chips}>
            {ASCENT_STYLES.map((s) => (
              <Chip
                key={s}
                label={t(ASCENT_STYLE_META[s].labelKey)}
                icon={ASCENT_STYLE_META[s].icon}
                selected={style === s}
                onPress={() => setStyle(s)}
              />
            ))}
          </View>

          <Text variant="caption" color="textMuted" style={styles.label}>
            {t('climbing.feltGradeLabel')}
          </Text>
          <View style={styles.chips}>
            {options.map((g) => (
              <Chip
                key={g}
                size="sm"
                label={g}
                selected={feltGrade === g}
                onPress={() => setFeltGrade(feltGrade === g ? null : g)}
              />
            ))}
          </View>
          <Text variant="caption" color="textSubtle">
            {t('climbing.feltGradeHint')}
          </Text>

          <Text variant="caption" color="textMuted" style={styles.label}>
            {t('climbing.noteLabel')}
          </Text>
          <View
            style={[
              styles.textarea,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('climbing.notePlaceholder')}
              placeholderTextColor={colors.textSubtle}
              multiline
              maxLength={400}
              style={[styles.textareaInput, { color: colors.text, fontFamily: fontFamily.medium }]}
              accessibilityLabel={t('climbing.noteLabel')}
            />
          </View>

          <Button
            label={t('common.save')}
            icon="check"
            size="lg"
            fullWidth
            loading={pending}
            onPress={() => onSubmit(style, note, feltGrade)}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Fact({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.fact,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Icon name={icon} size={16} color={colors.textSubtle} />
      <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodySm" weight="bold" style={{ flexShrink: 1 }} align="right">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.full,
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cragLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.lg,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gradeTable: { flexDirection: 'row', gap: spacing.sm },
  gradeCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  facts: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  submitter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  submitterIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing.sm },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { marginTop: spacing.xs, marginLeft: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  textarea: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    minHeight: 84,
  },
  textareaInput: { fontSize: 15, paddingVertical: spacing.sm, minHeight: 80 },
});
