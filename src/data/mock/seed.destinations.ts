import type {
  AmsCheck,
  Destination,
  DestinationStage,
  EmergencyCenter,
  ReturnPlan,
} from '@/domain';

export const seedDestinations: Destination[] = [];
export const seedDestinationStages: DestinationStage[] = [];
export const seedSavedDestinations: { userId: string; destinationId: string }[] = [];
export const seedAmsChecks: AmsCheck[] = [];
export const seedReturnPlans: ReturnPlan[] = [];
/** Destinasyonlara ait ek acil merkezler (Nepal HRA klinikleri vb.); ana listeye eklenir. */
export const seedDestinationEmergencyCenters: EmergencyCenter[] = [];
