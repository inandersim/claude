import type { AdminRole } from '../data/adminApi';

/**
 * Rol tabanlı erişim.
 *
 * Her ekran ve her tehlikeli işlem bir izinle korunur; kontrol tek bir
 * `can()` yardımcısıyla yapılır (bkz. `useCan`).
 */
export type Permission =
  | 'overview.view'
  | 'users.view'
  | 'users.moderate'
  | 'users.role'
  | 'users.plan'
  | 'users.sessions'
  | 'users.note'
  | 'moderation.view'
  | 'moderation.act'
  | 'verification.view'
  | 'verification.decide'
  | 'bookings.view'
  | 'bookings.refund'
  | 'bookings.release'
  | 'bookings.dispute'
  | 'sos.view'
  | 'sos.act'
  | 'hazard.review'
  | 'content.view'
  | 'content.edit'
  | 'content.publish'
  | 'marketing.view'
  | 'marketing.act'
  | 'agents.view'
  | 'agents.rollback'
  | 'cto.view'
  | 'cto.submit'
  | 'cto.approve'
  | 'settings.view'
  | 'settings.edit'
  | 'audit.view';

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  admin: [
    'overview.view',
    'users.view',
    'users.moderate',
    'users.role',
    'users.plan',
    'users.sessions',
    'users.note',
    'moderation.view',
    'moderation.act',
    'verification.view',
    'verification.decide',
    'bookings.view',
    'bookings.refund',
    'bookings.release',
    'bookings.dispute',
    'sos.view',
    'sos.act',
    'hazard.review',
    'content.view',
    'content.edit',
    'content.publish',
    'marketing.view',
    'marketing.act',
    'agents.view',
    'agents.rollback',
    'cto.view',
    'cto.submit',
    'cto.approve',
    'settings.view',
    'settings.edit',
    'audit.view',
  ],
  moderator: [
    'overview.view',
    'users.view',
    'users.moderate',
    'users.note',
    'moderation.view',
    'moderation.act',
    'verification.view',
    'verification.decide',
    'sos.view',
    'hazard.review',
    'audit.view',
  ],
  editor: ['overview.view', 'content.view', 'content.edit', 'content.publish', 'marketing.view', 'marketing.act'],
  support: [
    'overview.view',
    'users.view',
    'users.plan',
    'users.sessions',
    'users.note',
    'verification.view',
    'bookings.view',
    'bookings.refund',
    'bookings.dispute',
    'sos.view',
    'sos.act',
    'audit.view',
  ],
};

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsOf(role: AdminRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export const ADMIN_ROLES: AdminRole[] = ['admin', 'moderator', 'editor', 'support'];
