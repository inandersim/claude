import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../auth/session';
import { DataTable, type Column } from '../components/DataTable';
import { MapPlot, type MapMarker } from '../components/MapPlot';
import { ConfirmDialog, useConfirm } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, Field, Input, KeyValue, PageHeader, Pagination, Select, Tabs } from '../components/ui';
import { adminApi } from '../data';
import type { AdminHazardRow, SosIncident } from '../data/adminApi';
import { useTableQuery } from '../hooks/useTableQuery';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDateTime, formatRelative } from '../utils/format';

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const REVIEWS = ['pending', 'approved', 'rejected'] as const;

export function SosPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();

  const [tab, setTab] = useState<'incidents' | 'hazards'>('incidents');
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [centerId, setCenterId] = useState('');

  const hazardTable = useTableQuery({ prefix: 'hz', defaultSort: 'createdAt', filterKeys: ['severity', 'review'] });

  const incidentsQuery = useQuery({
    queryKey: ['admin', 'sos', statusFilter],
    queryFn: () => adminApi.sos.incidents({ page: 1, pageSize: 100, status: statusFilter }),
    enabled: tab === 'incidents',
    refetchInterval: 60_000,
  });

  const selected = incidentsQuery.data?.items.find((item) => item.id === selectedId) ?? null;

  const centersQuery = useQuery({
    queryKey: ['admin', 'sos', 'centers', selectedId],
    queryFn: () => adminApi.sos.centers(selectedId ?? ''),
    enabled: Boolean(selectedId),
  });

  const hazardsQuery = useQuery({
    queryKey: ['admin', 'hazards', hazardTable.page, hazardTable.query, hazardTable.sort, hazardTable.dir, hazardTable.filters],
    queryFn: () =>
      adminApi.sos.hazards({
        page: hazardTable.page,
        pageSize: hazardTable.pageSize,
        query: hazardTable.query,
        sort: hazardTable.sort,
        dir: hazardTable.dir,
        severity: hazardTable.filters.severity as never,
        review: hazardTable.filters.review as never,
      }),
    enabled: tab === 'hazards',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'sos'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'hazards'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
  };

  const assignMutation = useMutation({
    mutationFn: (input: { id: string; centerId: string; note: string }) =>
      adminApi.sos.assignCenter(input.id, input.centerId, input.note),
    onSuccess: () => {
      notify(t('sos.assigned'));
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const resolveMutation = useMutation({
    mutationFn: (input: { id: string; note: string }) => adminApi.sos.resolve(input.id, input.note),
    onSuccess: () => {
      notify(t('sos.resolved'));
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const hazardMutation = useMutation({
    mutationFn: (input: { id: string; review: 'approved' | 'rejected'; reason: string }) =>
      adminApi.sos.reviewHazard(input.id, input.review, input.reason),
    onSuccess: () => {
      notify(t('sos.hazard.done'));
      invalidate();
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  const stageTone = (stage: SosIncident['stage']) =>
    stage === 'resolved' ? 'success' : stage === 'acknowledged' ? 'info' : stage === 'sent' ? 'danger' : 'neutral';

  const markers: MapMarker[] = (incidentsQuery.data?.items ?? []).map((incident) => ({
    id: incident.id,
    coords: incident.coords,
    label: `${incident.userName} · ${t(`sos.stage.${incident.stage}` as AdminTranslationKey)} · ${incident.locationName}`,
    tone: incident.stage === 'resolved' ? 'success' : incident.stage === 'acknowledged' ? 'warning' : 'danger',
    selected: incident.id === selectedId,
  }));

  const incidentColumns: Column<SosIncident>[] = [
    {
      key: 'userName',
      header: t('sos.col.user'),
      sortable: true,
      render: (row) => (
        <div className="stack-sm">
          <strong className="small">{row.userName}</strong>
          <span className="small subtle mono">{row.userPhone}</span>
        </div>
      ),
    },
    {
      key: 'stage',
      header: t('sos.col.stage'),
      sortable: true,
      render: (row) => <Badge tone={stageTone(row.stage)}>{t(`sos.stage.${row.stage}` as AdminTranslationKey)}</Badge>,
    },
    { key: 'source', header: t('sos.col.source'), render: (row) => t(`sos.source.${row.source}` as AdminTranslationKey) },
    {
      key: 'location',
      header: t('common.location'),
      render: (row) => (
        <div className="stack-sm">
          <span className="small">{row.locationName}</span>
          <span className="small subtle mono">
            {row.coords.latitude.toFixed(3)}, {row.coords.longitude.toFixed(3)}
          </span>
        </div>
      ),
    },
    { key: 'battery', header: t('sos.col.battery'), align: 'right', render: (row) => `%${row.batteryPct}` },
    {
      key: 'center',
      header: t('sos.col.center'),
      render: (row) => row.assignedCenterName ?? <span className="subtle">—</span>,
    },
    {
      key: 'startedAt',
      header: t('sos.col.started'),
      sortable: true,
      render: (row) => <span className="small muted">{formatRelative(row.startedAt, localeTag)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <Button size="sm" onClick={() => setSelectedId(row.id)}>
          {t('common.details')}
        </Button>
      ),
    },
  ];

  const hazardColumns: Column<AdminHazardRow>[] = [
    {
      key: 'title',
      header: t('sos.hazard.col.title'),
      render: (row) => (
        <div className="stack-sm" style={{ maxWidth: 380 }}>
          <strong className="small">{row.title}</strong>
          <span className="small muted">{row.description}</span>
          <span className="small subtle">
            {row.locationName} · {row.radiusM} m
          </span>
        </div>
      ),
    },
    {
      key: 'severity',
      header: t('sos.hazard.col.severity'),
      sortable: true,
      render: (row) => (
        <Badge tone={row.severity === 'critical' || row.severity === 'high' ? 'danger' : row.severity === 'medium' ? 'warning' : 'neutral'}>
          {t(`sos.severity.${row.severity}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'reporter',
      header: t('sos.hazard.col.reporter'),
      render: (row) => (
        <div className="stack-sm">
          <span className="small">{row.reporterName}</span>
          <span className="small subtle">{t('users.detail.trust')}: {row.reporterTrustScore}</span>
        </div>
      ),
    },
    {
      key: 'confirmations',
      header: t('sos.hazard.col.confirmations'),
      sortable: true,
      align: 'right',
      render: (row) => row.confirmations,
    },
    {
      key: 'review',
      header: t('sos.hazard.col.review'),
      render: (row) => (
        <Badge tone={row.review === 'approved' ? 'success' : row.review === 'rejected' ? 'danger' : 'warning'}>
          {t(`sos.hazard.review.${row.review}` as AdminTranslationKey)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) =>
        can('hazard.review') ? (
          <div className="row-tight">
            <Button
              size="sm"
              variant="primary"
              disabled={row.review === 'approved'}
              onClick={() =>
                confirm({
                  title: t('sos.hazard.approve'),
                  description: row.title,
                  onConfirm: (reason) => hazardMutation.mutateAsync({ id: row.id, review: 'approved', reason }),
                })
              }
            >
              {t('sos.hazard.approve')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={row.review === 'rejected'}
              onClick={() =>
                confirm({
                  title: t('sos.hazard.reject'),
                  description: row.title,
                  reasonRequired: true,
                  danger: true,
                  onConfirm: (reason) => hazardMutation.mutateAsync({ id: row.id, review: 'rejected', reason }),
                })
              }
            >
              {t('sos.hazard.reject')}
            </Button>
          </div>
        ) : (
          <span className="subtle small">—</span>
        ),
    },
  ];

  const option = (value: string, key: AdminTranslationKey) => ({ value, label: t(key) });

  return (
    <>
      <PageHeader title={t('sos.title')} subtitle={t('sos.subtitle')} />

      <Tabs
        ariaLabel={t('sos.title')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'incidents', label: t('sos.tab.incidents'), badge: incidentsQuery.data?.total ?? 0 },
          { value: 'hazards', label: t('sos.tab.hazards') },
        ]}
      />

      {tab === 'incidents' ? (
        <div className="col" style={{ gap: 14 }}>
          <div className="row">
            <button
              type="button"
              className="chip-toggle"
              aria-pressed={statusFilter === 'open'}
              onClick={() => setStatusFilter('open')}
            >
              {t('sos.filter.open')}
            </button>
            <button
              type="button"
              className="chip-toggle"
              aria-pressed={statusFilter === 'resolved'}
              onClick={() => setStatusFilter('resolved')}
            >
              {t('sos.filter.resolved')}
            </button>
            <button
              type="button"
              className="chip-toggle"
              aria-pressed={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            >
              {t('common.all')}
            </button>
          </div>

          <Card title={t('sos.map')}>
            <MapPlot label={t('sos.map')} markers={markers} onSelect={setSelectedId} />
          </Card>

          <div className="grid" style={{ gridTemplateColumns: selected ? '1.6fr 1fr' : '1fr', alignItems: 'start' }}>
            <DataTable
              caption={t('sos.tab.incidents')}
              columns={incidentColumns}
              rows={incidentsQuery.data?.items ?? []}
              rowKey={(row) => row.id}
              loading={incidentsQuery.isLoading}
              error={incidentsQuery.error}
              onRowClick={(row) => setSelectedId(row.id)}
            />

            {selected ? (
              <Card
                title={selected.userName}
                subtitle={`${t(`sos.stage.${selected.stage}` as AdminTranslationKey)} · ${formatDateTime(selected.startedAt, localeTag)}`}
                actions={
                  <Button size="sm" onClick={() => setSelectedId(null)} aria-label={t('common.close')}>
                    ✕
                  </Button>
                }
              >
                <div className="col">
                  <KeyValue
                    items={[
                      { label: t('common.location'), value: selected.locationName },
                      {
                        label: t('sos.coords'),
                        value: (
                          <span className="mono">
                            {selected.coords.latitude.toFixed(4)}, {selected.coords.longitude.toFixed(4)}
                          </span>
                        ),
                      },
                      { label: t('sos.altitude'), value: `${selected.altitudeM} m` },
                      { label: t('sos.col.battery'), value: `%${selected.batteryPct}` },
                      { label: t('sos.contacts'), value: String(selected.notifiedContacts) },
                      { label: t('sos.col.center'), value: selected.assignedCenterName ?? '—' },
                    ]}
                  />

                  {can('sos.act') && selected.stage !== 'resolved' ? (
                    <>
                      <Field label={t('sos.assign')} htmlFor="sos-center">
                        <Select
                          id="sos-center"
                          value={centerId}
                          onChange={(event) => setCenterId(event.target.value)}
                          options={[
                            { value: '', label: t('sos.selectCenter') },
                            ...(centersQuery.data ?? []).map((center) => ({
                              value: center.id,
                              label: `${center.name} · ${center.distanceKm} km`,
                            })),
                          ]}
                        />
                      </Field>
                      <div className="row">
                        <Button
                          variant="primary"
                          disabled={!centerId}
                          onClick={() =>
                            confirm({
                              title: t('sos.assign'),
                              description: selected.userName,
                              onConfirm: (note) => assignMutation.mutateAsync({ id: selected.id, centerId, note }),
                            })
                          }
                        >
                          {t('sos.assign')}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            confirm({
                              title: t('sos.confirmResolve'),
                              description: selected.userName,
                              reasonRequired: true,
                              onConfirm: (note) => resolveMutation.mutateAsync({ id: selected.id, note }),
                            })
                          }
                        >
                          {t('sos.resolve')}
                        </Button>
                      </div>
                    </>
                  ) : null}

                  <h3 style={{ fontSize: 14, marginTop: 8 }}>{t('sos.timeline')}</h3>
                  <div className="timeline">
                    {selected.timeline.map((step, index) => (
                      <div className="timeline-item" key={`${step.at}-${index}`}>
                        <div className="timeline-dot" />
                        <div>
                          <div className="small">{step.label}</div>
                          <div className="small muted">
                            {step.actor} · {formatDateTime(step.at, localeTag)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <Field label={t('common.search')} htmlFor="hz-search" grow>
              <Input
                id="hz-search"
                type="search"
                value={hazardTable.query}
                placeholder={t('common.searchPlaceholder')}
                onChange={(event) => hazardTable.setQuery(event.target.value)}
              />
            </Field>
            <Field label={t('sos.hazard.col.severity')} htmlFor="hz-severity">
              <Select
                id="hz-severity"
                value={hazardTable.filters.severity}
                onChange={(event) => hazardTable.setFilter('severity', event.target.value)}
                options={[option('all', 'common.all'), ...SEVERITIES.map((s) => option(s, `sos.severity.${s}` as AdminTranslationKey))]}
              />
            </Field>
            <Field label={t('sos.hazard.col.review')} htmlFor="hz-review">
              <Select
                id="hz-review"
                value={hazardTable.filters.review}
                onChange={(event) => hazardTable.setFilter('review', event.target.value)}
                options={[option('all', 'common.all'), ...REVIEWS.map((r) => option(r, `sos.hazard.review.${r}` as AdminTranslationKey))]}
              />
            </Field>
            <Button onClick={hazardTable.reset}>{t('common.clear')}</Button>
          </div>

          <DataTable
            caption={t('sos.tab.hazards')}
            columns={hazardColumns}
            rows={hazardsQuery.data?.items ?? []}
            rowKey={(row) => row.id}
            loading={hazardsQuery.isLoading}
            error={hazardsQuery.error}
            sort={hazardTable.sort}
            dir={hazardTable.dir}
            onSort={hazardTable.toggleSort}
          />

          <Pagination
            page={hazardsQuery.data?.page ?? 1}
            pageSize={hazardsQuery.data?.pageSize ?? hazardTable.pageSize}
            total={hazardsQuery.data?.total ?? 0}
            onPage={hazardTable.setPage}
          />
        </>
      )}

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}
