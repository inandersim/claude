import type {
  DeterrentEvent,
  Species,
  SpeciesIdentification,
  WildlifeAnswer,
  WildlifeQuestion,
} from '@/domain';

export const seedSpecies: Species[] = [];
export const seedIdentifications: SpeciesIdentification[] = [];
export const seedWildlifeQuestions: WildlifeQuestion[] = [];
export const seedWildlifeAnswers: WildlifeAnswer[] = [];
export const seedAnswerUpvotes: { userId: string; answerId: string }[] = [];
export const seedDeterrentEvents: DeterrentEvent[] = [];
