import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useSession } from '../auth/session';
import { ConfirmDialog, Modal, useConfirm } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  KeyValue,
  Loading,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui';
import { adminApi } from '../data';
import type { Plan } from '@/domain';
import type { AdminRole } from '../data/adminApi';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDate, formatDateTime, formatNumber, formatRelative } from '../utils/format';

const PLANS: Plan[] = ['free', 'pro', 'pro_guide', 'business'];
const ROLES: AdminRole[] = ['admin', 'moderator', 'editor', 'support'];

export function UserDetailPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();

  const [roleModal, setRoleModal] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [roleValue, setRoleValue] = useState<string>('none');
  const [planValue, setPlanValue] = useState<Plan>('free');
  const [reason, setReason] = useState('');
  const [noteText, setNoteText] = useState('');

  const query = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminApi.users.get(id) });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'user', id] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };

  const statusMutation = useMutation({
    mutationFn: (input: { status: 'active' | 'suspended' | 'banned'; reason: string; days?: number }) =>
      adminApi.users.setStatus(id, input.status, input.reason, input.days),
    onSuccess: () => {
      notify(t('users.saved'));
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const roleMutation = useMutation({
    mutationFn: (input: { role: AdminRole | null; reason: string }) => adminApi.users.setRole(id, input.role, input.reason),
    onSuccess: () => {
      notify(t('users.saved'));
      setRoleModal(false);
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const planMutation = useMutation({
    mutationFn: (input: { plan: Plan; reason: string }) => adminApi.users.setPlan(id, input.plan, input.reason),
    onSuccess: () => {
      notify(t('users.saved'));
      setPlanModal(false);
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const revokeMutation = useMutation({
    mutationFn: (input: { reason: string }) => adminApi.users.revokeSessions(id, input.reason),
    onSuccess: () => {
      notify(t('users.saved'));
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const noteMutation = useMutation({
    mutationFn: (text: string) => adminApi.users.addNote(id, text),
    onSuccess: () => {
      notify(t('users.saved'));
      setNoteModal(false);
      setNoteText('');
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} />;
  const user = query.data;
  if (!user) return <Card>{t('app.empty')}</Card>;

  return (
    <>
      <PageHeader
        title={user.displayName}
        subtitle={`@${user.username} · ${user.email}`}
        actions={
          <Link to="/users" className="btn btn-secondary">
            ← {t('users.backToList')}
          </Link>
        }
      />

      <div className="grid grid-3" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gridColumn: 'span 2' }}>
          <Card title={t('users.detail.profile')}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
              <Avatar src={user.avatarUrl} alt={user.displayName} large />
              <div className="col" style={{ flex: 1, gap: 8 }}>
                <div className="row-tight">
                  <Badge tone={user.status === 'active' ? 'success' : user.status === 'suspended' ? 'warning' : 'danger'}>
                    {t(`users.status.${user.status}` as AdminTranslationKey)}
                  </Badge>
                  <Badge tone="accent">{t(`plan.${user.plan}` as AdminTranslationKey)}</Badge>
                  {user.role ? <Badge tone="info">{t(`role.${user.role}` as AdminTranslationKey)}</Badge> : null}
                  {user.phoneVerified ? <Badge tone="success">{t('users.phone.verified')}</Badge> : <Badge>{t('users.phone.unverified')}</Badge>}
                </div>
                <p className="muted small">{user.bio}</p>
                <KeyValue
                  items={[
                    { label: t('common.location'), value: `${user.locationName} (${user.countryCode})` },
                    { label: t('users.col.phone'), value: <span className="mono">{user.phone}</span> },
                    { label: t('users.col.joined'), value: formatDate(user.joinedAt, localeTag) },
                    { label: t('users.col.lastSeen'), value: formatRelative(user.lastSeenAt, localeTag) },
                    { label: t('users.detail.trust'), value: `${user.trustScore} / 100` },
                    ...(user.suspendedUntil
                      ? [{ label: t('users.detail.suspendedUntil'), value: formatDateTime(user.suspendedUntil, localeTag) }]
                      : []),
                    ...(user.statusReason ? [{ label: t('users.detail.statusReason'), value: user.statusReason }] : []),
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card title={t('users.detail.stats')}>
            <div className="grid grid-4">
              <Stat label={t('users.detail.distance')} value={`${formatNumber(user.totalDistanceKm, localeTag)} km`} />
              <Stat label={t('users.detail.adventures')} value={formatNumber(user.totalAdventures, localeTag)} />
              <Stat label={t('users.detail.followers')} value={formatNumber(user.followersCount, localeTag)} />
              <Stat label={t('users.detail.following')} value={formatNumber(user.followingCount, localeTag)} />
            </div>
          </Card>

          <Card title={t('users.detail.activity')}>
            <div className="timeline">
              {user.recentActivity.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <div className="timeline-dot" />
                  <div>
                    <div>{item.summary}</div>
                    <div className="small muted">
                      {item.kind} · {formatDateTime(item.at, localeTag)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            title={t('users.detail.notes')}
            actions={
              can('users.note') ? (
                <Button size="sm" onClick={() => setNoteModal(true)}>
                  {t('users.action.note')}
                </Button>
              ) : null
            }
          >
            {user.notes.length === 0 ? (
              <p className="muted small">{t('app.empty')}</p>
            ) : (
              <div className="col">
                {user.notes.map((note) => (
                  <div key={note.id}>
                    <div>{note.text}</div>
                    <div className="small muted">
                      {note.author} · {formatDateTime(note.at, localeTag)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="col">
          <Card title={t('common.actions')}>
            <div className="col">
              {can('users.moderate') && user.status === 'active' ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      confirm({
                        title: t('users.confirm.suspend'),
                        description: user.displayName,
                        reasonRequired: true,
                        danger: true,
                        confirmLabel: t('users.action.suspend'),
                        onConfirm: (value) => statusMutation.mutateAsync({ status: 'suspended', reason: value, days: 7 }),
                      })
                    }
                  >
                    {t('users.action.suspend')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      confirm({
                        title: t('users.confirm.ban'),
                        description: user.displayName,
                        reasonRequired: true,
                        danger: true,
                        confirmLabel: t('users.action.ban'),
                        onConfirm: (value) => statusMutation.mutateAsync({ status: 'banned', reason: value }),
                      })
                    }
                  >
                    {t('users.action.ban')}
                  </Button>
                </>
              ) : null}
              {can('users.moderate') && user.status !== 'active' ? (
                <Button
                  variant="primary"
                  onClick={() =>
                    confirm({
                      title: t('users.confirm.activate'),
                      description: user.displayName,
                      confirmLabel: t('users.action.activate'),
                      onConfirm: (value) => statusMutation.mutateAsync({ status: 'active', reason: value }),
                    })
                  }
                >
                  {t('users.action.activate')}
                </Button>
              ) : null}
              {can('users.role') ? (
                <Button
                  onClick={() => {
                    setRoleValue(user.role ?? 'none');
                    setRoleModal(true);
                  }}
                >
                  {t('users.action.role')}
                </Button>
              ) : null}
              {can('users.plan') ? (
                <Button
                  onClick={() => {
                    setPlanValue(user.plan);
                    setPlanModal(true);
                  }}
                >
                  {t('users.action.plan')}
                </Button>
              ) : null}
              {can('users.sessions') ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    confirm({
                      title: t('users.confirm.revoke'),
                      description: user.displayName,
                      danger: true,
                      confirmLabel: t('users.action.revoke'),
                      onConfirm: (value) => revokeMutation.mutateAsync({ reason: value }),
                    })
                  }
                >
                  {t('users.action.revoke')}
                </Button>
              ) : null}
              {!can('users.moderate') && !can('users.role') && !can('users.plan') && !can('users.sessions') ? (
                <p className="small muted">{t('app.noPermissionAction')}</p>
              ) : null}
            </div>
          </Card>

          <Card title={t('users.detail.sessions')}>
            {user.sessions.length === 0 ? (
              <p className="muted small">{t('users.detail.noSessions')}</p>
            ) : (
              <div className="col">
                {user.sessions.map((session) => (
                  <div key={session.id} className="row">
                    <div className="stack-sm">
                      <strong className="small">{session.device}</strong>
                      <span className="small muted mono">{session.ip}</span>
                    </div>
                    <div className="spacer" />
                    <div className="stack-sm" style={{ textAlign: 'right' }}>
                      <Badge tone={session.current ? 'success' : 'neutral'}>{session.platform}</Badge>
                      <span className="small muted">{formatRelative(session.lastActiveAt, localeTag)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={roleModal}
        title={t('users.action.role')}
        onClose={() => setRoleModal(false)}
        footer={
          <>
            <Button onClick={() => setRoleModal(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => roleMutation.mutate({ role: roleValue === 'none' ? null : (roleValue as AdminRole), reason })}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('users.col.role')} htmlFor="role-select">
          <Select
            id="role-select"
            value={roleValue}
            onChange={(event) => setRoleValue(event.target.value)}
            options={[
              { value: 'none', label: t('role.none') },
              ...ROLES.map((role) => ({ value: role, label: t(`role.${role}` as AdminTranslationKey) })),
            ]}
          />
        </Field>
        <Field label={t('common.reason')} htmlFor="role-reason">
          <Textarea id="role-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={planModal}
        title={t('users.action.plan')}
        onClose={() => setPlanModal(false)}
        footer={
          <>
            <Button onClick={() => setPlanModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={() => planMutation.mutate({ plan: planValue, reason })}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('users.col.plan')} htmlFor="plan-select">
          <Select
            id="plan-select"
            value={planValue}
            onChange={(event) => setPlanValue(event.target.value as Plan)}
            options={PLANS.map((plan) => ({ value: plan, label: t(`plan.${plan}` as AdminTranslationKey) }))}
          />
        </Field>
        <Field label={t('common.reason')} htmlFor="plan-reason">
          <Textarea id="plan-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={noteModal}
        title={t('users.action.note')}
        onClose={() => setNoteModal(false)}
        footer={
          <>
            <Button onClick={() => setNoteModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={() => noteMutation.mutate(noteText)} disabled={!noteText.trim()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <Field label={t('users.noteText')} htmlFor="note-text">
          <Textarea id="note-text" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
        </Field>
      </Modal>

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ fontSize: 20 }}>
        {value}
      </span>
    </div>
  );
}
