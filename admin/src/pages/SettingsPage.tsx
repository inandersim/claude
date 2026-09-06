import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useSession } from '../auth/session';
import { ConfirmDialog, useConfirm } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, ErrorNote, Field, Input, Loading, PageHeader, Select, Tabs, Textarea } from '../components/ui';
import { adminApi } from '../data';
import type { FeatureFlag } from '../data/adminApi';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import { formatDate } from '../utils/format';

export function SettingsPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const { can } = useSession();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { confirmState, confirm, closeConfirm } = useConfirm();
  const [tab, setTab] = useState<'flags' | 'ops' | 'limits'>('flags');

  const query = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi.settings.get() });

  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementLevel, setAnnouncementLevel] = useState<'info' | 'warning' | 'critical'>('info');
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [commissions, setCommissions] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!query.data) return;
    setMaintenanceMessage(query.data.maintenance.message);
    setAnnouncementMessage(query.data.announcement.message);
    setAnnouncementLevel(query.data.announcement.level);
    setLimits(Object.fromEntries(query.data.rateLimits.map((rule) => [rule.key, rule.perMinute])));
    setCommissions(Object.fromEntries(query.data.commissions.map((rule) => [rule.key, rule.pct])));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (input: { patch: Parameters<typeof adminApi.settings.update>[0]; reason: string }) =>
      adminApi.settings.update(input.patch, input.reason),
    onSuccess: () => {
      notify(t('settings.saved'));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
    onError: (error: Error) => notify(error.message, 'error'),
  });

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} />;
  const settings = query.data;
  if (!settings) return null;

  const editable = can('settings.edit');

  const toggleFlag = (flag: FeatureFlag) => {
    confirm({
      title: `${flag.label} — ${flag.enabled ? t('settings.flag.off') : t('settings.flag.on')}`,
      description: flag.description,
      onConfirm: (reason) =>
        mutation.mutateAsync({ patch: { flags: [{ key: flag.key, enabled: !flag.enabled }] }, reason }),
    });
  };

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Tabs
        ariaLabel={t('settings.title')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'flags', label: t('settings.tab.flags') },
          { value: 'ops', label: t('settings.tab.ops') },
          { value: 'limits', label: t('settings.tab.limits') },
        ]}
      />

      {tab === 'flags' ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">{t('settings.tab.flags')}</caption>
            <thead>
              <tr>
                <th>{t('settings.flag.key')}</th>
                <th>{t('settings.flag.state')}</th>
                <th>{t('settings.flag.rollout')}</th>
                <th>{t('settings.flag.audience')}</th>
                <th>{t('common.updated')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {settings.flags.map((flag) => (
                <tr key={flag.key}>
                  <td>
                    <div className="stack-sm">
                      <strong className="small">{flag.label}</strong>
                      <span className="small muted">{flag.description}</span>
                      <span className="small subtle mono">{flag.key}</span>
                    </div>
                  </td>
                  <td>
                    <Badge tone={flag.enabled ? 'success' : 'neutral'}>
                      {flag.enabled ? t('settings.flag.on') : t('settings.flag.off')}
                    </Badge>
                  </td>
                  <td style={{ minWidth: 160 }}>
                    <div className="row-tight">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={flag.rolloutPct}
                        disabled={!editable}
                        aria-label={`${flag.label} ${t('settings.flag.rollout')}`}
                        onChange={(event) =>
                          mutation.mutate({
                            patch: { flags: [{ key: flag.key, rolloutPct: Number(event.target.value) }] },
                            reason: 'Yayılım oranı güncellendi',
                          })
                        }
                      />
                      <span className="small mono">%{flag.rolloutPct}</span>
                    </div>
                  </td>
                  <td>
                    <Select
                      value={flag.audience}
                      disabled={!editable}
                      aria-label={`${flag.label} ${t('settings.flag.audience')}`}
                      onChange={(event) =>
                        mutation.mutate({
                          patch: { flags: [{ key: flag.key, audience: event.target.value as FeatureFlag['audience'] }] },
                          reason: 'Hedef kitle güncellendi',
                        })
                      }
                      options={(['all', 'pro', 'internal'] as const).map((value) => ({
                        value,
                        label: t(`settings.flag.audience.${value}` as AdminTranslationKey),
                      }))}
                    />
                  </td>
                  <td className="small muted">{formatDate(flag.updatedAt, localeTag)}</td>
                  <td>
                    <Button size="sm" disabled={!editable} onClick={() => toggleFlag(flag)}>
                      {t('settings.flag.toggle')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === 'ops' ? (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Card title={t('settings.maintenance')}>
            <div className="col">
              <div className="row">
                <Badge tone={settings.maintenance.enabled ? 'danger' : 'neutral'}>
                  {settings.maintenance.enabled ? t('settings.flag.on') : t('settings.flag.off')}
                </Badge>
              </div>
              <Field label={t('settings.maintenance.message')} htmlFor="mt-message">
                <Textarea
                  id="mt-message"
                  value={maintenanceMessage}
                  disabled={!editable}
                  onChange={(event) => setMaintenanceMessage(event.target.value)}
                />
              </Field>
              <div className="row">
                <Button
                  variant={settings.maintenance.enabled ? 'secondary' : 'danger'}
                  disabled={!editable}
                  onClick={() =>
                    confirm({
                      title: settings.maintenance.enabled ? t('settings.maintenance') : t('settings.confirmMaintenance'),
                      reasonRequired: !settings.maintenance.enabled,
                      danger: !settings.maintenance.enabled,
                      onConfirm: (reason) =>
                        mutation.mutateAsync({
                          patch: {
                            maintenance: { enabled: !settings.maintenance.enabled, message: maintenanceMessage },
                          },
                          reason,
                        }),
                    })
                  }
                >
                  {settings.maintenance.enabled ? t('settings.flag.off') : t('settings.flag.on')}
                </Button>
                <Button
                  disabled={!editable}
                  onClick={() =>
                    mutation.mutate({ patch: { maintenance: { message: maintenanceMessage } }, reason: 'Bakım mesajı güncellendi' })
                  }
                >
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </Card>

          <Card title={t('settings.announcement')}>
            <div className="col">
              <div className="row">
                <Badge tone={settings.announcement.enabled ? 'info' : 'neutral'}>
                  {settings.announcement.enabled ? t('settings.flag.on') : t('settings.flag.off')}
                </Badge>
              </div>
              <Field label={t('settings.announcement.message')} htmlFor="an-message">
                <Textarea
                  id="an-message"
                  value={announcementMessage}
                  disabled={!editable}
                  onChange={(event) => setAnnouncementMessage(event.target.value)}
                />
              </Field>
              <Field label={t('settings.announcement.level')} htmlFor="an-level">
                <Select
                  id="an-level"
                  value={announcementLevel}
                  disabled={!editable}
                  onChange={(event) => setAnnouncementLevel(event.target.value as 'info' | 'warning' | 'critical')}
                  options={(['info', 'warning', 'critical'] as const).map((value) => ({
                    value,
                    label: t(`settings.announcement.level.${value}` as AdminTranslationKey),
                  }))}
                />
              </Field>
              <div className="row">
                <Button
                  disabled={!editable}
                  onClick={() =>
                    mutation.mutate({
                      patch: { announcement: { enabled: !settings.announcement.enabled } },
                      reason: 'Duyuru bandı değiştirildi',
                    })
                  }
                >
                  {settings.announcement.enabled ? t('settings.flag.off') : t('settings.flag.on')}
                </Button>
                <Button
                  variant="primary"
                  disabled={!editable}
                  onClick={() =>
                    mutation.mutate({
                      patch: { announcement: { message: announcementMessage, level: announcementLevel } },
                      reason: 'Duyuru metni güncellendi',
                    })
                  }
                >
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'limits' ? (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Card title={t('settings.rateLimits')}>
            <div className="col">
              {settings.rateLimits.map((rule) => (
                <Field key={rule.key} label={rule.label} htmlFor={`rl-${rule.key}`}>
                  <Input
                    id={`rl-${rule.key}`}
                    type="number"
                    min={1}
                    max={10_000}
                    disabled={!editable}
                    value={limits[rule.key] ?? rule.perMinute}
                    onChange={(event) => setLimits({ ...limits, [rule.key]: Number(event.target.value) })}
                  />
                </Field>
              ))}
              <Button
                variant="primary"
                disabled={!editable}
                onClick={() =>
                  mutation.mutate({
                    patch: {
                      rateLimits: Object.entries(limits).map(([key, perMinute]) => ({ key, perMinute })),
                    },
                    reason: 'Oran sınırları güncellendi',
                  })
                }
              >
                {t('common.save')}
              </Button>
            </div>
          </Card>

          <Card title={t('settings.commissions')}>
            <div className="col">
              {settings.commissions.map((rule) => (
                <Field key={rule.key} label={rule.label} htmlFor={`cm-${rule.key}`}>
                  <Input
                    id={`cm-${rule.key}`}
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    disabled={!editable}
                    value={commissions[rule.key] ?? rule.pct}
                    onChange={(event) => setCommissions({ ...commissions, [rule.key]: Number(event.target.value) })}
                  />
                </Field>
              ))}
              <Button
                variant="primary"
                disabled={!editable}
                onClick={() =>
                  confirm({
                    title: t('settings.commissions'),
                    reasonRequired: true,
                    onConfirm: (reason) =>
                      mutation.mutateAsync({
                        patch: { commissions: Object.entries(commissions).map(([key, pct]) => ({ key, pct })) },
                        reason,
                      }),
                  })
                }
              >
                {t('common.save')}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
    </>
  );
}
