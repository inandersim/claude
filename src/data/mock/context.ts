import type { ID, NotificationWithSender, User } from '@/domain';

import type { MockDatabase } from './database';

/**
 * Modül repository'lerinin (src/data/mock/repos/*) ortak bağımlılıkları.
 * provider.ts bu nesneyi oluşturur ve her modül fabrikasına verir.
 */
export interface MockContext {
  db: MockDatabase;
  /** Yapılandırılmış ağ gecikmesi */
  wait: () => Promise<void>;
  latencyMs: number;
  requireUser: (users: User[], id: ID) => User;
  pushNotification: (
    input: Omit<NotificationWithSender, 'id' | 'createdAt' | 'isRead' | 'sender' | 'targetId'> & {
      targetId?: ID | null;
    },
  ) => Promise<void>;
}
