import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { BarChart, DonutChart, LineChart } from '../charts/Charts';
import { Card, ErrorNote, Loading, PageHeader, Stat } from '../components/ui';
import { adminApi } from '../data';
import type { MetricRange } from '../data/adminApi';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { chartColors } from '../theme/tokens';
import { formatDateTime, formatNumber, formatTry } from '../utils/format';

const RANGES: MetricRange[] = ['7d', '30d', '90d'];

export function OverviewPage() {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<MetricRange>('30d');
  const query = useQuery({
    queryKey: ['admin', 'overview', range],
    queryFn: () => adminApi.metrics.overview(range),
  });

  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        subtitle={t('overview.subtitle')}
        actions={
          <div className="row-tight" role="group" aria-label={t('common.range')}>
            {RANGES.map((item) => (
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
        }
      />

      {query.isLoading ? <Loading /> : null}
      {query.error ? <ErrorNote error={query.error} onRetry={() => void query.refetch()} /> : null}

      {query.data ? (
        <div className="col" style={{ gap: 16 }}>
          <div className="grid grid-4">
            {query.data.kpis.map((kpi) => (
              <Stat
                key={kpi.key}
                label={t(`overview.kpi.${kpi.key}` as AdminTranslationKey)}
                value={kpi.format === 'currency' ? formatTry(kpi.value, localeTag) : formatNumber(kpi.value, localeTag)}
                delta={kpi.deltaPct}
              />
            ))}
          </div>

          <div className="grid grid-2">
            <Card title={t('overview.chart.dau')}>
              <LineChart
                label={t('overview.chart.dau')}
                series={[{ name: t('overview.kpi.dau'), color: chartColors[0] as string, points: query.data.series.dau }]}
              />
            </Card>
            <Card title={t('overview.chart.signups')}>
              <LineChart
                label={t('overview.chart.signups')}
                series={[
                  { name: t('overview.kpi.signups'), color: chartColors[1] as string, points: query.data.series.signups },
                ]}
              />
            </Card>
            <Card title={t('overview.chart.content')}>
              <LineChart
                label={t('overview.chart.content')}
                area={false}
                series={[
                  { name: t('overview.kpi.posts'), color: chartColors[2] as string, points: query.data.series.posts },
                  { name: t('overview.kpi.routes'), color: chartColors[3] as string, points: query.data.series.routes },
                ]}
              />
            </Card>
            <Card title={t('overview.chart.revenue')}>
              <LineChart
                label={t('overview.chart.revenue')}
                series={[
                  { name: t('overview.kpi.revenue'), color: chartColors[4] as string, points: query.data.series.revenueTry },
                  { name: t('overview.kpi.bookings'), color: chartColors[5] as string, points: query.data.series.bookings },
                ]}
              />
            </Card>
          </div>

          <div className="grid grid-3">
            <Card title={t('overview.plans')}>
              <DonutChart
                label={t('overview.plans')}
                data={query.data.planBreakdown.map((item, i) => ({
                  label: t(`plan.${item.plan}` as AdminTranslationKey),
                  value: item.users,
                  color: chartColors[i % chartColors.length] as string,
                }))}
              />
            </Card>

            <Card title={t('overview.modules')}>
              <BarChart
                label={t('overview.modules')}
                data={query.data.moduleUsage.map((item) => ({ label: item.module, value: item.sessions }))}
              />
            </Card>

            <Card title={t('overview.alerts')} subtitle={`${t('overview.generatedAt')}: ${formatDateTime(query.data.generatedAt, localeTag)}`}>
              <div className="col">
                <AlertRow
                  to="/sos"
                  label={t('overview.openSos')}
                  value={query.data.openSosCount}
                  tone={query.data.openSosCount > 0 ? 'var(--c-danger)' : 'var(--c-success)'}
                />
                <AlertRow
                  to="/moderation"
                  label={t('overview.moderationQueue')}
                  value={query.data.moderationQueueCount}
                  tone="var(--c-warning)"
                />
                <AlertRow
                  to="/verification"
                  label={t('overview.pendingVerification')}
                  value={query.data.pendingVerificationCount}
                  tone="var(--c-info)"
                />
                <hr style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: '4px 0' }} />
                <div className="small muted">{t('overview.agents')}</div>
                <div className="grid grid-2" style={{ gap: 8 }}>
                  <Stat label={t('overview.agents.running')} value={String(query.data.agentSummary.running)} />
                  <Stat label={t('overview.agents.succeeded')} value={String(query.data.agentSummary.succeeded24h)} />
                  <Stat label={t('overview.agents.failed')} value={String(query.data.agentSummary.failed24h)} />
                  <Stat label={t('overview.agents.prs')} value={String(query.data.agentSummary.openPrs)} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AlertRow({ to, label, value, tone }: { to: string; label: string; value: number; tone: string }) {
  return (
    <Link to={to} className="row" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: tone }} aria-hidden="true" />
      <span>{label}</span>
      <span className="spacer" />
      <strong style={{ fontSize: 18 }}>{value}</strong>
    </Link>
  );
}
