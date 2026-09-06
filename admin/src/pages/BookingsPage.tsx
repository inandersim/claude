import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../auth/session';
import { BarChart } from '../charts/Charts';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmDialog, Modal, useConfirm } from '../components/Modal';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  KeyValue,
  Loading,
  PageHeader,
  Pagination,
  Select,
  Stat,
  Tabs,
  Textarea,
} from '../components/ui';
import { adminApi } from '../data';
import type { AdminBookingRow, BookingKind, Dispute, DisputeOutcome, MetricRange } from '../data/adminApi';
import type { PaymentStatus } from '@/domain';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDate, formatDateTime, formatTry } from '../utils/format';

const KINDS: BookingKind[] = ['stay', 'instructor', 'course'];
const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'authorized', 'escrow', 'released', 'refunded', 'failed'];
const OUTCOMES: DisputeOutcome[] = ['refund_guest', 'release_provider', 'split'];

function paymentTone(status: PaymentStatus) {
  switch (status) {
    case 'released':
      return 'success' as const;
    case 'escrow':
      return 'info' as const;
    case 'refunded':
      return 'danger' as const;
    case 'failed':
      return 'danger' as const;
    case 'authorized':
      return 'accent' as const;
    default:
      return 'neutral' as const;
  }
}

export function BookingsPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();

  const [tab, setTab] = useState<'list' | 'disputes' | 'commission'>('list');
  const [refundTarget, setRefundTarget] = useState<AdminBookingRow | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBookingRow | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<Dispute | null>(null);
  const [outcome, setOutcome] = useState<DisputeOutcome>('refund_guest');
  const [disputeNote, setDisputeNote] = useState('');
  const [range, setRange] = useState<MetricRange>('90d');

  const table = useTableQuery({ defaultSort: 'createdAt', filterKeys: ['kind', 'payment', 'disputed'] });

  const listQuery = useQuery({
    queryKey: ['admin', 'bookings', table.page, table.pageSize, table.query, table.sort, table.dir, table.filters],
    queryFn: () =>
      adminApi.bookings.list({
        page: table.page,
        pageSize: table.pageSize,
        query: table.query,
        sort: table.sort,
        dir: table.dir,
        kind: table.filters.kind as never,
        paymentStatus: table.filters.payment as never,
        disputed: table.filters.disputed as never,
      }),
    enabled: tab === 'list',
  });

  const disputesQuery = useQuery({
    queryKey: ['admin', 'disputes'],
    queryFn: () => adminApi.bookings.disputes({ page: 1, pageSize: 50 }),
    enabled: tab === 'disputes',
  });

  const commissionQuery = useQuery({
    queryKey: ['admin', 'commission', range],
    queryFn: () => adminApi.bookings.commission(range),
    enabled: tab === 'commission',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'disputes'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'commission'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
  };

  const releaseMutation = useMutation({
    mutationFn: (input: { id: string; reason: string }) => adminApi.bookings.release(input.id, input.reason),
    onSuccess: () => {
      notify(t('bookings.release.done'));
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const refundMutation = useMutation({
    mutationFn: (input: { bookingId: string; amountTry: number; reason: string }) => adminApi.bookings.refund(input),
    onSuccess: () => {
      notify(t('bookings.refund.done'));
      setRefundTarget(null);
      setRefundAmount('');
      setRefundReason('');
      invalidate();
    },
    onError: (error: Error) => {
      setRefundError(error.message);
      notify(error.message, 'error');
    },
  });

  const disputeMutation = useMutation({
    mutationFn: (input: { id: string; outcome: DisputeOutcome; note: string }) =>
      adminApi.bookings.resolveDispute(input.id, input.outcome, input.note),
    onSuccess: () => {
      notify(t('bookings.dispute.done'));
      setDisputeTarget(null);
      setDisputeNote('');
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const columns: Column<AdminBookingRow>[] = [
    {
      key: 'reference',
      header: t('bookings.col.reference'),
      render: (row) => (
        <div className="stack-sm">
          <strong className="mono small">{row.reference}</strong>
          <Badge tone="neutral">{t(`bookings.kind.${row.kind}` as AdminTranslationKey)}</Badge>
        </div>
      ),
    },
    { key: 'guestName', header: t('bookings.col.guest'), sortable: true, render: (row) => row.guestName },
    {
      key: 'providerName',
      header: t('bookings.col.provider'),
      sortable: true,
      render: (row) => <span className="small">{row.providerName}</span>,
    },
    {
      key: 'startAt',
      header: t('bookings.col.dates'),
      sortable: true,
      render: (row) => (
        <span className="small">
          {formatDate(row.startAt, localeTag)}
          {row.nights > 0 ? ` → ${formatDate(row.endAt, localeTag)} (${row.nights})` : ''}
        </span>
      ),
    },
    {
      key: 'totalTry',
      header: t('bookings.col.total'),
      sortable: true,
      align: 'right',
      render: (row) => (
        <div className="stack-sm" style={{ textAlign: 'right' }}>
          <strong>{formatTry(row.totalTry, localeTag)}</strong>
          {row.refundedTry > 0 ? (
            <span className="small" style={{ color: 'var(--c-danger)' }}>
              -{formatTry(row.refundedTry, localeTag)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'fee',
      header: t('bookings.col.fee'),
      align: 'right',
      render: (row) => (
        <span className="small">
          {formatTry(row.platformFeeTry, localeTag)} <span className="subtle">%{row.commissionPct}</span>
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      header: t('bookings.col.payment'),
      sortable: true,
      render: (row) => (
        <div className="stack-sm">
          <Badge tone={paymentTone(row.paymentStatus)}>{t(`bookings.payment.${row.paymentStatus}` as AdminTranslationKey)}</Badge>
          {row.disputed ? <Badge tone="danger">{t('bookings.disputed')}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="row-tight" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" onClick={() => setDetail(row)}>
            {t('bookings.action.detail')}
          </Button>
          {can('bookings.release') && (row.paymentStatus === 'escrow' || row.paymentStatus === 'authorized') ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                confirm({
                  title: t('bookings.release.confirm'),
                  description: `${row.reference} · ${formatTry(row.totalTry, localeTag)} → ${row.providerName}`,
                  confirmLabel: t('bookings.action.release'),
                  onConfirm: (reason) => releaseMutation.mutateAsync({ id: row.id, reason }),
                })
              }
            >
              {t('bookings.action.release')}
            </Button>
          ) : null}
          {can('bookings.refund') && row.paymentStatus !== 'refunded' ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setRefundTarget(row);
                setRefundAmount(String(row.totalTry - row.refundedTry));
                setRefundReason('');
                setRefundError(null);
              }}
            >
              {t('bookings.action.refund')}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const disputeColumns: Column<Dispute>[] = [
    { key: 'reference', header: t('bookings.col.reference'), render: (row) => <span className="mono small">{row.reference}</span> },
    { key: 'openedBy', header: t('bookings.col.guest'), render: (row) => row.openedByName },
    { key: 'against', header: t('bookings.dispute.against'), render: (row) => row.againstName },
    { key: 'reason', header: t('common.reason'), render: (row) => <span className="small">{row.reason}</span> },
    {
      key: 'amount',
      header: t('common.amount'),
      align: 'right',
      render: (row) => formatTry(row.amountTry, localeTag),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <div className="stack-sm">
          <Badge tone={row.status === 'open' ? 'warning' : 'success'}>
            {row.status === 'open' ? t('bookings.dispute.open') : t('bookings.dispute.resolved')}
          </Badge>
          {row.outcome ? (
            <span className="small subtle">{t(`bookings.dispute.${row.outcome}` as AdminTranslationKey)}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) =>
        can('bookings.dispute') && row.status === 'open' ? (
          <Button size="sm" onClick={() => setDisputeTarget(row)}>
            {t('bookings.dispute.resolve')}
          </Button>
        ) : (
          <span className="subtle small">—</span>
        ),
    },
  ];

  const option = (value: string, key: AdminTranslationKey) => ({ value, label: t(key) });

  return (
    <>
      <PageHeader title={t('bookings.title')} subtitle={t('bookings.subtitle')} />

      <Tabs
        ariaLabel={t('bookings.title')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'list', label: t('bookings.tab.list') },
          { value: 'disputes', label: t('bookings.tab.disputes') },
          { value: 'commission', label: t('bookings.tab.commission') },
        ]}
      />

      {tab === 'list' ? (
        <>
          <div className="toolbar">
            <Field label={t('common.search')} htmlFor="bk-search" grow>
              <Input
                id="bk-search"
                type="search"
                value={table.query}
                placeholder={t('common.searchPlaceholder')}
                onChange={(event) => table.setQuery(event.target.value)}
              />
            </Field>
            <Field label={t('common.kind')} htmlFor="bk-kind">
              <Select
                id="bk-kind"
                value={table.filters.kind}
                onChange={(event) => table.setFilter('kind', event.target.value)}
                options={[option('all', 'common.all'), ...KINDS.map((k) => option(k, `bookings.kind.${k}` as AdminTranslationKey))]}
              />
            </Field>
            <Field label={t('bookings.col.payment')} htmlFor="bk-payment">
              <Select
                id="bk-payment"
                value={table.filters.payment}
                onChange={(event) => table.setFilter('payment', event.target.value)}
                options={[
                  option('all', 'common.all'),
                  ...PAYMENT_STATUSES.map((s) => option(s, `bookings.payment.${s}` as AdminTranslationKey)),
                ]}
              />
            </Field>
            <Field label={t('bookings.disputed')} htmlFor="bk-disputed">
              <Select
                id="bk-disputed"
                value={table.filters.disputed}
                onChange={(event) => table.setFilter('disputed', event.target.value)}
                options={[option('all', 'common.all'), option('yes', 'common.yes'), option('no', 'common.no')]}
              />
            </Field>
            <Button onClick={table.reset}>{t('common.clear')}</Button>
          </div>

          <DataTable
            caption={t('bookings.tab.list')}
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
        </>
      ) : null}

      {tab === 'disputes' ? (
        <DataTable
          caption={t('bookings.tab.disputes')}
          columns={disputeColumns}
          rows={disputesQuery.data?.items ?? []}
          rowKey={(row) => row.id}
          loading={disputesQuery.isLoading}
          error={disputesQuery.error}
        />
      ) : null}

      {tab === 'commission' ? (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            {(['7d', '30d', '90d'] as MetricRange[]).map((item) => (
              <button
                key={item}
                type="button"
                className="chip-toggle"
                aria-pressed={range === item}
                onClick={() => setRange(item)}
              >
                {t(`common.range.${item}` as AdminTranslationKey)}
              </button>
            ))}
          </div>
          {commissionQuery.isLoading ? <Loading /> : null}
          {commissionQuery.data ? (
            <div className="col" style={{ gap: 14 }}>
              <div className="grid grid-4">
                <Stat label={t('bookings.commission.gross')} value={formatTry(commissionQuery.data.grossTry, localeTag)} />
                <Stat
                  label={t('bookings.commission.commission')}
                  value={formatTry(commissionQuery.data.commissionTry, localeTag)}
                />
                <Stat label={t('bookings.commission.net')} value={formatTry(commissionQuery.data.netTry, localeTag)} />
                <Stat label={t('bookings.commission.refunded')} value={formatTry(commissionQuery.data.refundedTry, localeTag)} />
              </div>

              <Card title={t('bookings.commission.byMonth')}>
                <BarChart
                  label={t('bookings.commission.byMonth')}
                  data={commissionQuery.data.byMonth.map((item) => ({ label: item.month, value: item.commissionTry }))}
                  formatValue={(value) => formatTry(value, localeTag)}
                />
              </Card>

              <Card title={t('bookings.commission.byKind')}>
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">{t('bookings.commission.byKind')}</caption>
                    <thead>
                      <tr>
                        <th>{t('common.kind')}</th>
                        <th style={{ textAlign: 'right' }}>{t('bookings.commission.count')}</th>
                        <th style={{ textAlign: 'right' }}>{t('bookings.commission.gross')}</th>
                        <th style={{ textAlign: 'right' }}>{t('bookings.commission.commission')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionQuery.data.byKind.map((item) => (
                        <tr key={item.kind}>
                          <td>{t(`bookings.kind.${item.kind}` as AdminTranslationKey)}</td>
                          <td style={{ textAlign: 'right' }}>{item.bookings}</td>
                          <td style={{ textAlign: 'right' }}>{formatTry(item.grossTry, localeTag)}</td>
                          <td style={{ textAlign: 'right' }}>{formatTry(item.commissionTry, localeTag)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}
        </>
      ) : null}

      {/* İade diyaloğu */}
      <Modal
        open={Boolean(refundTarget)}
        title={t('bookings.refund.title')}
        onClose={() => setRefundTarget(null)}
        footer={
          <>
            <Button onClick={() => setRefundTarget(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!refundTarget) return;
                const amount = Number(refundAmount);
                if (!Number.isFinite(amount) || amount <= 0) {
                  setRefundError(t('bookings.refund.max', { max: refundTarget.totalTry - refundTarget.refundedTry }));
                  return;
                }
                refundMutation.mutate({ bookingId: refundTarget.id, amountTry: amount, reason: refundReason });
              }}
              disabled={refundMutation.isPending || !refundReason.trim()}
            >
              {t('bookings.action.refund')}
            </Button>
          </>
        }
      >
        {refundTarget ? (
          <div className="col">
            <KeyValue
              items={[
                { label: t('bookings.col.reference'), value: refundTarget.reference },
                { label: t('bookings.col.guest'), value: refundTarget.guestName },
                { label: t('bookings.col.provider'), value: refundTarget.providerName },
                { label: t('bookings.col.total'), value: formatTry(refundTarget.totalTry, localeTag) },
              ]}
            />
            <Field
              label={t('bookings.refund.amount')}
              htmlFor="refund-amount"
              hint={t('bookings.refund.max', { max: refundTarget.totalTry - refundTarget.refundedTry })}
            >
              <Input
                id="refund-amount"
                type="number"
                min={1}
                max={refundTarget.totalTry - refundTarget.refundedTry}
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
              />
            </Field>
            <Field label={t('common.reason')} htmlFor="refund-reason">
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder={t('common.reasonPlaceholder')}
              />
            </Field>
            {refundError ? (
              <p role="alert" style={{ color: 'var(--c-danger)', fontWeight: 600 }}>
                {refundError}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Ödeme detayı */}
      <Modal
        open={Boolean(detail)}
        title={detail ? `${detail.reference} — ${t('bookings.timeline')}` : ''}
        onClose={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>{t('common.close')}</Button>}
      >
        {detail ? (
          <div className="col">
            <KeyValue
              items={[
                { label: t('bookings.col.kind'), value: t(`bookings.kind.${detail.kind}` as AdminTranslationKey) },
                { label: t('bookings.col.guest'), value: detail.guestName },
                { label: t('bookings.col.provider'), value: detail.providerName },
                { label: t('bookings.col.total'), value: formatTry(detail.totalTry, localeTag) },
                { label: t('bookings.col.fee'), value: `${formatTry(detail.platformFeeTry, localeTag)} (%${detail.commissionPct})` },
                {
                  label: t('bookings.col.payment'),
                  value: <Badge tone={paymentTone(detail.paymentStatus)}>{t(`bookings.payment.${detail.paymentStatus}` as AdminTranslationKey)}</Badge>,
                },
                { label: 'Sağlayıcı', value: detail.provider },
              ]}
            />
            <div className="timeline">
              {detail.timeline.map((step, index) => (
                <div className="timeline-item" key={`${step.status}-${index}`}>
                  <div className="timeline-dot" />
                  <div>
                    <strong className="small">{t(`bookings.payment.${step.status}` as AdminTranslationKey)}</strong>
                    <div className="small muted">{formatDateTime(step.at, localeTag)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Uyuşmazlık çözümü */}
      <Modal
        open={Boolean(disputeTarget)}
        title={t('bookings.dispute.resolve')}
        onClose={() => setDisputeTarget(null)}
        footer={
          <>
            <Button onClick={() => setDisputeTarget(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!disputeNote.trim()}
              onClick={() => {
                if (!disputeTarget) return;
                disputeMutation.mutate({ id: disputeTarget.id, outcome, note: disputeNote });
              }}
            >
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        {disputeTarget ? (
          <div className="col">
            <p className="muted small">
              {disputeTarget.reference} · {disputeTarget.reason}
            </p>
            <Field label={t('bookings.dispute.outcome')} htmlFor="dispute-outcome">
              <Select
                id="dispute-outcome"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as DisputeOutcome)}
                options={OUTCOMES.map((item) => ({
                  value: item,
                  label: t(`bookings.dispute.${item}` as AdminTranslationKey),
                }))}
              />
            </Field>
            <Field label={t('common.note')} htmlFor="dispute-note">
              <Textarea id="dispute-note" value={disputeNote} onChange={(event) => setDisputeNote(event.target.value)} />
            </Field>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}
