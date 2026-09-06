import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useSession } from '../auth/session';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmDialog, Modal, useConfirm } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  Field,
  Input,
  KeyValue,
  PageHeader,
  Pagination,
  ProgressBar,
  Select,
  Textarea,
} from '../components/ui';
import { adminApi } from '../data';
import type { ContentKind, ContentRow, ContentStatus } from '../data/adminApi';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDate, formatNumber } from '../utils/format';

const KINDS: ContentKind[] = ['destination', 'heritage', 'species', 'course', 'tv_program', 'news', 'article'];
const STATUSES: ContentStatus[] = ['draft', 'published', 'archived'];

export function ContentPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();

  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', subtitle: '', body: '', region: '', status: 'draft' as ContentStatus, kind: 'news' as ContentKind });

  const table = useTableQuery({ defaultSort: 'updatedAt', filterKeys: ['kind', 'status', 'missing'] });

  const listQuery = useQuery({
    queryKey: ['admin', 'content', table.page, table.pageSize, table.query, table.sort, table.dir, table.filters],
    queryFn: () =>
      adminApi.content.list({
        page: table.page,
        pageSize: table.pageSize,
        query: table.query,
        sort: table.sort,
        dir: table.dir,
        kind: table.filters.kind as never,
        status: table.filters.status as never,
        missingOnly: table.filters.missing === 'yes',
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['admin', 'content', 'detail', editId],
    queryFn: () => adminApi.content.get(editId ?? ''),
    enabled: Boolean(editId),
  });

  useEffect(() => {
    if (detailQuery.data) {
      setForm({
        title: detailQuery.data.title,
        subtitle: detailQuery.data.subtitle,
        body: detailQuery.data.body,
        region: detailQuery.data.region,
        status: detailQuery.data.status,
        kind: detailQuery.data.kind,
      });
    }
  }, [detailQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'content'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      adminApi.content.update(
        input.id,
        { title: form.title, subtitle: form.subtitle, body: form.body, status: form.status },
        input.reason,
      ),
    onSuccess: () => {
      notify(t('content.saved'));
      setEditId(null);
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.content.create({
        kind: form.kind,
        title: form.title,
        subtitle: form.subtitle,
        body: form.body,
        region: form.region,
        status: form.status,
      }),
    onSuccess: () => {
      notify(t('content.created'));
      setCreating(false);
      setForm({ title: '', subtitle: '', body: '', region: '', status: 'draft', kind: 'news' });
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: ContentStatus; reason: string }) =>
      adminApi.content.setStatus(input.id, input.status, input.reason),
    onSuccess: () => {
      notify(t('content.statusChanged'));
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const statusTone = (status: ContentStatus) =>
    status === 'published' ? 'success' : status === 'draft' ? 'warning' : 'neutral';

  const columns: Column<ContentRow>[] = [
    {
      key: 'title',
      header: t('content.col.title'),
      sortable: true,
      width: '32%',
      render: (row) => (
        <div className="stack-sm">
          <strong className="small">{row.title}</strong>
          <span className="small muted clamp-2">{row.subtitle}</span>
        </div>
      ),
    },
    {
      key: 'kind',
      header: t('content.col.kind'),
      sortable: true,
      render: (row) => <Badge tone="info">{t(`content.kind.${row.kind}` as AdminTranslationKey)}</Badge>,
    },
    { key: 'region', header: t('content.col.region'), render: (row) => <span className="small">{row.region}</span> },
    {
      key: 'status',
      header: t('content.col.status'),
      sortable: true,
      render: (row) => <Badge tone={statusTone(row.status)}>{t(`content.status.${row.status}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'translatedCount',
      header: t('content.col.translation'),
      sortable: true,
      width: 160,
      render: (row) => (
        <div className="stack-sm">
          <ProgressBar
            pct={(row.translatedCount / row.localeCount) * 100}
            tone={row.translatedCount === row.localeCount ? 'var(--c-success)' : 'var(--c-warning)'}
          />
          <span className="small muted">
            {row.translatedCount}/{row.localeCount}
            {row.missingLocales.length ? ` · ${row.missingLocales.slice(0, 5).join(', ')}${row.missingLocales.length > 5 ? '…' : ''}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'views',
      header: t('content.col.views'),
      sortable: true,
      align: 'right',
      render: (row) => formatNumber(row.views, localeTag),
    },
    {
      key: 'updatedAt',
      header: t('content.col.updated'),
      sortable: true,
      render: (row) => <span className="small muted">{formatDate(row.updatedAt, localeTag)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="row-tight" onClick={(event) => event.stopPropagation()}>
          {can('content.edit') ? (
            <Button size="sm" onClick={() => setEditId(row.id)}>
              {t('content.action.edit')}
            </Button>
          ) : null}
          {can('content.publish') && row.status !== 'published' ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                confirm({
                  title: t('content.action.publish'),
                  description: row.title,
                  onConfirm: (reason) => statusMutation.mutateAsync({ id: row.id, status: 'published', reason }),
                })
              }
            >
              {t('content.action.publish')}
            </Button>
          ) : null}
          {can('content.publish') && row.status === 'published' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                confirm({
                  title: t('content.confirmUnpublish'),
                  description: row.title,
                  reasonRequired: true,
                  danger: true,
                  confirmLabel: t('content.action.unpublish'),
                  onConfirm: (reason) => statusMutation.mutateAsync({ id: row.id, status: 'archived', reason }),
                })
              }
            >
              {t('content.action.unpublish')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const option = (value: string, key: AdminTranslationKey) => ({ value, label: t(key) });
  const detail = detailQuery.data;

  return (
    <>
      <PageHeader
        title={t('content.title')}
        subtitle={t('content.subtitle')}
        actions={
          can('content.edit') ? (
            <Button
              variant="primary"
              onClick={() => {
                setForm({ title: '', subtitle: '', body: '', region: '', status: 'draft', kind: 'news' });
                setCreating(true);
              }}
            >
              + {t('content.action.new')}
            </Button>
          ) : null
        }
      />

      <div className="toolbar">
        <Field label={t('common.search')} htmlFor="ct-search" grow>
          <Input
            id="ct-search"
            type="search"
            value={table.query}
            placeholder={t('common.searchPlaceholder')}
            onChange={(event) => table.setQuery(event.target.value)}
          />
        </Field>
        <Field label={t('content.col.kind')} htmlFor="ct-kind">
          <Select
            id="ct-kind"
            value={table.filters.kind}
            onChange={(event) => table.setFilter('kind', event.target.value)}
            options={[option('all', 'common.all'), ...KINDS.map((k) => option(k, `content.kind.${k}` as AdminTranslationKey))]}
          />
        </Field>
        <Field label={t('content.col.status')} htmlFor="ct-status">
          <Select
            id="ct-status"
            value={table.filters.status}
            onChange={(event) => table.setFilter('status', event.target.value)}
            options={[option('all', 'common.all'), ...STATUSES.map((s) => option(s, `content.status.${s}` as AdminTranslationKey))]}
          />
        </Field>
        <Field label={t('content.filter.missing')} htmlFor="ct-missing">
          <Select
            id="ct-missing"
            value={table.filters.missing}
            onChange={(event) => table.setFilter('missing', event.target.value)}
            options={[option('all', 'common.all'), option('yes', 'common.yes')]}
          />
        </Field>
        <Button onClick={table.reset}>{t('common.clear')}</Button>
      </div>

      <DataTable
        caption={t('content.title')}
        columns={columns}
        rows={listQuery.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        sort={table.sort}
        dir={table.dir}
        onSort={table.toggleSort}
      />

      <Pagination
        page={listQuery.data?.page ?? 1}
        pageSize={listQuery.data?.pageSize ?? table.pageSize}
        total={listQuery.data?.total ?? 0}
        onPage={table.setPage}
      />

      {/* Düzenleyici */}
      <Modal
        open={Boolean(editId)}
        wide
        title={t('content.editor')}
        onClose={() => setEditId(null)}
        footer={
          <>
            <Button onClick={() => setEditId(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!form.title.trim() || updateMutation.isPending}
              onClick={() => editId && updateMutation.mutate({ id: editId, reason: 'Panelden düzenlendi' })}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        {!detail ? (
          <p className="muted">{t('app.loading')}</p>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            <Field label={t('content.field.title')} htmlFor="ct-title">
              <Input id="ct-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Field>
            <Field label={t('content.field.subtitle')} htmlFor="ct-subtitle">
              <Textarea
                id="ct-subtitle"
                value={form.subtitle}
                onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
                style={{ minHeight: 60 }}
              />
            </Field>
            <Field label={t('content.field.body')} htmlFor="ct-body">
              <Textarea
                id="ct-body"
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                style={{ minHeight: 180 }}
              />
            </Field>
            <Field label={t('content.col.status')} htmlFor="ct-edit-status">
              <Select
                id="ct-edit-status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}
                options={STATUSES.map((s) => ({ value: s, label: t(`content.status.${s}` as AdminTranslationKey) }))}
              />
            </Field>

            {detail.fields.length ? (
              <>
                <h3 style={{ fontSize: 14 }}>{t('content.meta')}</h3>
                <KeyValue items={detail.fields.map((field) => ({ label: field.label, value: field.value }))} />
              </>
            ) : null}

            <h3 style={{ fontSize: 14 }}>{t('content.translations')}</h3>
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">{t('content.translations')}</caption>
                <thead>
                  <tr>
                    <th>{t('common.language')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('content.translation.missing')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.translations.map((item) => (
                    <tr key={item.locale}>
                      <td className="mono">{item.locale}</td>
                      <td>
                        <Badge tone={item.complete ? 'success' : 'warning'}>
                          {item.complete ? t('content.translation.complete') : t('content.translation.missing')}
                        </Badge>
                      </td>
                      <td className="small muted">{item.missingFields.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Yeni içerik */}
      <Modal
        open={creating}
        title={t('content.action.new')}
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!form.title.trim()} onClick={() => createMutation.mutate()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="col" style={{ gap: 12 }}>
          <Field label={t('content.col.kind')} htmlFor="new-kind">
            <Select
              id="new-kind"
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value as ContentKind })}
              options={KINDS.map((k) => ({ value: k, label: t(`content.kind.${k}` as AdminTranslationKey) }))}
            />
          </Field>
          <Field label={t('content.field.title')} htmlFor="new-title">
            <Input id="new-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label={t('content.field.subtitle')} htmlFor="new-subtitle">
            <Input id="new-subtitle" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
          </Field>
          <Field label={t('content.field.region')} htmlFor="new-region">
            <Input id="new-region" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} />
          </Field>
          <Field label={t('content.field.body')} htmlFor="new-body">
            <Textarea id="new-body" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}
