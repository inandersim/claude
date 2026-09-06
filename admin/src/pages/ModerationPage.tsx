import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../auth/session';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmDialog, useConfirm } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Avatar, Badge, Button, Field, Input, PageHeader, Pagination, Select, Tabs } from '../components/ui';
import { adminApi } from '../data';
import type { ModerationAction, ModerationLogEntry, ModerationReport, ReportReason, ReportTargetKind } from '../data/adminApi';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDateTime, formatRelative } from '../utils/format';

const KINDS: ReportTargetKind[] = ['post', 'comment', 'message', 'article', 'question'];
const REASONS: ReportReason[] = ['spam', 'harassment', 'nudity', 'violence', 'misinformation', 'illegal', 'other'];
const STATUSES = ['open', 'approved', 'removed', 'warned', 'escalated'] as const;
const SEVERITIES = ['low', 'medium', 'high'] as const;
const ACTIONS: ModerationAction[] = ['approve', 'remove', 'warn', 'escalate'];

export function ModerationPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();
  const [tab, setTab] = useState<'queue' | 'log'>('queue');
  const [selected, setSelected] = useState<string[]>([]);

  const table = useTableQuery({ defaultSort: 'createdAt', filterKeys: ['kind', 'reason', 'status', 'severity'] });

  const queueQuery = useQuery({
    queryKey: ['admin', 'moderation', table.page, table.pageSize, table.query, table.sort, table.dir, table.filters],
    queryFn: () =>
      adminApi.moderation.list({
        page: table.page,
        pageSize: table.pageSize,
        query: table.query,
        sort: table.sort,
        dir: table.dir,
        targetKind: table.filters.kind as never,
        reason: table.filters.reason as never,
        status: table.filters.status as never,
        severity: table.filters.severity as never,
      }),
    enabled: tab === 'queue',
  });

  const logQuery = useQuery({
    queryKey: ['admin', 'moderationLog'],
    queryFn: () => adminApi.moderation.log({ page: 1, pageSize: 50 }),
    enabled: tab === 'log',
  });

  const actMutation = useMutation({
    mutationFn: (input: { ids: string[]; action: ModerationAction; reason: string }) =>
      adminApi.moderation.act(input.ids, input.action, input.reason),
    onSuccess: () => {
      notify(t('moderation.done'));
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'moderation'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'moderationLog'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const runAction = (ids: string[], action: ModerationAction) => {
    confirm({
      title: t('moderation.confirm', { count: ids.length, action: t(`moderation.action.${action}` as AdminTranslationKey) }),
      reasonRequired: action !== 'approve',
      danger: action === 'remove',
      confirmLabel: t(`moderation.action.${action}` as AdminTranslationKey),
      onConfirm: (reason) => actMutation.mutateAsync({ ids, action, reason }),
    });
  };

  const severityTone = (severity: ModerationReport['severity']) =>
    severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'neutral';

  const statusTone = (status: ModerationReport['status']) =>
    status === 'open' ? 'warning' : status === 'removed' ? 'danger' : status === 'escalated' ? 'info' : 'success';

  const columns: Column<ModerationReport>[] = [
    {
      key: 'content',
      header: t('moderation.col.content'),
      width: '30%',
      render: (row) => (
        <div className="stack-sm">
          <div className="row-tight">
            <Badge tone="info">{t(`moderation.kind.${row.targetKind}` as AdminTranslationKey)}</Badge>
            <span className="small subtle mono">{row.targetId}</span>
          </div>
          <span className="small clamp-2">{row.excerpt}</span>
          <span className="small subtle">{row.locationName}</span>
        </div>
      ),
    },
    {
      key: 'authorName',
      header: t('moderation.col.author'),
      sortable: true,
      render: (row) => (
        <div className="row-tight">
          <Avatar src={row.authorAvatarUrl} alt={row.authorName} />
          <div className="stack-sm">
            <span className="small">{row.authorName}</span>
            <span className="small subtle">{t('users.detail.trust')}: {row.authorTrustScore}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: t('moderation.col.reason'),
      render: (row) => <Badge>{t(`moderation.reason.${row.reason}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'reportCount',
      header: t('moderation.col.count'),
      sortable: true,
      align: 'right',
      render: (row) => (
        <span title={`${t('moderation.reporters')}: ${row.reporters.map((r) => r.name).join(', ')}`}>{row.reportCount}</span>
      ),
    },
    {
      key: 'severity',
      header: t('moderation.col.severity'),
      sortable: true,
      render: (row) => <Badge tone={severityTone(row.severity)}>{t(`moderation.severity.${row.severity}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'status',
      header: t('moderation.col.status'),
      sortable: true,
      render: (row) => (
        <div className="stack-sm">
          <Badge tone={statusTone(row.status)}>{t(`moderation.status.${row.status}` as AdminTranslationKey)}</Badge>
          {row.decidedBy ? <span className="small subtle">{row.decidedBy}</span> : null}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('moderation.col.created'),
      sortable: true,
      render: (row) => <span className="small muted">{formatRelative(row.createdAt, localeTag)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) =>
        can('moderation.act') && row.status === 'open' ? (
          <div className="row-tight">
            <Button size="sm" variant="primary" onClick={() => runAction([row.id], 'approve')}>
              ✓
              <span className="visually-hidden">{t('moderation.action.approve')}</span>
            </Button>
            <Button size="sm" variant="danger" onClick={() => runAction([row.id], 'remove')}>
              ✕
              <span className="visually-hidden">{t('moderation.action.remove')}</span>
            </Button>
            <Button size="sm" onClick={() => runAction([row.id], 'warn')}>
              !
              <span className="visually-hidden">{t('moderation.action.warn')}</span>
            </Button>
          </div>
        ) : (
          <span className="subtle small">—</span>
        ),
    },
  ];

  const logColumns: Column<ModerationLogEntry>[] = [
    { key: 'at', header: t('common.date'), render: (row) => <span className="small">{formatDateTime(row.at, localeTag)}</span> },
    { key: 'moderator', header: t('moderation.log.moderator'), render: (row) => row.moderator },
    {
      key: 'action',
      header: t('moderation.log.action'),
      render: (row) => <Badge tone={row.action === 'remove' ? 'danger' : 'neutral'}>{t(`moderation.action.${row.action}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'target',
      header: t('audit.col.target'),
      render: (row) => (
        <span className="mono small">
          {t(`moderation.kind.${row.targetKind}` as AdminTranslationKey)} · {row.targetId}
        </span>
      ),
    },
    { key: 'reason', header: t('common.reason'), render: (row) => <span className="small muted">{row.reason || '—'}</span> },
  ];

  const option = (value: string, key: AdminTranslationKey) => ({ value, label: t(key) });

  return (
    <>
      <PageHeader title={t('moderation.title')} subtitle={t('moderation.subtitle')} />

      <Tabs
        ariaLabel={t('moderation.title')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'queue', label: t('moderation.tab.queue') },
          { value: 'log', label: t('moderation.tab.log') },
        ]}
      />

      {tab === 'queue' ? (
        <>
          <div className="toolbar">
            <Field label={t('common.search')} htmlFor="mod-search" grow>
              <Input
                id="mod-search"
                type="search"
                value={table.query}
                placeholder={t('common.searchPlaceholder')}
                onChange={(event) => table.setQuery(event.target.value)}
              />
            </Field>
            <Field label={t('common.kind')} htmlFor="mod-kind">
              <Select
                id="mod-kind"
                value={table.filters.kind}
                onChange={(event) => table.setFilter('kind', event.target.value)}
                options={[option('all', 'common.all'), ...KINDS.map((k) => option(k, `moderation.kind.${k}` as AdminTranslationKey))]}
              />
            </Field>
            <Field label={t('moderation.col.reason')} htmlFor="mod-reason">
              <Select
                id="mod-reason"
                value={table.filters.reason}
                onChange={(event) => table.setFilter('reason', event.target.value)}
                options={[option('all', 'common.all'), ...REASONS.map((r) => option(r, `moderation.reason.${r}` as AdminTranslationKey))]}
              />
            </Field>
            <Field label={t('common.status')} htmlFor="mod-status">
              <Select
                id="mod-status"
                value={table.filters.status}
                onChange={(event) => table.setFilter('status', event.target.value)}
                options={[option('all', 'common.all'), ...STATUSES.map((s) => option(s, `moderation.status.${s}` as AdminTranslationKey))]}
              />
            </Field>
            <Field label={t('moderation.col.severity')} htmlFor="mod-severity">
              <Select
                id="mod-severity"
                value={table.filters.severity}
                onChange={(event) => table.setFilter('severity', event.target.value)}
                options={[option('all', 'common.all'), ...SEVERITIES.map((s) => option(s, `moderation.severity.${s}` as AdminTranslationKey))]}
              />
            </Field>
            <Button onClick={table.reset}>{t('common.clear')}</Button>
          </div>

          {selected.length > 0 && can('moderation.act') ? (
            <div className="row" style={{ marginBottom: 10 }}>
              <strong>
                {selected.length} {t('common.selected')}
              </strong>
              <span className="muted small">{t('moderation.bulk')}:</span>
              {ACTIONS.map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={action === 'remove' ? 'danger' : action === 'approve' ? 'primary' : 'secondary'}
                  onClick={() => runAction(selected, action)}
                >
                  {t(`moderation.action.${action}` as AdminTranslationKey)}
                </Button>
              ))}
            </div>
          ) : null}

          <DataTable
            caption={t('moderation.tab.queue')}
            columns={columns}
            rows={queueQuery.data?.items ?? []}
            rowKey={(row) => row.id}
            loading={queueQuery.isLoading}
            error={queueQuery.error}
            onRetry={() => void queueQuery.refetch()}
            sort={table.sort}
            dir={table.dir}
            onSort={table.toggleSort}
            selectable={can('moderation.act')}
            selected={selected}
            onSelectedChange={setSelected}
          />

          <Pagination
            page={queueQuery.data?.page ?? 1}
            pageSize={queueQuery.data?.pageSize ?? table.pageSize}
            total={queueQuery.data?.total ?? 0}
            onPage={table.setPage}
          />
        </>
      ) : (
        <DataTable
          caption={t('moderation.tab.log')}
          columns={logColumns}
          rows={logQuery.data?.items ?? []}
          rowKey={(row) => row.id}
          loading={logQuery.isLoading}
          error={logQuery.error}
          emptyMessage={t('moderation.log.empty')}
        />
      )}

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}
