import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { useSession } from './auth/session';
import type { Permission } from './auth/roles';
import { Card } from './components/ui';
import { useT } from './i18n';
import { AppShell } from './layout/AppShell';
import { AgentsPage } from './pages/AgentsPage';
import { AiCtoPage } from './pages/AiCtoPage';
import { AuditPage } from './pages/AuditPage';
import { BookingsPage } from './pages/BookingsPage';
import { ContentPage } from './pages/ContentPage';
import { MarketingPage } from './pages/MarketingPage';
import { ModerationPage } from './pages/ModerationPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { SosPage } from './pages/SosPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { UsersPage } from './pages/UsersPage';
import { VerificationPage } from './pages/VerificationPage';
import { applyTheme, THEME_STORAGE_KEY, type AdminTheme } from './theme/tokens';

function readTheme(): AdminTheme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* depolama kapalı olabilir */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can, loading } = useSession();
  const t = useT();
  if (loading) return <Card>{t('app.loading')}</Card>;
  if (!can(permission)) {
    return (
      <Card title={t('app.noPermission')}>
        <p className="muted">{t('app.noPermissionAction')}</p>
      </Card>
    );
  }
  return <>{children}</>;
}

export function App() {
  const [theme, setTheme] = useState<AdminTheme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* yoksay */
    }
  }, [theme]);

  return (
    <Routes>
      <Route element={<AppShell theme={theme} onThemeChange={setTheme} />}>
        <Route
          index
          element={
            <RequirePermission permission="overview.view">
              <OverviewPage />
            </RequirePermission>
          }
        />
        <Route
          path="users"
          element={
            <RequirePermission permission="users.view">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="users/:id"
          element={
            <RequirePermission permission="users.view">
              <UserDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="moderation"
          element={
            <RequirePermission permission="moderation.view">
              <ModerationPage />
            </RequirePermission>
          }
        />
        <Route
          path="verification"
          element={
            <RequirePermission permission="verification.view">
              <VerificationPage />
            </RequirePermission>
          }
        />
        <Route
          path="bookings"
          element={
            <RequirePermission permission="bookings.view">
              <BookingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="sos"
          element={
            <RequirePermission permission="sos.view">
              <SosPage />
            </RequirePermission>
          }
        />
        <Route
          path="content"
          element={
            <RequirePermission permission="content.view">
              <ContentPage />
            </RequirePermission>
          }
        />
        <Route
          path="marketing"
          element={
            <RequirePermission permission="marketing.view">
              <MarketingPage />
            </RequirePermission>
          }
        />
        <Route
          path="ai-cto"
          element={
            <RequirePermission permission="cto.view">
              <AiCtoPage />
            </RequirePermission>
          }
        />
        <Route
          path="agents"
          element={
            <RequirePermission permission="agents.view">
              <AgentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="settings"
          element={
            <RequirePermission permission="settings.view">
              <SettingsPage />
            </RequirePermission>
          }
        />
        <Route
          path="audit"
          element={
            <RequirePermission permission="audit.view">
              <AuditPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
