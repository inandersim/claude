import type {
  Badge,
  Challenge,
  ChallengeProgress,
  EarnedBadge,
  PassportStamp,
  QuizQuestion,
  XpEvent,
} from '@/domain';

export const seedBadges: Badge[] = [];
export const seedEarnedBadges: EarnedBadge[] = [];
export const seedChallenges: Challenge[] = [];
export const seedChallengeProgress: ChallengeProgress[] = [];
export const seedXpEvents: XpEvent[] = [];
export const seedQuizQuestions: QuizQuestion[] = [];
export const seedPassportStamps: PassportStamp[] = [];
export const seedQuizAttempts: { userId: string; date: string; correct: number }[] = [];
