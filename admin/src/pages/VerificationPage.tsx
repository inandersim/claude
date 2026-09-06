import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../auth/session';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmDialog, Modal, useConfirm } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Avatar, Badge, Button, Field, Input, KeyValue, PageHeader, Pagination, Select } from '../components/ui';
import { adminApi } from '../data';
import type { VerificationKind, VerificationRequest, VerificationStatusAdmin } from '../data/adminApi';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDateTime, formatRelative } from '../utils/format';

const KINDS: VerificationKind[] = ['instructor', 'business', 'club', 'doctor', 'writer'];
const STATUSES: VerificationStatusAdmin[] = ['pending', 'approved', 'rejected', 'more_info'];

export function VerificationPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();
  const [openId, setOpenId] = useState<string | null>(null);

  const table = useTableQuery({ defaultSort: 'submittedAt', filterKeys: ['kind', 'status'] });

  const listQuery = useQuery({
    queryKey: ['admin', 'verification', table.page, table.pageSize, table.query, table.sort, table.dir, table.filters],
    queryFn: () =>
      adminApi.verification.list({
        page: table.page,
        pageSize: table.pageSize,
        query: table.query,
        sort: table.sort,
        dir: table.dir,
        kind: table.filters.kind as never,
        status: table.filters.status as never,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ['admin', 'verification', 'detail', openId],
    queryFn: () => adminApi.verification.get(openId ?? ''),
    enabled: Boolean(openId),
  });

  const decideMutation = useMutation({
    mutationFn: (input: { id: string; status: Exclude<VerificationStatusAdmin, 'pending'>; reason: string }) =>
      adminApi.verification.decide(input.id, input.status, input.reason),
    onSuccess: () => {
      notify(t('verification.decided'));
      setOpenId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'verification'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const statusTone = (status: VerificationStatusAdmin) =>
    status === 'pending' ? 'warning' : status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'info';

  const decide = (request: VerificationRequest, status: Exclude<VerificationStatusAdmin, 'pending'>) => {
    const titleKey: AdminTranslationKey =
      status === 'approved'
        ? 'verification.confirm.approve'
        : status === 'rejected'
          ? 'verification.confirm.reject'
          : 'verification.confirm.moreInfo';
    confirm({
      title: t(titleKey),
      description: `${request.subjectName} · ${request.applicantName}`,
      reasonRequired: status !== 'approved',
      danger: status === 'rejected',
      onConfirm: (reason) => decideMutation.mutateAsync({ id: request.id, status, reason }),
    });
  };

  const columns: Column<VerificationRequest>[] = [
    {
      key: 'applicantName',
      header: t('verification.col.applicant'),
      sortable: true,
      render: (row) => (
        <div className="row-tight">
          <Avatar src={row.applicantAvatarUrl} alt={row.applicantName} />
          <div className="stack-sm">
            <strong className="small">{row.applicantName}</strong>
            <span className="small subtle">{row.locationName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'kind',
      header: t('common.kind'),
      sortable: true,
      render: (row) => <Badge tone="info">{t(`verification.kind.${row.kind}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'subject',
      header: t('verification.col.subject'),
      render: (row) => (
        <div className="stack-sm" style={{ maxWidth: 340 }}>
          <span>{row.subjectName}</span>
          <span className="small subtle">{row.documents.length} {t('verification.documents').toLocaleLowerCase('tr')}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      sortable: true,
      render: (row) => <Badge tone={statusTone(row.status)}>{t(`verification.status.${row.status}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'submittedAt',
      header: t('verification.col.submitted'),
      sortable: true,
      render: (row) => <span className="small muted">{formatRelative(row.submittedAt, localeTag)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="row-tight" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" onClick={() => setOpenId(row.id)}>
            {t('common.details')}
          </Button>
        </div>
      ),
    },
  ];

  const request = detailQuery.data;
  const option = (value: string, key: AdminTranslationKey) => ({ value, label: t(key) });

  return (
    <>
      <PageHeader title={t('verification.title')} subtitle={t('verification.subtitle')} />

      <div className="toolbar">
        <Field label={t('common.search')} htmlFor="ver-search" grow>
          <Input
            id="ver-search"
            type="search"
            value={table.query}
            placeholder={t('common.searchPlaceholder')}
            onChange={(event) => table.setQuery(event.target.value)}
          />
        </Field>
        <Field label={t('common.kind')} htmlFor="ver-kind">
          <Select
            id="ver-kind"
            value={table.filters.kind}
            onChange={(event) => table.setFilter('kind', event.target.value)}
            options={[option('all', 'common.all'), ...KINDS.map((k) => option(k, `verification.kind.${k}` as AdminTranslationKey))]}
          />
        </Field>
        <Field label={t('common.status')} htmlFor="ver-status">
          <Select
            id="ver-status"
            value={table.filters.status}
            onChange={(event) => table.setFilter('status', event.target.value)}
            options={[option('all', 'common.all'), ...STATUSES.map((s) => option(s, `verification.status.${s}` as AdminTranslationKey))]}
          />
        </Field>
        <Button onClick={table.reset}>{t('common.clear')}</Button>
      </div>

      <DataTable
        caption={t('verification.title')}
        columns={columns}
        rows={listQuery.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => void listQuery.refetch()}
        sort={table.sort}
        dir={table.dir}
        onSort={table.toggleSort}
        onRowClick={(row) => setOpenId(row.id)}
      />

      <Pagination
        page={listQuery.data?.page ?? 1}
        pageSize={listQuery.data?.pageSize ?? table.pageSize}
        total={listQuery.data?.total ?? 0}
        onPage={table.setPage}
      />

      <Modal
        open={Boolean(openId)}
        wide
        title={request ? `${t(`verification.kind.${request.kind}` as AdminTranslationKey)} — ${request.subjectName}` : t('app.loading')}
        onClose={() => setOpenId(null)}
        footer={
          request && can('verification.decide') && request.status === 'pending' ? (
            <>
              <Button onClick={() => decide(request, 'more_info')}>{t('verification.action.moreInfo')}</Button>
              <Button variant="danger" onClick={() => decide(request, 'rejected')}>
                {t('verification.action.reject')}
              </Button>
              <Button variant="primary" onClick={() => decide(request, 'approved')}>
                {t('verification.action.approve')}
              </Button>
            </>
          ) : (
            <Button onClick={() => setOpenId(null)}>{t('common.close')}</Button>
          )
        }
      >
        {!request ? (
          <p className="muted">{t('app.loading')}</p>
        ) : (
          <div className="col" style={{ gap: 16 }}>
            <div className="row-tight">
              <Avatar src={request.applicantAvatarUrl} alt={request.applicantName} />
              <div className="stack-sm">
                <strong>{request.applicantName}</strong>
                <span className="small muted">
                  {request.locationName} · {formatDateTime(request.submittedAt, localeTag)}
                </span>
              </div>
              <div className="spacer" />
              <Badge tone={statusTone(request.status)}>{t(`verification.status.${request.status}` as AdminTranslationKey)}</Badge>
            </div>

            <div>
              <h3 style={{ fontSize: 14, marginBottom: 6 }}>{t('verification.fields')}</h3>
              <KeyValue items={request.fields.map((field) => ({ label: field.label, value: field.value }))} />
            </div>

            <div>
              <h3 style={{ fontSize: 14, marginBottom: 6 }}>{t('verification.documents')}</h3>
              <div className="col">
                {request.documents.map((doc) => (
                  <div key={doc.id} className="doc-preview">
                    <span aria-hidden="true" style={{ fontSize: 22 }}>
                      📄
                    </span>
                    <div className="stack-sm">
                      <strong className="small">{doc.fileName}</strong>
                      <span className="small muted">
                        {doc.sizeKb} KB · {formatDateTime(doc.uploadedAt, localeTag)}
                      </span>
                      <span className="small subtle">{doc.preview}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 14, marginBottom: 6 }}>{t('verification.note')}</h3>
              <p className="small muted">{request.applicantNote}</p>
            </div>

            {request.decidedAt ? (
              <KeyValue
                items={[
                  { label: t('verification.decidedBy'), value: `${request.decidedBy} · ${formatDateTime(request.decidedAt, localeTag)}` },
                  { label: t('verification.decisionReason'), value: request.decisionReason ?? '—' },
                ]}
              />
            ) : null}
          </div>
        )}
      </Modal>

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}
