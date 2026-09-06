import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../auth/session';
import { LineChart } from '../charts/Charts';
import { DataTable, type Column } from '../components/DataTable';
import { ConfirmDialog, useConfirm } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, Field, Input, Loading, PageHeader, Pagination, Stat, Tabs } from '../components/ui';
import { adminApi } from '../data';
import type { AgentFinding, AgentPullRequest, AgentRun } from '../data/adminApi';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { chartColors } from '../theme/tokens';
import { formatDateTime, formatDuration, formatPercent, formatRelative } from '../utils/format';

export function AgentsPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();
  const [tab, setTab] = useState<'runs' | 'prs' | 'findings' | 'system'>('runs');

  const runTable = useTableQuery({ prefix: 'run', defaultSort: 'startedAt', filterKeys: [] });
  const findingTable = useTableQuery({ prefix: 'fnd', defaultSort: 'foundAt', filterKeys: [] });

  const runsQuery = useQuery({
    queryKey: ['admin', 'agentRuns', runTable.page, runTable.query, runTable.sort, runTable.dir],
    queryFn: () =>
      adminApi.agents.runs({
        page: runTable.page,
        pageSize: runTable.pageSize,
        query: runTable.query,
        sort: runTable.sort,
        dir: runTable.dir,
      }),
    enabled: tab === 'runs',
  });

  const prsQuery = useQuery({ queryKey: ['admin', 'agentPrs'], queryFn: () => adminApi.agents.pullRequests(), enabled: tab === 'prs' });

  const findingsQuery = useQuery({
    queryKey: ['admin', 'findings', findingTable.page, findingTable.query, findingTable.sort, findingTable.dir],
    queryFn: () =>
      adminApi.agents.findings({
        page: findingTable.page,
        pageSize: findingTable.pageSize,
        query: findingTable.query,
        sort: findingTable.sort,
        dir: findingTable.dir,
      }),
    enabled: tab === 'findings',
  });

  const ciQuery = useQuery({ queryKey: ['admin', 'ci'], queryFn: () => adminApi.agents.ci(), enabled: tab === 'system' });
  const healthQuery = useQuery({ queryKey: ['admin', 'health'], queryFn: () => adminApi.agents.health(), enabled: tab === 'system' });
  const releasesQuery = useQuery({ queryKey: ['admin', 'releases'], queryFn: () => adminApi.agents.releases(), enabled: tab === 'system' });

  const rollbackMutation = useMutation({
    mutationFn: (input: { version: string; reason: string }) => adminApi.agents.rollback(input.version, input.reason),
    onSuccess: () => {
      notify(t('agents.release.done'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'releases'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const runColumns: Column<AgentRun>[] = [
    { key: 'agent', header: t('agents.col.agent'), sortable: true, render: (row) => <strong className="small mono">{row.agent}</strong> },
    { key: 'task', header: t('agents.col.task'), render: (row) => <span className="small">{row.task}</span> },
    {
      key: 'status',
      header: t('agents.col.status'),
      render: (row) => (
        <Badge tone={row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'info'}>
          {t(`agents.status.${row.status}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'startedAt',
      header: t('agents.col.started'),
      sortable: true,
      render: (row) => <span className="small muted">{formatRelative(row.startedAt, localeTag)}</span>,
    },
    {
      key: 'durationSec',
      header: t('agents.col.duration'),
      sortable: true,
      align: 'right',
      render: (row) => (row.status === 'running' ? '—' : formatDuration(row.durationSec)),
    },
    { key: 'filesChanged', header: t('agents.col.files'), align: 'right', render: (row) => row.filesChanged },
    {
      key: 'pr',
      header: t('agents.col.pr'),
      align: 'right',
      render: (row) => (row.prNumber ? <span className="mono small">#{row.prNumber}</span> : <span className="subtle">—</span>),
    },
    {
      key: 'findings',
      header: t('agents.col.findings'),
      align: 'right',
      render: (row) => (row.findings > 0 ? <Badge tone="warning">{row.findings}</Badge> : <span className="subtle">0</span>),
    },
  ];

  const prColumns: Column<AgentPullRequest>[] = [
    { key: 'number', header: 'PR', render: (row) => <span className="mono">#{row.number}</span> },
    { key: 'title', header: t('common.title'), render: (row) => <span className="small">{row.title}</span> },
    { key: 'agent', header: t('agents.col.agent'), render: (row) => <span className="mono small">{row.agent}</span> },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.status === 'merged' ? 'success' : row.status === 'open' ? 'info' : 'neutral'}>
          {t(`agents.pr.status.${row.status}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'checks',
      header: 'CI',
      render: (row) => (
        <Badge tone={row.checks === 'passing' ? 'success' : row.checks === 'failing' ? 'danger' : 'warning'}>
          {t(`agents.checks.${row.checks}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'diff',
      header: '+/−',
      align: 'right',
      render: (row) => (
        <span className="small mono">
          <span style={{ color: 'var(--c-success)' }}>+{row.additions}</span>{' '}
          <span style={{ color: 'var(--c-danger)' }}>−{row.deletions}</span>
        </span>
      ),
    },
    { key: 'openedAt', header: t('common.created'), render: (row) => <span className="small muted">{formatRelative(row.openedAt, localeTag)}</span> },
  ];

  const findingColumns: Column<AgentFinding>[] = [
    { key: 'title', header: t('common.title'), render: (row) => <span className="small">{row.title}</span> },
    { key: 'agent', header: t('agents.col.agent'), render: (row) => <span className="mono small">{row.agent}</span> },
    { key: 'area', header: t('agents.finding.area'), render: (row) => <Badge>{row.area}</Badge> },
    {
      key: 'severity',
      header: t('agents.finding.severity'),
      sortable: true,
      render: (row) => (
        <Badge tone={row.severity === 'critical' || row.severity === 'high' ? 'danger' : row.severity === 'medium' ? 'warning' : 'neutral'}>
          {row.severity}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.status === 'fixed' ? 'success' : row.status === 'open' ? 'warning' : 'neutral'}>
          {t(`agents.finding.status.${row.status}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    { key: 'foundAt', header: t('common.date'), sortable: true, render: (row) => <span className="small muted">{formatRelative(row.foundAt, localeTag)}</span> },
  ];

  return (
    <>
      <PageHeader title={t('agents.title')} subtitle={t('agents.subtitle')} />

      <Tabs
        ariaLabel={t('agents.title')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'runs', label: t('agents.tab.runs') },
          { value: 'prs', label: t('agents.tab.prs') },
          { value: 'findings', label: t('agents.tab.findings') },
          { value: 'system', label: t('agents.tab.system') },
        ]}
      />

      {tab === 'runs' ? (
        <>
          <div className="toolbar">
            <Field label={t('common.search')} htmlFor="run-search" grow>
              <Input
                id="run-search"
                type="search"
                value={runTable.query}
                placeholder={t('common.searchPlaceholder')}
                onChange={(event) => runTable.setQuery(event.target.value)}
              />
            </Field>
            <Button onClick={runTable.reset}>{t('common.clear')}</Button>
          </div>
          <DataTable
            caption={t('agents.tab.runs')}
            columns={runColumns}
            rows={runsQuery.data?.items ?? []}
            rowKey={(row) => row.id}
            loading={runsQuery.isLoading}
            error={runsQuery.error}
            sort={runTable.sort}
            dir={runTable.dir}
            onSort={runTable.toggleSort}
          />
          <Pagination
            page={runsQuery.data?.page ?? 1}
            pageSize={runsQuery.data?.pageSize ?? runTable.pageSize}
            total={runsQuery.data?.total ?? 0}
            onPage={runTable.setPage}
          />
        </>
      ) : null}

      {tab === 'prs' ? (
        <DataTable
          caption={t('agents.tab.prs')}
          columns={prColumns}
          rows={prsQuery.data ?? []}
          rowKey={(row) => String(row.number)}
          loading={prsQuery.isLoading}
          error={prsQuery.error}
        />
      ) : null}

      {tab === 'findings' ? (
        <>
          <div className="toolbar">
            <Field label={t('common.search')} htmlFor="fnd-search" grow>
              <Input
                id="fnd-search"
                type="search"
                value={findingTable.query}
                placeholder={t('common.searchPlaceholder')}
                onChange={(event) => findingTable.setQuery(event.target.value)}
              />
            </Field>
            <Button onClick={findingTable.reset}>{t('common.clear')}</Button>
          </div>
          <DataTable
            caption={t('agents.tab.findings')}
            columns={findingColumns}
            rows={findingsQuery.data?.items ?? []}
            rowKey={(row) => row.id}
            loading={findingsQuery.isLoading}
            error={findingsQuery.error}
            sort={findingTable.sort}
            dir={findingTable.dir}
            onSort={findingTable.toggleSort}
          />
          <Pagination
            page={findingsQuery.data?.page ?? 1}
            pageSize={findingsQuery.data?.pageSize ?? findingTable.pageSize}
            total={findingsQuery.data?.total ?? 0}
            onPage={findingTable.setPage}
          />
        </>
      ) : null}

      {tab === 'system' ? (
        <div className="col" style={{ gap: 14 }}>
          {healthQuery.isLoading ? <Loading /> : null}
          {healthQuery.data ? (
            <>
              <div className="grid grid-4">
                <Stat label={t('agents.health.errorRate')} value={formatPercent(healthQuery.data.errorRatePct)} />
                <Stat label={t('agents.health.p95')} value={`${healthQuery.data.p95Ms} ms`} />
                <Stat label={t('agents.health.crashFree')} value={formatPercent(healthQuery.data.crashFreePct)} />
                <Stat label={t('agents.health.uptime')} value={formatPercent(healthQuery.data.uptimePct)} />
              </div>
              <div className="grid grid-2">
                <Card title={t('agents.health.errors')}>
                  <LineChart
                    label={t('agents.health.errors')}
                    series={[{ name: t('agents.health.errorRate'), color: 'var(--c-danger)', points: healthQuery.data.errorSeries }]}
                  />
                </Card>
                <Card title={t('agents.health.latency')}>
                  <LineChart
                    label={t('agents.health.latency')}
                    series={[{ name: t('agents.health.p95'), color: chartColors[2] as string, points: healthQuery.data.latencySeries }]}
                  />
                </Card>
              </div>
            </>
          ) : null}

          <Card title={t('agents.ci')}>
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">{t('agents.ci')}</caption>
                <thead>
                  <tr>
                    <th>Pipeline</th>
                    <th>Branch</th>
                    <th>{t('common.status')}</th>
                    <th style={{ textAlign: 'right' }}>{t('agents.col.duration')}</th>
                    <th>{t('common.date')}</th>
                    <th>Commit</th>
                  </tr>
                </thead>
                <tbody>
                  {(ciQuery.data ?? []).map((run) => (
                    <tr key={run.id}>
                      <td className="mono small">{run.pipeline}</td>
                      <td className="mono small">{run.branch}</td>
                      <td>
                        <Badge tone={run.status === 'passing' ? 'success' : run.status === 'failing' ? 'danger' : 'info'}>
                          {run.status === 'passing'
                            ? t('agents.checks.passing')
                            : run.status === 'failing'
                              ? t('agents.checks.failing')
                              : t('agents.status.running')}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatDuration(run.durationSec)}</td>
                      <td className="small muted">{formatRelative(run.at, localeTag)}</td>
                      <td className="mono small">{run.commit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={t('agents.releases')}>
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">{t('agents.releases')}</caption>
                <thead>
                  <tr>
                    <th>{t('agents.release.version')}</th>
                    <th>{t('agents.release.channel')}</th>
                    <th>{t('common.date')}</th>
                    <th style={{ textAlign: 'right' }}>{t('agents.release.adoption')}</th>
                    <th style={{ textAlign: 'right' }}>{t('agents.health.crashFree')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(releasesQuery.data ?? []).map((release) => (
                    <tr key={release.version}>
                      <td>
                        <div className="row-tight">
                          <strong className="mono small">{release.version}</strong>
                          {release.current ? <Badge tone="success">{t('agents.release.current')}</Badge> : null}
                        </div>
                        <div className="small muted">{release.notes}</div>
                      </td>
                      <td>
                        <Badge tone={release.channel === 'production' ? 'info' : 'accent'}>{release.channel}</Badge>
                      </td>
                      <td className="small muted">{formatDateTime(release.releasedAt, localeTag)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPercent(release.adoptionPct)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPercent(release.crashFreePct)}</td>
                      <td>
                        {can('agents.rollback') && !release.current ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              confirm({
                                title: t('agents.release.confirmRollback', { version: release.version }),
                                reasonRequired: true,
                                danger: true,
                                confirmLabel: t('agents.release.rollback'),
                                onConfirm: (reason) => rollbackMutation.mutateAsync({ version: release.version, reason }),
                              })
                            }
                          >
                            {t('agents.release.rollback')}
                          </Button>
                        ) : (
                          <span className="subtle small">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}
