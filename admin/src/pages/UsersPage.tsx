import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { useSession } from '../auth/session';
import { ConfirmDialog, useConfirm } from '../components/Modal';
import { DataTable, type Column } from '../components/DataTable';
import { useToast } from '../components/Toast';
import { Avatar, Badge, Button, Field, Input, PageHeader, Pagination, Select } from '../components/ui';
import { adminApi } from '../data';
import type { AccountStatus, AdminRole, AdminUserRow } from '../data/adminApi';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDate, formatRelative } from '../utils/format';

const PLANS = ['free', 'pro', 'pro_guide', 'business'] as const;
const STATUSES: AccountStatus[] = ['active', 'suspended', 'banned'];
const ROLES: AdminRole[] = ['admin', 'moderator', 'editor', 'support'];

export function UsersPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const navigate = useNavigate();
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();

  const table = useTableQuery({
    defaultSort: 'lastSeenAt',
    filterKeys: ['plan', 'status', 'role', 'phone'],
  });

  const query = useQuery({
    queryKey: ['admin', 'users', table.page, table.pageSize, table.query, table.sort, table.dir, table.filters],
    queryFn: () =>
      adminApi.users.list({
        page: table.page,
        pageSize: table.pageSize,
        query: table.query,
        sort: table.sort,
        dir: table.dir,
        plan: table.filters.plan as never,
        status: table.filters.status as never,
        role: table.filters.role as never,
        phoneVerified: (table.filters.phone === 'all' ? 'all' : table.filters.phone) as never,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: AccountStatus; reason: string; days?: number }) =>
      adminApi.users.setStatus(input.id, input.status, input.reason, input.days),
    onSuccess: () => {
      notify(t('users.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const statusTone = (status: AccountStatus) =>
    status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'danger';

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'displayName',
      header: t('users.col.user'),
      sortable: true,
      render: (row) => (
        <div className="row-tight">
          <Avatar src={row.avatarUrl} alt={row.displayName} />
          <div className="stack-sm">
            <strong>{row.displayName}</strong>
            <span className="small muted">@{row.username}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: t('users.col.plan'),
      sortable: true,
      render: (row) => <Badge tone={row.plan === 'free' ? 'neutral' : 'accent'}>{t(`plan.${row.plan}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'status',
      header: t('users.col.status'),
      sortable: true,
      render: (row) => <Badge tone={statusTone(row.status)}>{t(`users.status.${row.status}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'role',
      header: t('users.col.role'),
      render: (row) => (row.role ? <Badge tone="info">{t(`role.${row.role}` as AdminTranslationKey)}</Badge> : <span className="subtle">—</span>),
    },
    {
      key: 'phone',
      header: t('users.col.phone'),
      render: (row) => (
        <div className="stack-sm">
          <span className="mono">{row.phone}</span>
          <span className="small" style={{ color: row.phoneVerified ? 'var(--c-success)' : 'var(--c-text-subtle)' }}>
            {row.phoneVerified ? `✓ ${t('users.phone.verified')}` : t('users.phone.unverified')}
          </span>
        </div>
      ),
    },
    { key: 'trustScore', header: t('users.col.trust'), sortable: true, align: 'right', render: (row) => row.trustScore },
    { key: 'postsCount', header: t('users.col.posts'), sortable: true, align: 'right', render: (row) => row.postsCount },
    {
      key: 'reportsAgainst',
      header: t('users.col.reports'),
      sortable: true,
      align: 'right',
      render: (row) =>
        row.reportsAgainst > 0 ? <Badge tone="danger">{row.reportsAgainst}</Badge> : <span className="subtle">0</span>,
    },
    {
      key: 'joinedAt',
      header: t('users.col.joined'),
      sortable: true,
      render: (row) => <span className="small">{formatDate(row.joinedAt, localeTag)}</span>,
    },
    {
      key: 'lastSeenAt',
      header: t('users.col.lastSeen'),
      sortable: true,
      render: (row) => <span className="small muted">{formatRelative(row.lastSeenAt, localeTag)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="row-tight" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" onClick={() => navigate(`/users/${row.id}`)}>
            {t('common.details')}
          </Button>
          {can('users.moderate') && row.status === 'active' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                confirm({
                  title: t('users.confirm.suspend'),
                  description: `${row.displayName} (@${row.username})`,
                  reasonRequired: true,
                  danger: true,
                  confirmLabel: t('users.action.suspend'),
                  onConfirm: (reason) => statusMutation.mutateAsync({ id: row.id, status: 'suspended', reason, days: 7 }),
                })
              }
            >
              {t('users.action.suspend')}
            </Button>
          ) : null}
          {can('users.moderate') && row.status !== 'active' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                confirm({
                  title: t('users.confirm.activate'),
                  description: `${row.displayName} (@${row.username})`,
                  confirmLabel: t('users.action.activate'),
                  onConfirm: (reason) => statusMutation.mutateAsync({ id: row.id, status: 'active', reason }),
                })
              }
            >
              {t('users.action.activate')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const option = (value: string, key: AdminTranslationKey) => ({ value, label: t(key) });

  return (
    <>
      <PageHeader title={t('users.title')} subtitle={t('users.subtitle')} />

      <div className="toolbar">
        <Field label={t('common.search')} htmlFor="users-search" grow>
          <Input
            id="users-search"
            type="search"
            value={table.query}
            placeholder={t('common.searchPlaceholder')}
            onChange={(event) => table.setQuery(event.target.value)}
          />
        </Field>
        <Field label={t('users.filter.plan')} htmlFor="users-plan">
          <Select
            id="users-plan"
            value={table.filters.plan}
            onChange={(event) => table.setFilter('plan', event.target.value)}
            options={[
              option('all', 'common.all'),
              ...PLANS.map((plan) => option(plan, `plan.${plan}` as AdminTranslationKey)),
            ]}
          />
        </Field>
        <Field label={t('users.filter.status')} htmlFor="users-status">
          <Select
            id="users-status"
            value={table.filters.status}
            onChange={(event) => table.setFilter('status', event.target.value)}
            options={[
              option('all', 'common.all'),
              ...STATUSES.map((status) => option(status, `users.status.${status}` as AdminTranslationKey)),
            ]}
          />
        </Field>
        <Field label={t('users.filter.role')} htmlFor="users-role">
          <Select
            id="users-role"
            value={table.filters.role}
            onChange={(event) => table.setFilter('role', event.target.value)}
            options={[
              option('all', 'common.all'),
              option('none', 'role.none'),
              ...ROLES.map((role) => option(role, `role.${role}` as AdminTranslationKey)),
            ]}
          />
        </Field>
        <Field label={t('users.filter.phone')} htmlFor="users-phone">
          <Select
            id="users-phone"
            value={table.filters.phone}
            onChange={(event) => table.setFilter('phone', event.target.value)}
            options={[option('all', 'common.all'), option('yes', 'users.phone.verified'), option('no', 'users.phone.unverified')]}
          />
        </Field>
        <Button onClick={table.reset}>{t('common.clear')}</Button>
      </div>

      <DataTable
        caption={t('users.title')}
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        sort={table.sort}
        dir={table.dir}
        onSort={table.toggleSort}
        onRowClick={(row) => navigate(`/users/${row.id}`)}
      />

      <Pagination
        page={query.data?.page ?? 1}
        pageSize={query.data?.pageSize ?? table.pageSize}
        total={query.data?.total ?? 0}
        onPage={table.setPage}
      />

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}
