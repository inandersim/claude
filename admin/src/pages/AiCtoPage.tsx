/**
 * AI Geliştirme Komuta Merkezi.
 *
 * Doğal dilde bir geliştirme talebi alınır ve **kod olarak yorumlanmadan önce**
 * analiz edilir: ne anlaşıldı, hangi sistemler etkilenir, risk seviyesi ne,
 * insan onayı gerekiyor mu. Onaylanırsa kayıt açılır ve ajanlar devralır.
 *
 * Ekranın kod yazma yetkisi yoktur; bu kasıtlıdır (bkz. `docs/AI_CTO.md` §0).
 * Kural motoru da burada değil: risk, kapılar ve onay kategorileri
 * `agents/cto/` içinden gelir, panel yalnızca gösterir.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../auth/session';
import { DataTable, type Column } from '../components/DataTable';
import { useToast } from '../components/Toast';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Tabs,
  Textarea,
} from '../components/ui';
import { adminApi } from '../data';
import type { CtoAuditEntry, CtoRequest, CtoRiskLevel, CtoStep } from '../data/adminApi';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDateTime, formatRelative } from '../utils/format';

const RISK_TONE: Record<CtoRiskLevel, 'success' | 'info' | 'warning' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const STEP_MARK: Record<CtoStep['status'], string> = {
  pending: '·',
  running: '…',
  passed: '✓',
  failed: '✗',
  skipped: '↷',
  blocked: '⏸',
};

const STEP_TONE: Record<CtoStep['status'], 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  pending: 'neutral',
  running: 'info',
  passed: 'success',
  failed: 'danger',
  skipped: 'neutral',
  blocked: 'warning',
};

/** Kaç adım geçti / toplam — kayıt üzerinden sayılır, ayrıca hesaplanmaz. */
function progressOf(request: CtoRequest): { done: number; total: number } {
  const done = request.steps.filter((s) => s.status === 'passed' || s.status === 'skipped').length;
  return { done, total: request.steps.length };
}

function StepList({ steps }: { steps: CtoStep[] }) {
  const { t } = useI18n();
  return (
    <ol className="cto-steps">
      {steps.map((step) => (
        <li key={step.id} className={`cto-step cto-step--${step.status}`}>
          <span className="cto-step__mark" aria-hidden="true">
            {STEP_MARK[step.status]}
          </span>
          <div className="cto-step__body">
            <div className="cto-step__head">
              <strong>{step.label}</strong>
              <Badge tone={STEP_TONE[step.status]}>
                {t(`cto.step.${step.status}` as AdminTranslationKey)}
              </Badge>
            </div>
            <p className="small muted">
              {t('cto.steps.gate')}: {step.gate}
            </p>
            <p className="small">
              {t('cto.steps.evidence')}:{' '}
              {step.evidence ?? step.note ?? <span className="subtle">{t('cto.steps.noEvidence')}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Analysis({ request, preview }: { request: CtoRequest; preview?: boolean }) {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  return (
    <>
      <Card
        title={t('cto.analysis.title')}
        subtitle={preview ? t('cto.analysis.hint') : formatDateTime(request.createdAt, localeTag)}
      >
        <p className="cto-request">{request.request}</p>

        <div className="cto-grid">
          <section>
            <h4>{t('cto.analysis.risk')}</h4>
            <p>
              <Badge tone={RISK_TONE[request.risk.level]}>
                {t(`cto.risk.${request.risk.level}` as AdminTranslationKey)}
              </Badge>{' '}
              <span className="small muted">· {request.autonomy}</span>
            </p>
            {request.risk.reasons.length > 0 && (
              <ul className="small muted">
                {request.risk.reasons.map((r, i) => (
                  <li key={`${r.kind}-${r.value}-${i}`}>
                    {r.level} ← {r.kind}: <code>{r.value}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4>{t('cto.analysis.impact')}</h4>
            {request.impact.unresolved ? (
              <p className="small warning-text">{t('cto.analysis.noModule')}</p>
            ) : (
              <p className="small">
                <strong>{t('cto.field.modules')}:</strong> {request.impact.modules.join(', ')}
              </p>
            )}
            {request.impact.tables.length > 0 && (
              <p className="small">
                <strong>{t('cto.field.tables')}:</strong> {request.impact.tables.join(', ')}
              </p>
            )}
            {request.impact.paths.length > 0 && (
              <p className="small muted mono">{request.impact.paths.join(' · ')}</p>
            )}
          </section>

          <section>
            <h4>{t('cto.analysis.understanding')}</h4>
            {request.understanding.matched.length === 0 ? (
              <p className="small subtle">—</p>
            ) : (
              <ul className="small">
                {request.understanding.matched.map((m) => (
                  <li key={m.module}>
                    <strong>{m.module}</strong>{' '}
                    <span className="muted">
                      ({t('cto.analysis.matchedBy')}: “{m.term}”)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4>{t('cto.analysis.models')}</h4>
            <ul className="small">
              <li>
                {t('cto.field.architecture')}: <code>{request.models.architecture}</code>
              </li>
              <li>
                {t('cto.field.implement')}: <code>{request.models.implement}</code>
              </li>
              <li>
                {t('cto.field.review')}: <code>{request.models.review}</code>
              </li>
            </ul>
          </section>
        </div>

        {request.approvals.length > 0 && (
          <div className="cto-approvals">
            <h4>{t('cto.analysis.approvals')}</h4>
            <ul className="small">
              {request.approvals.map((a) => (
                <li key={a.id}>
                  <Badge tone="warning">{a.label}</Badge>{' '}
                  <span className="muted">
                    ({a.kind}: <code>{a.because}</code>)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {request.understanding.questions.length > 0 && (
          <div className="cto-questions">
            <h4>{t('cto.analysis.questions')}</h4>
            <ul className="small">
              {request.understanding.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card title={t('cto.steps.title')}>
        <StepList steps={request.steps} />
      </Card>
    </>
  );
}

function NewRequestTab() {
  const { t } = useI18n();
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<CtoRequest | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: (value: string) => adminApi.cto.analyze(value),
    onSuccess: (data) => setPreview(data),
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const submitMutation = useMutation({
    mutationFn: (value: string) => adminApi.cto.submit(value),
    onSuccess: (data) => {
      setPreview(data);
      setText('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ctoRequests'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ctoAudit'] });
      notify(data.id);
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const busy = analyzeMutation.isPending || submitMutation.isPending;

  return (
    <>
      <Card title={t('cto.note.title')}>
        <p className="small">{t('cto.note.body')}</p>
        <p className="small muted mono">{t('cto.note.doc')}</p>
      </Card>

      <Card>
        <Field label={t('cto.input.label')}>
          <Textarea
            rows={5}
            value={text}
            placeholder={t('cto.input.placeholder')}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div className="row gap">
          <Button
            variant="primary"
            disabled={!text.trim() || busy}
            onClick={() => analyzeMutation.mutate(text)}
          >
            {t('cto.action.analyze')}
          </Button>
          <Button
            disabled={!text.trim() || busy || !can('cto.submit')}
            onClick={() => submitMutation.mutate(text)}
          >
            {t('cto.action.submit')}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setText('');
              setPreview(null);
            }}
          >
            {t('cto.action.clear')}
          </Button>
        </div>
      </Card>

      {busy && <Loading />}
      {preview && <Analysis request={preview} preview={submitMutation.isIdle} />}
    </>
  );
}

function RequestsTab() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CtoRequest | null>(null);
  const [evidence, setEvidence] = useState('');

  const listQuery = useQuery({
    queryKey: ['admin', 'ctoRequests', page],
    queryFn: () => adminApi.cto.list({ page, pageSize: 10 }),
  });

  const approveMutation = useMutation({
    mutationFn: (input: { id: string; evidence: string }) =>
      adminApi.cto.approve(input.id, input.evidence),
    onSuccess: (data) => {
      setSelected(data);
      setEvidence('');
      notify(t('cto.approve.done'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ctoRequests'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ctoAudit'] });
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const columns: Column<CtoRequest>[] = [
    {
      key: 'request',
      header: t('cto.col.request'),
      render: (row) => (
        <button type="button" className="linklike" onClick={() => setSelected(row)}>
          {row.request.length > 90 ? `${row.request.slice(0, 90)}…` : row.request}
        </button>
      ),
    },
    {
      key: 'risk',
      header: t('cto.col.risk'),
      render: (row) => (
        <Badge tone={RISK_TONE[row.risk.level]}>
          {t(`cto.risk.${row.risk.level}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'progress',
      header: t('cto.col.progress'),
      align: 'right',
      render: (row) => {
        const { done, total } = progressOf(row);
        const blocked = row.steps.some((s) => s.status === 'blocked');
        return (
          <span className={blocked ? 'warning-text small' : 'small'}>
            {done}/{total}
            {blocked ? ' ⏸' : ''}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: t('cto.col.status'),
      render: (row) => (
        <Badge tone={row.status === 'done' ? 'success' : row.status === 'cancelled' ? 'neutral' : 'info'}>
          {t(`cto.status.${row.status}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: t('cto.col.created'),
      render: (row) => <span className="small muted">{formatRelative(row.createdAt, localeTag)}</span>,
    },
  ];

  if (listQuery.isError) return <ErrorNote error={listQuery.error} onRetry={() => void listQuery.refetch()} />;
  if (listQuery.isLoading) return <Loading />;

  const data = listQuery.data;
  if (!data || data.items.length === 0) return <Empty message={t('cto.empty')} />;

  const awaiting = selected?.steps.filter((s) => s.status === 'blocked') ?? [];

  return (
    <>
      <Card>
        <DataTable
          caption={t('cto.tab.requests')}
          columns={columns}
          rows={data.items}
          rowKey={(row) => row.id}
        />
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPage={setPage}
        />
      </Card>

      {selected && (
        <>
          <Analysis request={selected} />
          {(selected.issueUrl || selected.prUrl) && (
            <Card>
              <ul className="small">
                {selected.issueUrl && (
                  <li>
                    {t('cto.issue')}:{' '}
                    <a href={selected.issueUrl} target="_blank" rel="noreferrer">
                      {selected.issueUrl}
                    </a>
                  </li>
                )}
                {selected.prUrl && (
                  <li>
                    {t('cto.pr')}:{' '}
                    <a href={selected.prUrl} target="_blank" rel="noreferrer">
                      {selected.prUrl}
                    </a>
                  </li>
                )}
              </ul>
            </Card>
          )}
          {awaiting.length > 0 && can('cto.approve') && (
            <Card title={t('cto.approve.title')}>
              <p className="small">{t('cto.approve.body')}</p>
              <Field label={t('cto.audit.evidence')}>
                <Input
                  value={evidence}
                  placeholder={t('cto.approve.placeholder')}
                  onChange={(e) => setEvidence(e.target.value)}
                />
              </Field>
              <Button
                variant="primary"
                disabled={!evidence.trim() || approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: selected.id, evidence })}
              >
                {t('cto.action.approve')}
              </Button>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function PolicyTab() {
  const { t } = useI18n();
  const policyQuery = useQuery({ queryKey: ['admin', 'ctoPolicy'], queryFn: () => adminApi.cto.policy() });

  if (policyQuery.isError)
    return <ErrorNote error={policyQuery.error} onRetry={() => void policyQuery.refetch()} />;
  if (policyQuery.isLoading || !policyQuery.data) return <Loading />;
  const policy = policyQuery.data;

  return (
    <>
      <Card title={t('cto.policy.autonomy')} subtitle={t('cto.policy.source')}>
        <p>
          <Badge tone="info">{policy.autonomy}</Badge> {policy.autonomyName}
        </p>
        <ul className="small">
          <li>
            {t('cto.policy.staging')}:{' '}
            <Badge tone={policy.canDeployStaging ? 'success' : 'neutral'}>
              {policy.canDeployStaging ? '✓' : '✗'}
            </Badge>
          </li>
          <li>
            {t('cto.policy.production')}:{' '}
            <Badge tone={policy.canDeployProduction ? 'success' : 'neutral'}>
              {policy.canDeployProduction ? '✓' : '✗'}
            </Badge>
          </li>
        </ul>
      </Card>

      <Card title={t('cto.policy.approvals')}>
        <ul className="small">
          {policy.humanApproval.map((a) => (
            <li key={a.id}>
              <code>{a.id}</code> — {a.label}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t('cto.policy.neverSkip')}>
        <p className="small mono">{policy.neverSkip.join(' · ')}</p>
      </Card>

      <Card title={t('cto.policy.steps')}>
        <ol className="small">
          {policy.steps.map((s) => (
            <li key={s.id}>
              <strong>{s.label}</strong> — <span className="muted">{s.gate}</span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}

function AuditTab() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const [page, setPage] = useState(1);
  const auditQuery = useQuery({
    queryKey: ['admin', 'ctoAudit', page],
    queryFn: () => adminApi.cto.audit({ page, pageSize: 20 }),
  });

  const columns: Column<CtoAuditEntry>[] = [
    {
      key: 'at',
      header: t('cto.col.created'),
      render: (row) => <span className="small muted">{formatDateTime(row.at, localeTag)}</span>,
    },
    { key: 'agent', header: t('cto.audit.agent'), render: (row) => <code className="small">{row.agent}</code> },
    { key: 'action', header: t('cto.audit.action'), render: (row) => <span className="small">{row.action}</span> },
    {
      key: 'step',
      header: t('cto.audit.step'),
      render: (row) => <span className="small muted">{row.step ?? '—'}</span>,
    },
    {
      key: 'evidence',
      header: t('cto.audit.evidence'),
      render: (row) => <span className="small">{row.evidence ?? '—'}</span>,
    },
  ];

  if (auditQuery.isError) return <ErrorNote error={auditQuery.error} onRetry={() => void auditQuery.refetch()} />;
  if (auditQuery.isLoading || !auditQuery.data) return <Loading />;
  if (auditQuery.data.items.length === 0) return <Empty message={t('cto.empty')} />;

  return (
    <Card subtitle={t('cto.audit.appendOnly')}>
      <DataTable
        caption={t('cto.tab.audit')}
        columns={columns}
        rows={auditQuery.data.items}
        rowKey={(row) => `${row.at}-${row.action}-${row.requestId ?? ''}`}
      />
      <Pagination
        page={auditQuery.data.page}
        pageSize={auditQuery.data.pageSize}
        total={auditQuery.data.total}
        onPage={setPage}
      />
    </Card>
  );
}

export function AiCtoPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'new' | 'requests' | 'policy' | 'audit'>('new');

  return (
    <>
      <PageHeader title={t('cto.title')} subtitle={t('cto.subtitle')} />
      <Tabs
        ariaLabel={t('cto.title')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'new', label: t('cto.tab.new') },
          { value: 'requests', label: t('cto.tab.requests') },
          { value: 'policy', label: t('cto.tab.policy') },
          { value: 'audit', label: t('cto.tab.audit') },
        ]}
      />
      {tab === 'new' && <NewRequestTab />}
      {tab === 'requests' && <RequestsTab />}
      {tab === 'policy' && <PolicyTab />}
      {tab === 'audit' && <AuditTab />}
    </>
  );
}
