import type { SatDevice, SatMessage, SosSession } from '@/domain';

import { CURRENT_USER_ID } from './seed';

const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);

/** Kaçkar / Ayder çevresi — geçmiş mesajların konumu */
const KACKAR = { latitude: 40.8321, longitude: 41.1594 };
const AYDER = { latitude: 40.9506, longitude: 41.1024 };
const ISTANBUL = { latitude: 40.9903, longitude: 29.0293 };

export const seedSatDevices: SatDevice[] = [
  {
    id: 'sd_inreach',
    userId: CURRENT_USER_ID,
    type: 'inreach',
    name: 'inReach Mini 2',
    imei: '300434063912345',
    batteryPct: 78,
    pairedAt: daysAgo(120),
    lastSeenAt: hoursAgo(3),
    monthlyQuota: 40,
    usedThisMonth: 12,
  },
  {
    id: 'sd_iphone',
    userId: CURRENT_USER_ID,
    type: 'phone_satellite',
    name: 'iPhone 15 Pro',
    imei: null,
    batteryPct: 61,
    pairedAt: daysAgo(30),
    lastSeenAt: minutesAgo(4),
    monthlyQuota: 0,
    usedThisMonth: 3,
  },
];

export const seedSatMessages: SatMessage[] = [
  {
    id: 'sm_1',
    userId: CURRENT_USER_ID,
    deviceId: 'sd_inreach',
    kind: 'checkin',
    body: 'k:C;t:0715;g:40.95060,41.10240;m:OK gv pl dv',
    coords: AYDER,
    toContacts: ['+90 532 000 00 01', '+90 532 000 00 02'],
    status: 'delivered',
    link: 'satellite',
    createdAt: daysAgo(2),
    deliveredAt: new Date(now - 2 * 86_400_000 + 95_000).toISOString(),
    attempts: 1,
  },
  {
    id: 'sm_2',
    userId: CURRENT_USER_ID,
    deviceId: 'sd_inreach',
    kind: 'location',
    body: 'k:L;t:1240;g:40.83210,41.15940',
    coords: KACKAR,
    toContacts: ['+90 532 000 00 02'],
    status: 'delivered',
    link: 'satellite',
    createdAt: hoursAgo(30),
    deliveredAt: new Date(now - 30 * 3_600_000 + 140_000).toISOString(),
    attempts: 2,
  },
  {
    id: 'sm_3',
    userId: CURRENT_USER_ID,
    deviceId: 'sd_inreach',
    kind: 'text',
    body: 'k:T;t:1805;g:40.83210,41.15940;m:hv bozuldu, kp 3200m de. yr sbh dn',
    coords: KACKAR,
    toContacts: ['+90 532 000 00 02'],
    status: 'delivered',
    link: 'satellite',
    createdAt: hoursAgo(26),
    deliveredAt: new Date(now - 26 * 3_600_000 + 210_000).toISOString(),
    attempts: 1,
  },
  {
    id: 'sm_4',
    userId: CURRENT_USER_ID,
    deviceId: 'sd_inreach',
    kind: 'checkin',
    body: 'k:C;t:0930;g:40.83210,41.15940;m:DLY gc iy',
    coords: KACKAR,
    toContacts: ['+90 532 000 00 01', '+90 532 000 00 02'],
    status: 'failed',
    link: 'satellite',
    createdAt: hoursAgo(20),
    deliveredAt: null,
    attempts: 5,
  },
  {
    id: 'sm_5',
    userId: CURRENT_USER_ID,
    deviceId: 'sd_iphone',
    kind: 'text',
    body: 'k:T;t:1120;g:40.83210,41.15940;m:tlf pl2 dsk, aks kpt',
    coords: KACKAR,
    toContacts: ['+90 532 000 00 02'],
    status: 'queued',
    link: 'satellite',
    createdAt: hoursAgo(5),
    deliveredAt: null,
    attempts: 1,
  },
  {
    id: 'sm_6',
    userId: CURRENT_USER_ID,
    deviceId: null,
    kind: 'text',
    body: 'k:T;t:1655;g:40.99030,29.02930;m:eve vardim, yr rt paylasirim',
    coords: ISTANBUL,
    toContacts: ['+90 532 000 00 01'],
    status: 'sent',
    link: 'cellular',
    createdAt: minutesAgo(40),
    deliveredAt: null,
    attempts: 1,
  },
];

export const seedSosSessions: SosSession[] = [
  {
    id: 'sos_past_1',
    userId: CURRENT_USER_ID,
    stage: 'resolved',
    coords: { latitude: 40.8455, longitude: 41.1712 },
    startedAt: daysAgo(40),
    updatedAt: new Date(now - 40 * 86_400_000 + 3 * 3_600_000).toISOString(),
    timeline: [
      { stage: 'armed', at: daysAgo(40), note: 'SOS kuruldu, konum alındı' },
      {
        stage: 'sent',
        at: new Date(now - 40 * 86_400_000 + 20_000).toISOString(),
        note: 'Sinyal uydu üzerinden gönderildi',
      },
      {
        stage: 'acknowledged',
        at: new Date(now - 40 * 86_400_000 + 6 * 60_000).toISOString(),
        note: 'Kurtarma koordinasyon merkezi sinyali aldı',
      },
      {
        stage: 'dispatched',
        at: new Date(now - 40 * 86_400_000 + 25 * 60_000).toISOString(),
        note: 'Kurtarma ekibi yola çıktı',
      },
      {
        stage: 'resolved',
        at: new Date(now - 40 * 86_400_000 + 3 * 3_600_000).toISOString(),
        note: 'Olay kapatıldı — bilek burkulması, ekip eşlik etti',
      },
    ],
    rescueCenterId: null,
    link: 'satellite',
  },
];
