import type { AdminApi } from './adminApi';
import { mockAdminApi } from './mockAdminApi';
import { createRestAdminApi } from './restAdminApi';

const baseUrl = import.meta.env.VITE_ADMIN_API_URL as string | undefined;
const token = import.meta.env.VITE_ADMIN_API_TOKEN as string | undefined;

/**
 * Varsayılan kaynak mock'tur. `.env` içinde `VITE_ADMIN_API_URL` tanımlandığında
 * panel aynı arayüzü uygulayan gerçek sunucuya bağlanır — ekran kodu değişmez.
 */
export const adminApi: AdminApi =
  baseUrl && baseUrl.trim() ? createRestAdminApi({ baseUrl: baseUrl.trim(), token }) : mockAdminApi;

export * from './adminApi';
