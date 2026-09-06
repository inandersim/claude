import { useQuery } from '@tanstack/react-query';

import { useSession } from '../auth/session';
import { DataTable, type Column } from '../components/DataTable';
import { Badge, Button, Field, Input, PageHeader, Pagination, Select } from '../components/ui';
import { adminApi } from '../data';
import type { AuditEntry } from '../data/adminApi';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDateTime } from '../utils/format';

const TARGET_KINDS = ['user', 'report', 'verification', 'booking', 'dispute', 'sos', 'hazard', 'content', 'flag', 'setting', 'release', 'social_post', 'account'];

export function AuditPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { accounts } = useSession();
  const table = useTableQuery({ defaultSort: 'at', filterKeys: ['actor', 'target'] });

  const query = useQuery({
    queryKey: ['admin', 'audit', table.page, table.pageSize, table.query, table.sort, table.dir, table.filters],
    queryFn: () =>
      adminApi.audit.list({
        page: table.page,
        pageSize: table.pageSize,
        query: table.query,
        sort: table.sort,
        dir: table.dir,
        actorId: table.filters.actor as never,
        targetKind: table.filters.target as never,
      }),
  });

  const columns: Column<AuditEntry>[] = [
    { key: 'at', header: t('audit.col.at'), sortable: true, render: (row) => <span className="small nowrap">{formatDateTime(row.at, localeTag)}</span> },
    {
      key: 'actorName',
      header: t('audit.col.actor'),
      sortable: true,
      render: (row) => (
        <div className="stack-sm">
          <strong className="small">{row.actorName}</strong>
          <span className="small subtle">{t(`role.${row.actorRole}` as AdminTranslationKey)}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: t('audit.col.action'),
      sortable: true,
      render: (row) => <Badge tone={row.action.includes('remove') || row.action.includes('ban') || row.action.includes('refund') ? 'danger' : 'neutral'}>{row.action}</Badge>,
    },
    {
      key: 'target',
      header: t('audit.col.target'),
      render: (row) => (
        <span className="small mono">
          {row.targetKind} · {row.targetId}
        </span>
      ),
    },
    { key: 'summary', header: t('audit.col.summary'), render: (row) => <span className="small">{row.summary}</span> },
    { key: 'reason', header: t('audit.col.reason'), render: (row) => <span className="small muted">{row.reason ?? '—'}</span> },
    { key: 'ip', header: 'IP', render: (row) => <span className="small mono subtle">{row.ip}</span> },
  ];

  return (
    <>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />

      <div className="toolbar">
        <Field label={t('common.search')} htmlFor="aud-search" grow>
          <Input
            id="aud-search"
            type="search"
            value={table.query}
            placeholder={t('common.searchPlaceholder')}
            onChange={(event) => table.setQuery(event.target.value)}
          />
        </Field>
        <Field label={t('audit.filter.actor')} htmlFor="aud-actor">
          <Select
            id="aud-actor"
            value={table.filters.actor}
            onChange={(event) => table.setFilter('actor', event.target.value)}
            options={[{ value: 'all', label: t('common.all') }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
          />
        </Field>
        <Field label={t('audit.filter.target')} htmlFor="aud-target">
          <Select
            id="aud-target"
            value={table.filters.target}
            onChange={(event) => table.setFilter('target', event.target.value)}
            options={[{ value: 'all', label: t('common.all') }, ...TARGET_KINDS.map((k) => ({ value: k, label: k }))]}
          />
        </Field>
        <Button onClick={table.reset}>{t('common.clear')}</Button>
      </div>

      <DataTable
        caption={t('audit.title')}
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        sort={table.sort}
        dir={table.dir}
        onSort={table.toggleSort}
      />

      <Pagination
        page={query.data?.page ?? 1}
        pageSize={query.data?.pageSize ?? table.pageSize}
        total={query.data?.total ?? 0}
        onPage={table.setPage}
      />
    </>
  );
}
