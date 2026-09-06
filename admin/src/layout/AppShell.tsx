import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useSession } from '../auth/session';
import { Button, Select } from '../components/ui';
import { adminApi } from '../data';
import { useI18n } from '../i18n';
import type { AdminTranslationKey } from '../i18n';
import type { AdminTheme } from '../theme/tokens';
import { NAV_GROUPS, NAV_ITEMS } from './nav';

export function AppShell({ theme, onThemeChange }: { theme: AdminTheme; onThemeChange: (theme: AdminTheme) => void }) {
  const { t, locale, setLocale } = useI18n();
  const { account, accounts, switchAccount, can } = useSession();
  const location = useLocation();

  const settingsQuery = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi.settings.get() });
  const overviewQuery = useQuery({
    queryKey: ['admin', 'overview', '7d'],
    queryFn: () => adminApi.metrics.overview('7d'),
  });

  const badges = {
    moderation: overviewQuery.data?.moderationQueueCount ?? 0,
    verification: overviewQuery.data?.pendingVerificationCount ?? 0,
    sos: overviewQuery.data?.openSosCount ?? 0,
  };

  const visible = NAV_ITEMS.filter((item) => can(item.permission));
  const current = visible.find((item) =>
    item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
  );

  const announcement = settingsQuery.data?.announcement;
  const maintenance = settingsQuery.data?.maintenance;

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t('app.skipToContent')}
      </a>

      <nav className="sidebar" aria-label={t('app.title')}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            Z
          </span>
          <span>
            <span className="brand-name">{t('app.short')}</span>
            <br />
            <span className="brand-sub">{t('app.subtitle')}</span>
          </span>
        </div>

        {NAV_GROUPS.map((group) => {
          const items = visible.filter((item) => item.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <div className="nav-group-title">{t(group)}</div>
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {t(item.labelKey)}
                  {item.badge && badges[item.badge] > 0 ? (
                    <span className="nav-badge">{badges[item.badge]}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          );
        })}

        <div className="spacer" />
        <div className="small" style={{ padding: '12px 10px', color: 'var(--c-sidebar-muted)' }}>
          {adminApi.source === 'mock' ? t('app.source.mock') : t('app.source.rest')}
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div>
            <div className="topbar-title">{current ? t(current.labelKey) : t('app.title')}</div>
            <div className="topbar-sub">
              {t('app.signedInAs')}: {account?.name ?? '—'} ·{' '}
              {account ? t(`role.${account.role}` as AdminTranslationKey) : '—'}
            </div>
          </div>
          <div className="topbar-spacer" />

          <label className="visually-hidden" htmlFor="account-switch">
            {t('app.switchAccount')}
          </label>
          <Select
            id="account-switch"
            value={account?.id ?? ''}
            onChange={(event) => void switchAccount(event.target.value)}
            style={{ width: 210 }}
            options={accounts.map((item) => ({
              value: item.id,
              label: `${item.name} · ${t(`role.${item.role}` as AdminTranslationKey)}`,
            }))}
          />

          <label className="visually-hidden" htmlFor="lang-switch">
            {t('app.lang')}
          </label>
          <Select
            id="lang-switch"
            value={locale}
            onChange={(event) => setLocale(event.target.value === 'en' ? 'en' : 'tr')}
            style={{ width: 92 }}
            options={[
              { value: 'tr', label: 'Türkçe' },
              { value: 'en', label: 'English' },
            ]}
          />

          <Button
            onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? t('app.theme.dark') : t('app.theme.light')}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </Button>
        </header>

        {maintenance?.enabled ? (
          <div className="maintenance-banner" role="status">
            🛠 {t('settings.maintenance')}: {maintenance.message}
          </div>
        ) : null}
        {announcement?.enabled ? (
          <div className="maintenance-banner" role="status" style={{ background: 'var(--c-info-soft)', borderColor: 'var(--c-info)' }}>
            📣 {announcement.message}
          </div>
        ) : null}

        <main className="content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
