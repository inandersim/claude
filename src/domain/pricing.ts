import type { Plan } from './enums';

export interface PlanSpec {
  id: Plan;
  monthlyTry: number;
  yearlyTry: number;
  /** Rezervasyon/satış komisyonu (0–1) */
  commissionRate: number;
  featureKeys: string[];
  /** Eğitmen/işletme özellikleri için */
  forProviders: boolean;
}

export const PLAN_SPECS: Record<Plan, PlanSpec> = {
  free: {
    id: 'free',
    monthlyTry: 0,
    yearlyTry: 0,
    commissionRate: 0.15,
    featureKeys: ['plans.f.basic', 'plans.f.match', 'plans.f.hazards'],
    forProviders: false,
  },
  pro: {
    id: 'pro',
    monthlyTry: 149,
    yearlyTry: 1190,
    commissionRate: 0.15,
    featureKeys: [
      'plans.f.offlineMaps',
      'plans.f.unlimitedShare',
      'plans.f.advancedAlerts',
      'plans.f.noAds',
      'plans.f.badge',
    ],
    forProviders: false,
  },
  pro_guide: {
    id: 'pro_guide',
    monthlyTry: 399,
    yearlyTry: 3190,
    commissionRate: 0.05,
    featureKeys: [
      'plans.f.paidBookings',
      'plans.f.lowCommission',
      'plans.f.featuredProfile',
      'plans.f.drone',
      'plans.f.analytics',
      'plans.f.allPro',
    ],
    forProviders: true,
  },
  business: {
    id: 'business',
    monthlyTry: 799,
    yearlyTry: 6390,
    commissionRate: 0.1,
    featureKeys: [
      'plans.f.stayBookings',
      'plans.f.featuredListing',
      'plans.f.multiStaff',
      'plans.f.analytics',
      'plans.f.allPro',
    ],
    forProviders: true,
  },
};

/** Hizmet sağlayıcının planına göre komisyon ve net kazanç. */
export function splitPayment(
  grossTry: number,
  providerPlan: Plan,
): { grossTry: number; commissionTry: number; netTry: number; rate: number } {
  const rate = PLAN_SPECS[providerPlan].commissionRate;
  const commissionTry = Math.round(grossTry * rate);
  return { grossTry, commissionTry, netTry: grossTry - commissionTry, rate };
}

/** Konaklama toplamı: gece × fiyat + platform ücreti (misafirden %5). */
export function stayTotal(
  nightlyTry: number,
  nights: number,
  guestFeeRate = 0.05,
): { subtotalTry: number; feeTry: number; totalTry: number } {
  const subtotalTry = nightlyTry * nights;
  const feeTry = Math.round(subtotalTry * guestFeeRate);
  return { subtotalTry, feeTry, totalTry: subtotalTry + feeTry };
}

export function nightsBetween(checkInIso: string, checkOutIso: string): number {
  const ms = new Date(checkOutIso).getTime() - new Date(checkInIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Yıllık planın aylığa göre kazandırdığı oran (ör. 0.33 → %33) */
export function yearlySavings(plan: Plan): number {
  const spec = PLAN_SPECS[plan];
  if (spec.monthlyTry === 0) return 0;
  return Math.round((1 - spec.yearlyTry / (spec.monthlyTry * 12)) * 100) / 100;
}

export function canUseDrone(plan: Plan): boolean {
  return plan === 'pro_guide' || plan === 'business';
}

export function canAcceptPaidBookings(plan: Plan): boolean {
  return plan === 'pro_guide' || plan === 'business';
}
