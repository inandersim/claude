import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { ADVENTURE_TYPE_META, canManageGroup, type GroupRole, type User } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { InviteCodeCard } from '@/features/groups/components/InviteCodeCard';
import { MemberRow } from '@/features/groups/components/MemberRow';
import {
  useGroup,
  useGroupMembers,
  useInviteCandidates,
  useInviteToGroup,
  useLeaveGroup,
  useSetRole,
  useToggleMute,
} from '@/features/groups/hooks';

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();

  const group = useGroup(id);
  const members = useGroupMembers(id);
  const leave = useLeaveGroup();
  const mute = useToggleMute(id);
  const setRole = useSetRole(id);
  const invite = useInviteToGroup(id);

  const [muted, setMuted] = useState<boolean | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [roleTarget, setRoleTarget] = useState<(User & { role: GroupRole }) | null>(null);
  const candidates = useInviteCandidates(inviteQuery);

  const onError = (e: unknown) =>
    toast(e instanceof Error ? e.message : t('common.error'), 'error');

  const g = group.data;
  const manager = canManageGroup(g?.membership ?? null);
  const isOwner = g?.membership === 'owner';
  const isChannel = g?.kind === 'channel';

  const onLeave = () =>
    leave.mutate(id, {
      onSuccess: () => {
        toast(t('groups.left'), 'info');
        router.replace('/groups');
      },
      onError,
    });

  const onMute = () =>
    mute.mutate(undefined, {
      onSuccess: (isMuted) => {
        setMuted(isMuted);
        toast(isMuted ? t('groups.muted') : t('groups.unmuted'), 'success');
      },
      onError,
    });

  const onInvite = (user: User) =>
    invite.mutate(user.id, {
      onSuccess: () => toast(t('groups.invited', { name: user.displayName }), 'success'),
      onError,
    });

  const changeRole = (role: GroupRole) => {
    if (!roleTarget) return;
    const target = roleTarget;
    setRoleTarget(null);
    setRole.mutate(
      { userId: target.id, role },
      { onSuccess: () => toast(t('groups.roleUpdated'), 'success'), onError },
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={isChannel ? t('groups.channelInfo') : t('groups.info')}
        showBack
        onBack={() => goBack(router, '/')}
      />
      {group.isLoading ? (
        <View style={styles.content}>
          <Skeleton width={96} height={96} round style={{ alignSelf: 'center' }} />
          <Skeleton width="70%" height={22} style={{ alignSelf: 'center' }} />
          <Skeleton height={80} />
          <Skeleton height={140} />
        </View>
      ) : group.isError ? (
        <ErrorState onRetry={() => group.refetch()} />
      ) : !g ? (
        <EmptyState icon="users" title={t('common.error')} />
      ) : (
        <View style={styles.content}>
          <View style={styles.hero}>
            <Avatar uri={g.avatarUrl} name={g.name} size={96} />
            <Text variant="h2" align="center">
              {g.name}
            </Text>
            <View style={styles.badges}>
              <Badge
                label={t(`groups.kind.${g.kind}`)}
                color={colors.primary}
                icon={isChannel ? 'radio' : 'users'}
              />
              <Badge
                label={t(`groups.privacy.${g.privacy}`)}
                color={g.privacy === 'private' ? colors.warning : colors.info}
                icon={g.privacy === 'private' ? 'lock' : 'globe'}
              />
              {g.membership ? (
                <Badge
                  label={t(`groups.role.${g.membership}`)}
                  color={colors.success}
                  icon="check"
                />
              ) : null}
            </View>
            <Text variant="caption" color="textMuted">
              {isChannel
                ? t('groups.subscriberCount', { count: formatCompact(g.memberCount, locale) })
                : t('groups.memberCount', { count: formatCompact(g.memberCount, locale) })}
              {g.city ? ` · ${g.city}` : ''}
            </Text>
          </View>

          {g.description ? (
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text variant="caption" weight="bold" color="textMuted">
                {t('groups.about')}
              </Text>
              <Text variant="body">{g.description}</Text>
              {g.adventureTypes.length ? (
                <View style={styles.chips}>
                  {g.adventureTypes.map((type) => {
                    const meta = ADVENTURE_TYPE_META[type];
                    return (
                      <Chip
                        key={type}
                        label={t(meta.labelKey)}
                        icon={meta.icon}
                        color={meta.color}
                        selected
                        size="sm"
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}

          {g.clubId ? (
            <Tappable
              onPress={() =>
                router.push({ pathname: '/clubs/[id]', params: { id: g.clubId as string } })
              }
              haptic="selection"
              style={[
                styles.linkRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('groups.openClub')}
            >
              <Icon name="graduation-cap" size={18} color={colors.primary} />
              <Text variant="title" style={{ flex: 1 }}>
                {t('groups.openClub')}
              </Text>
              <Icon name="chevron-right" size={16} color={colors.textSubtle} />
            </Tappable>
          ) : null}

          {g.membership && (g.privacy === 'private' || manager) ? (
            <InviteCodeCard code={g.inviteCode} groupName={g.name} />
          ) : null}

          {g.membership ? (
            <View style={styles.actions}>
              <Button
                label={muted ? t('groups.unmute') : t('groups.mute')}
                icon={muted ? 'bell-ring' : 'moon'}
                variant="secondary"
                size="sm"
                loading={mute.isPending}
                onPress={onMute}
                style={{ flex: 1 }}
              />
              <Button
                label={t('groups.invite')}
                icon="user-plus"
                size="sm"
                onPress={() => setInviteOpen(true)}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}

          <SectionHeader
            title={t('groups.members')}
            subtitle={manager && !isChannel ? t('groups.manageRoles') : undefined}
          />
          {members.isLoading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={44} />
              <Skeleton height={44} />
              <Skeleton height={44} />
            </View>
          ) : members.isError ? (
            <ErrorState onRetry={() => members.refetch()} />
          ) : (
            <View>
              {(members.data ?? []).map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isMe={m.id === me.id}
                  onPress={
                    manager && m.id !== me.id && m.role !== 'owner'
                      ? () => setRoleTarget(m)
                      : undefined
                  }
                />
              ))}
            </View>
          )}

          {g.membership ? (
            <View style={styles.leaveWrap}>
              {isOwner ? (
                <Text variant="caption" color="textMuted" align="center">
                  {t('groups.ownerCannotLeave')}
                </Text>
              ) : confirmLeave ? (
                <View style={styles.confirmRow}>
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    {t('groups.leaveConfirm')}
                  </Text>
                  <Button
                    label={t('common.cancel')}
                    variant="ghost"
                    size="sm"
                    onPress={() => setConfirmLeave(false)}
                  />
                  <Button
                    label={isChannel ? t('groups.leaveChannel') : t('groups.leave')}
                    variant="danger"
                    size="sm"
                    loading={leave.isPending}
                    onPress={onLeave}
                  />
                </View>
              ) : (
                <Button
                  label={isChannel ? t('groups.leaveChannel') : t('groups.leave')}
                  icon="log-out"
                  variant="danger"
                  fullWidth
                  onPress={() => setConfirmLeave(true)}
                />
              )}
            </View>
          ) : null}
        </View>
      )}

      {/* Davet: kullanıcı ara ve davet et */}
      <Modal
        visible={inviteOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setInviteOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.sheetHead}>
            <Text variant="h3" style={{ flex: 1 }}>
              {t('groups.invite')}
            </Text>
            <IconButton
              icon="x"
              variant="ghost"
              onPress={() => setInviteOpen(false)}
              accessibilityLabel={t('common.close')}
            />
          </View>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Input
              icon="search"
              placeholder={t('groups.inviteSearch')}
              value={inviteQuery}
              onChangeText={setInviteQuery}
              autoFocus
              autoCapitalize="none"
            />
          </View>
          <View style={styles.candidates}>
            {(candidates.data ?? []).map((u) => (
              <View key={u.id} style={[styles.candidateRow, { borderBottomColor: colors.border }]}>
                <Avatar uri={u.avatarUrl} name={u.displayName} size={40} verified={u.isVerified} />
                <View style={{ flex: 1 }}>
                  <Text variant="title" numberOfLines={1}>
                    {u.displayName}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    @{u.username}
                  </Text>
                </View>
                <Button
                  label={t('groups.invite')}
                  size="sm"
                  icon="user-plus"
                  onPress={() => onInvite(u)}
                />
              </View>
            ))}
          </View>
        </View>
      </Modal>

      {/* Rol değiştirme */}
      <Modal
        visible={roleTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleTarget(null)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setRoleTarget(null)}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: spacing.xxxl },
          ]}
        >
          <View style={styles.sheetHead}>
            <Text variant="h3" style={{ flex: 1 }}>
              {roleTarget?.displayName}
            </Text>
            <Text variant="caption" color="textMuted">
              {roleTarget ? t(`groups.role.${roleTarget.role}`) : ''}
            </Text>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {roleTarget?.role !== 'admin' ? (
              <Button
                label={t('groups.makeAdmin')}
                icon="shield-check"
                variant="secondary"
                fullWidth
                onPress={() => changeRole('admin')}
              />
            ) : null}
            {roleTarget?.role !== 'member' ? (
              <Button
                label={t('groups.makeMember')}
                icon="user"
                variant="secondary"
                fullWidth
                onPress={() => changeRole('member')}
              />
            ) : null}
            {isOwner ? (
              <Button
                label={t('groups.transferOwnership')}
                icon="crown"
                variant="danger"
                fullWidth
                onPress={() => changeRole('owner')}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  leaveWrap: { paddingTop: spacing.sm, gap: spacing.sm },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: '85%',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  candidates: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
