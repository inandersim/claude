import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../auth/session';
import { BarChart, LineChart } from '../charts/Charts';
import { DataTable, type Column } from '../components/DataTable';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, Field, Input, Loading, PageHeader, Pagination, ProgressBar, Select, Stat, Tabs } from '../components/ui';
import { adminApi } from '../data';
import type { AsoKeyword, Campaign, MarketingChannel, SocialPostItem } from '../data/adminApi';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { chartColors } from '../theme/tokens';
import { formatDate, formatDateTime, formatNumber, formatPercent, formatTry } from '../utils/format';

const CHANNELS: MarketingChannel[] = ['instagram', 'tiktok', 'youtube', 'x', 'newsletter', 'app_store'];
const POST_STATUSES = ['draft', 'queued', 'published', 'failed'] as const;

export function MarketingPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'calendar' | 'queue' | 'referral' | 'aso'>('calendar');

  const campaignTable = useTableQuery({ prefix: 'cmp', defaultSort: 'startAt', filterKeys: ['channel'] });
  const postTable = useTableQuery({ prefix: 'post', defaultSort: 'scheduledAt', filterKeys: ['channel', 'status'] });

  const campaignsQuery = useQuery({
    queryKey: ['admin', 'campaigns', campaignTable.query, campaignTable.sort, campaignTable.dir, campaignTable.filters, campaignTable.page],
    queryFn: () =>
      adminApi.marketing.campaigns({
        page: campaignTable.page,
        pageSize: campaignTable.pageSize,
        query: campaignTable.query,
        sort: campaignTable.sort,
        dir: campaignTable.dir,
        channel: campaignTable.filters.channel as never,
      }),
    enabled: tab === 'calendar',
  });

  const postsQuery = useQuery({
    queryKey: ['admin', 'posts', postTable.query, postTable.sort, postTable.dir, postTable.filters, postTable.page],
    queryFn: () =>
      adminApi.marketing.posts({
        page: postTable.page,
        pageSize: postTable.pageSize,
        query: postTable.query,
        sort: postTable.sort,
        dir: postTable.dir,
        channel: postTable.filters.channel as never,
        status: postTable.filters.status as never,
      }),
    enabled: tab === 'queue',
  });

  const referralQuery = useQuery({
    queryKey: ['admin', 'referrals'],
    queryFn: () => adminApi.marketing.referrals(),
    enabled: tab === 'referral',
  });

  const asoQuery = useQuery({ queryKey: ['admin', 'aso'], queryFn: () => adminApi.marketing.aso(), enabled: tab === 'aso' });

  const postMutation = useMutation({
    mutationFn: (input: { id: string; status: SocialPostItem['status'] }) =>
      adminApi.marketing.setPostStatus(input.id, input.status),
    onSuccess: () => {
      notify(t('marketing.post.updated'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const campaignColumns: Column<Campaign>[] = [
    {
      key: 'name',
      header: t('marketing.col.campaign'),
      sortable: true,
      render: (row) => (
        <div className="stack-sm">
          <strong className="small">{row.name}</strong>
          <span className="small muted">{row.goal}</span>
        </div>
      ),
    },
    {
      key: 'channel',
      header: t('common.channel'),
      render: (row) => <Badge tone="info">{t(`marketing.channel.${row.channel}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'period',
      header: t('marketing.col.period'),
      render: (row) => (
        <span className="small">
          {formatDate(row.startAt, localeTag)} → {formatDate(row.endAt, localeTag)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.status === 'running' ? 'success' : row.status === 'planned' ? 'info' : row.status === 'paused' ? 'warning' : 'neutral'}>
          {t(`marketing.campaign.status.${row.status}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'budget',
      header: t('marketing.col.budget'),
      sortable: true,
      align: 'right',
      render: (row) => (
        <div className="stack-sm" style={{ minWidth: 130 }}>
          <span className="small">
            {formatTry(row.spentTry, localeTag)} / {formatTry(row.budgetTry, localeTag)}
          </span>
          <ProgressBar pct={(row.spentTry / Math.max(1, row.budgetTry)) * 100} />
        </div>
      ),
    },
    { key: 'installs', header: t('marketing.col.installs'), align: 'right', render: (row) => formatNumber(row.installs, localeTag) },
    { key: 'signups', header: t('marketing.col.signups'), align: 'right', render: (row) => formatNumber(row.signups, localeTag) },
    {
      key: 'roi',
      header: t('marketing.col.roi'),
      align: 'right',
      render: (row) => (
        <span style={{ color: row.roiPct >= 0 ? 'var(--c-success)' : 'var(--c-danger)', fontWeight: 700 }}>
          {formatPercent(row.roiPct)}
        </span>
      ),
    },
  ];

  const postColumns: Column<SocialPostItem>[] = [
    {
      key: 'body',
      header: t('marketing.col.post'),
      render: (row) => <span className="small" style={{ display: 'block', maxWidth: 460 }}>{row.body}</span>,
    },
    {
      key: 'channel',
      header: t('common.channel'),
      sortable: true,
      render: (row) => <Badge tone="accent">{t(`marketing.channel.${row.channel}` as AdminTranslationKey)}</Badge>,
    },
    {
      key: 'scheduledAt',
      header: t('marketing.col.scheduled'),
      sortable: true,
      render: (row) => <span className="small">{formatDateTime(row.scheduledAt, localeTag)}</span>,
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <Badge tone={row.status === 'published' ? 'success' : row.status === 'failed' ? 'danger' : row.status === 'queued' ? 'info' : 'neutral'}>
          {t(`marketing.post.status.${row.status}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'impressions',
      header: t('marketing.col.impressions'),
      sortable: true,
      align: 'right',
      render: (row) => formatNumber(row.impressions, localeTag),
    },
    { key: 'clicks', header: t('marketing.col.clicks'), align: 'right', render: (row) => formatNumber(row.clicks, localeTag) },
    { key: 'likes', header: t('marketing.col.likes'), align: 'right', render: (row) => formatNumber(row.likes, localeTag) },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) =>
        can('marketing.act') ? (
          <div className="row-tight">
            {row.status !== 'published' ? (
              <Button size="sm" variant="primary" onClick={() => postMutation.mutate({ id: row.id, status: 'published' })}>
                {t('marketing.post.publish')}
              </Button>
            ) : null}
            {row.status === 'draft' ? (
              <Button size="sm" onClick={() => postMutation.mutate({ id: row.id, status: 'queued' })}>
                {t('marketing.post.queue')}
              </Button>
            ) : null}
          </div>
        ) : (
          <span className="subtle small">—</span>
        ),
    },
  ];

  const asoColumns: Column<AsoKeyword>[] = [
    { key: 'keyword', header: t('marketing.aso.keyword'), render: (row) => <strong className="small">{row.keyword}</strong> },
    { key: 'locale', header: t('common.language'), render: (row) => <span className="mono small">{row.locale}</span> },
    { key: 'rank', header: t('marketing.aso.rank'), align: 'right', render: (row) => row.rank },
    {
      key: 'change',
      header: t('marketing.aso.change'),
      align: 'right',
      render: (row) => {
        const diff = row.prevRank - row.rank;
        return (
          <span style={{ color: diff >= 0 ? 'var(--c-success)' : 'var(--c-danger)', fontWeight: 700 }}>
            {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}
          </span>
        );
      },
    },
    { key: 'volume', header: t('marketing.aso.volume'), align: 'right', render: (row) => formatNumber(row.volume, localeTag) },
    {
      key: 'difficulty',
      header: t('marketing.aso.difficulty'),
      align: 'right',
      render: (row) => (
        <div style={{ minWidth: 90 }}>
          <ProgressBar pct={row.difficulty} tone={row.difficulty > 66 ? 'var(--c-danger)' : 'var(--c-warning)'} />
          <span className="small muted">{row.difficulty}</span>
        </div>
      ),
    },
  ];

  const option = (value: string, key: AdminTranslationKey) => ({ value, label: t(key) });

  return (
    <>
      <PageHeader title={t('marketing.title')} subtitle={t('marketing.subtitle')} />

      <Tabs
        ariaLabel={t('marketing.title')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'calendar', label: t('marketing.tab.calendar') },
          { value: 'queue', label: t('marketing.tab.queue') },
          { value: 'referral', label: t('marketing.tab.referral') },
          { value: 'aso', label: t('marketing.tab.aso') },
        ]}
      />

      {tab === 'calendar' ? (
        <>
          <div className="toolbar">
            <Field label={t('common.search')} htmlFor="cmp-search" grow>
              <Input
                id="cmp-search"
                type="search"
                value={campaignTable.query}
                placeholder={t('common.searchPlaceholder')}
                onChange={(event) => campaignTable.setQuery(event.target.value)}
              />
            </Field>
            <Field label={t('common.channel')} htmlFor="cmp-channel">
              <Select
                id="cmp-channel"
                value={campaignTable.filters.channel}
                onChange={(event) => campaignTable.setFilter('channel', event.target.value)}
                options={[option('all', 'common.all'), ...CHANNELS.map((c) => option(c, `marketing.channel.${c}` as AdminTranslationKey))]}
              />
            </Field>
            <Button onClick={campaignTable.reset}>{t('common.clear')}</Button>
          </div>

          <DataTable
            caption={t('marketing.tab.calendar')}
            columns={campaignColumns}
            rows={campaignsQuery.data?.items ?? []}
            rowKey={(row) => row.id}
            loading={campaignsQuery.isLoading}
            error={campaignsQuery.error}
            sort={campaignTable.sort}
            dir={campaignTable.dir}
            onSort={campaignTable.toggleSort}
          />

          {campaignsQuery.data ? (
            <Card title={t('marketing.col.installs')} className="" >
              <BarChart
                label={t('marketing.col.installs')}
                data={campaignsQuery.data.items.map((item) => ({ label: item.name, value: item.installs }))}
                color="var(--c-accent)"
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'queue' ? (
        <>
          <div className="toolbar">
            <Field label={t('common.search')} htmlFor="post-search" grow>
              <Input
                id="post-search"
                type="search"
                value={postTable.query}
                placeholder={t('common.searchPlaceholder')}
                onChange={(event) => postTable.setQuery(event.target.value)}
              />
            </Field>
            <Field label={t('common.channel')} htmlFor="post-channel">
              <Select
                id="post-channel"
                value={postTable.filters.channel}
                onChange={(event) => postTable.setFilter('channel', event.target.value)}
                options={[option('all', 'common.all'), ...CHANNELS.map((c) => option(c, `marketing.channel.${c}` as AdminTranslationKey))]}
              />
            </Field>
            <Field label={t('common.status')} htmlFor="post-status">
              <Select
                id="post-status"
                value={postTable.filters.status}
                onChange={(event) => postTable.setFilter('status', event.target.value)}
                options={[
                  option('all', 'common.all'),
                  ...POST_STATUSES.map((s) => option(s, `marketing.post.status.${s}` as AdminTranslationKey)),
                ]}
              />
            </Field>
            <Button onClick={postTable.reset}>{t('common.clear')}</Button>
          </div>

          <DataTable
            caption={t('marketing.tab.queue')}
            columns={postColumns}
            rows={postsQuery.data?.items ?? []}
            rowKey={(row) => row.id}
            loading={postsQuery.isLoading}
            error={postsQuery.error}
            sort={postTable.sort}
            dir={postTable.dir}
            onSort={postTable.toggleSort}
          />

          <Pagination
            page={postsQuery.data?.page ?? 1}
            pageSize={postsQuery.data?.pageSize ?? postTable.pageSize}
            total={postsQuery.data?.total ?? 0}
            onPage={postTable.setPage}
          />
        </>
      ) : null}

      {tab === 'referral' ? (
        referralQuery.isLoading ? (
          <Loading />
        ) : referralQuery.data ? (
          <div className="col" style={{ gap: 14 }}>
            <div className="grid grid-4">
              <Stat label={t('marketing.referral.invites')} value={formatNumber(referralQuery.data.invitesSent, localeTag)} />
              <Stat label={t('marketing.referral.accepted')} value={formatNumber(referralQuery.data.accepted, localeTag)} />
              <Stat label={t('marketing.referral.conversion')} value={formatPercent(referralQuery.data.conversionPct)} />
              <Stat label={t('marketing.referral.reward')} value={formatTry(referralQuery.data.rewardTry, localeTag)} />
            </div>
            <Card title={t('marketing.referral.series')}>
              <LineChart
                label={t('marketing.referral.series')}
                series={[{ name: t('marketing.referral.invites'), color: chartColors[0] as string, points: referralQuery.data.series }]}
              />
            </Card>
            <Card title={t('marketing.referral.top')}>
              <div className="table-wrap">
                <table className="table">
                  <caption className="visually-hidden">{t('marketing.referral.top')}</caption>
                  <thead>
                    <tr>
                      <th>{t('common.user')}</th>
                      <th style={{ textAlign: 'right' }}>{t('marketing.referral.invites')}</th>
                      <th style={{ textAlign: 'right' }}>{t('marketing.referral.accepted')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referralQuery.data.topInviters.map((item) => (
                      <tr key={item.userId}>
                        <td>{item.name}</td>
                        <td style={{ textAlign: 'right' }}>{item.invites}</td>
                        <td style={{ textAlign: 'right' }}>{item.joined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null
      ) : null}

      {tab === 'aso' ? (
        <DataTable
          caption={t('marketing.tab.aso')}
          columns={asoColumns}
          rows={asoQuery.data ?? []}
          rowKey={(row) => `${row.keyword}-${row.locale}`}
          loading={asoQuery.isLoading}
          error={asoQuery.error}
        />
      ) : null}
    </>
  );
}
