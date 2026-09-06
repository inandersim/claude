import type { Permission } from '../auth/roles';
import type { AdminTranslationKey } from '../i18n';

export interface NavItem {
  path: string;
  labelKey: AdminTranslationKey;
  icon: string;
  permission: Permission;
  group: AdminTranslationKey;
  /** Panorama'daki sayaçlardan hangisi rozet olarak gösterilsin */
  badge?: 'moderation' | 'verification' | 'sos';
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', labelKey: 'nav.overview', icon: '◎', permission: 'overview.view', group: 'nav.group.operation' },
  { path: '/users', labelKey: 'nav.users', icon: '☺', permission: 'users.view', group: 'nav.group.operation' },
  {
    path: '/bookings',
    labelKey: 'nav.bookings',
    icon: '₺',
    permission: 'bookings.view',
    group: 'nav.group.operation',
  },
  {
    path: '/moderation',
    labelKey: 'nav.moderation',
    icon: '⚑',
    permission: 'moderation.view',
    group: 'nav.group.trust',
    badge: 'moderation',
  },
  {
    path: '/verification',
    labelKey: 'nav.verification',
    icon: '✓',
    permission: 'verification.view',
    group: 'nav.group.trust',
    badge: 'verification',
  },
  { path: '/sos', labelKey: 'nav.sos', icon: '⛑', permission: 'sos.view', group: 'nav.group.trust', badge: 'sos' },
  { path: '/content', labelKey: 'nav.content', icon: '✎', permission: 'content.view', group: 'nav.group.growth' },
  { path: '/marketing', labelKey: 'nav.marketing', icon: '📣', permission: 'marketing.view', group: 'nav.group.growth' },
  { path: '/agents', labelKey: 'nav.agents', icon: '⚙', permission: 'agents.view', group: 'nav.group.system' },
  { path: '/settings', labelKey: 'nav.settings', icon: '⚑', permission: 'settings.view', group: 'nav.group.system' },
  { path: '/audit', labelKey: 'nav.audit', icon: '≡', permission: 'audit.view', group: 'nav.group.system' },
];

export const NAV_GROUPS: AdminTranslationKey[] = [
  'nav.group.operation',
  'nav.group.trust',
  'nav.group.growth',
  'nav.group.system',
];
