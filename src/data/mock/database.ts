import AsyncStorage from '@react-native-async-storage/async-storage';

import { deepClone } from '@/core/utils/clone';
import type {
  AmsCheck,
  Certificate,
  Collection,
  Course,
  CourseReview,
  CourseSession,
  Destination,
  DestinationStage,
  Enrollment,
  Group,
  GroupMember,
  GroupMessage,
  Lesson,
  Reaction,
  ReturnPlan,
  SavedPost,
  VisionHistoryItem,
  AiMessage,
  AiThread,
  Ascent,
  Badge,
  Challenge,
  ChallengeProgress,
  Club,
  ClubEvent,
  ClubMember,
  ClimbingRoute,
  Crag,
  CragSector,
  EarnedBadge,
  GeoPoint,
  HostProfile,
  ID,
  MapPack,
  PassportStamp,
  Payment,
  QuizQuestion,
  SatDevice,
  SatMessage,
  SavedRoute,
  SosSession,
  StayReview,
  StayUnit,
  StudentVerification,
  TrailGraph,
  UnitBlock,
  XpEvent,
  Booking,
  Business,
  Comment,
  EmergencyCenter,
  LibraryPlace,
  LocationShare,
  SosEvent,
  StayBooking,
  Story,
  Follow,
  HazardZone,
  Instructor,
  InstructorReview,
  Listing,
  LiveStream,
  Message,
  Notification,
  Post,
  Route,
  StreamMessage,
  TrendingLocation,
  User,
  ZMatch,
} from '@/domain';

import {
  CURRENT_USER_ID,
  seedBookings,
  seedComments,
  seedFavorites,
  seedFollows,
  seedHazardConfirmations,
  seedHazards,
  seedInstructorReviews,
  seedInstructors,
  seedLikes,
  seedListings,
  seedLocations,
  seedMatches,
  seedMessages,
  seedNotifications,
  seedPosts,
  seedRoutes,
  seedStreamMessages,
  seedStreams,
  seedUsers,
} from './seed';
import {
  seedBusinesses,
  seedDroneStream,
  seedEmergencyCenters,
  seedLibrary,
  seedShares,
  seedStayBookings,
  seedStories,
  seedStoryViews,
} from './seed.extra';
import { seedAiMessages, seedAiThreads } from './seed.ai';
import {
  seedAscents,
  seedClimbingRoutes,
  seedCrags,
  seedRouteConfirmations,
  seedSectors,
} from './seed.climbing';
import {
  seedClubEvents,
  seedClubMembers,
  seedClubs,
  seedEventRsvps,
  seedStudentVerifications,
} from './seed.clubs';
import {
  seedBadges,
  seedChallengeProgress,
  seedChallenges,
  seedEarnedBadges,
  seedPassportStamps,
  seedQuizAttempts,
  seedQuizQuestions,
  seedXpEvents,
} from './seed.fun';
import {
  seedHostProfiles,
  seedPayments,
  seedStayReviews,
  seedStayUnits,
  seedUnitBlocks,
} from './seed.inventory';
import { seedMapPacks, seedMapRegions, seedSavedRoutes, seedTrailGraphs } from './seed.maps';
import { seedSatDevices, seedSatMessages, seedSosSessions } from './seed.satellite';
import {
  seedCertificates,
  seedCourseReviews,
  seedCourseSessions,
  seedCourses,
  seedEnrollments,
  seedLessons,
} from './seed.courses';
import {
  seedAmsChecks,
  seedDestinationEmergencyCenters,
  seedDestinationStages,
  seedDestinations,
  seedReturnPlans,
  seedSavedDestinations,
} from './seed.destinations';
import { seedGroupMembers, seedGroupMessages, seedGroups, seedPollVotes } from './seed.groups';
import { seedCollections, seedReactions, seedSavedPosts, seedStatusPosts } from './seed.social';
import { seedVisionHistory } from './seed.vision';

export interface Tables {
  users: User[];
  posts: Post[];
  comments: Comment[];
  follows: Follow[];
  likes: { userId: string; postId: string }[];
  routes: Route[];
  matches: ZMatch[];
  messages: Message[];
  notifications: Notification[];
  locations: TrendingLocation[];
  hazards: HazardZone[];
  hazardConfirmations: { userId: string; hazardId: string }[];
  streams: LiveStream[];
  streamMessages: StreamMessage[];
  listings: Listing[];
  favorites: { userId: string; listingId: string }[];
  instructors: Instructor[];
  instructorReviews: InstructorReview[];
  bookings: Booking[];
  library: LibraryPlace[];
  shares: LocationShare[];
  stories: Story[];
  storyViews: { userId: string; storyId: string }[];
  businesses: Business[];
  stayBookings: StayBooking[];
  emergencyCenters: EmergencyCenter[];
  sosEvents: SosEvent[];
  /* v1.2 */
  aiThreads: AiThread[];
  aiMessages: AiMessage[];
  mapRegions: { id: ID; name: string; countryCode: string; center: GeoPoint }[];
  trailGraphs: TrailGraph[];
  mapPacks: MapPack[];
  savedRoutes: SavedRoute[];
  crags: Crag[];
  sectors: CragSector[];
  climbingRoutes: ClimbingRoute[];
  ascents: Ascent[];
  routeConfirmations: { userId: string; routeId: string }[];
  satDevices: SatDevice[];
  satMessages: SatMessage[];
  sosSessions: SosSession[];
  stayUnits: StayUnit[];
  unitBlocks: UnitBlock[];
  payments: Payment[];
  stayReviews: StayReview[];
  hostProfiles: HostProfile[];
  clubs: Club[];
  clubMembers: ClubMember[];
  clubEvents: ClubEvent[];
  eventRsvps: { userId: string; eventId: string }[];
  studentVerifications: StudentVerification[];
  badges: Badge[];
  earnedBadges: EarnedBadge[];
  challenges: Challenge[];
  challengeProgress: ChallengeProgress[];
  xpEvents: XpEvent[];
  quizQuestions: QuizQuestion[];
  quizAttempts: { userId: string; date: string; correct: number }[];
  passportStamps: PassportStamp[];
  /* v1.3 */
  destinations: Destination[];
  destinationStages: DestinationStage[];
  savedDestinations: { userId: string; destinationId: string }[];
  amsChecks: AmsCheck[];
  returnPlans: ReturnPlan[];
  visionHistory: (VisionHistoryItem & { userId: string })[];
  reactions: Reaction[];
  savedPosts: SavedPost[];
  collections: Collection[];
  groups: Group[];
  groupMembers: GroupMember[];
  groupMessages: GroupMessage[];
  pollVotes: { userId: string; messageId: string; optionIds: string[] }[];
  courses: Course[];
  lessons: Lesson[];
  courseSessions: CourseSession[];
  enrollments: Enrollment[];
  certificates: Certificate[];
  courseReviews: CourseReview[];
  /** Oturum açmış kullanıcının kimliği (null → çıkış yapılmış) */
  sessionUserId: string | null;
}

const STORAGE_KEY = 'zirve.mockdb.v5';

function seedTables(): Tables {
  return {
    users: deepClone(seedUsers),
    posts: deepClone([...seedStatusPosts, ...seedPosts]),
    comments: deepClone(seedComments),
    follows: deepClone(seedFollows),
    likes: deepClone(seedLikes),
    routes: deepClone(seedRoutes),
    matches: deepClone(seedMatches),
    messages: deepClone(seedMessages),
    notifications: deepClone(seedNotifications),
    locations: deepClone(seedLocations),
    hazards: deepClone(seedHazards),
    hazardConfirmations: deepClone(seedHazardConfirmations),
    streams: deepClone([seedDroneStream, ...seedStreams]),
    streamMessages: deepClone(seedStreamMessages),
    listings: deepClone(seedListings),
    favorites: deepClone(seedFavorites),
    instructors: deepClone(seedInstructors),
    instructorReviews: deepClone(seedInstructorReviews),
    bookings: deepClone(seedBookings),
    library: deepClone(seedLibrary),
    shares: deepClone(seedShares),
    stories: deepClone(seedStories),
    storyViews: deepClone(seedStoryViews),
    businesses: deepClone(seedBusinesses),
    stayBookings: deepClone(seedStayBookings),
    emergencyCenters: deepClone([...seedEmergencyCenters, ...seedDestinationEmergencyCenters]),
    sosEvents: [],
    aiThreads: deepClone(seedAiThreads),
    aiMessages: deepClone(seedAiMessages),
    mapRegions: deepClone(seedMapRegions),
    trailGraphs: deepClone(seedTrailGraphs),
    mapPacks: deepClone(seedMapPacks),
    savedRoutes: deepClone(seedSavedRoutes),
    crags: deepClone(seedCrags),
    sectors: deepClone(seedSectors),
    climbingRoutes: deepClone(seedClimbingRoutes),
    ascents: deepClone(seedAscents),
    routeConfirmations: deepClone(seedRouteConfirmations),
    satDevices: deepClone(seedSatDevices),
    satMessages: deepClone(seedSatMessages),
    sosSessions: deepClone(seedSosSessions),
    stayUnits: deepClone(seedStayUnits),
    unitBlocks: deepClone(seedUnitBlocks),
    payments: deepClone(seedPayments),
    stayReviews: deepClone(seedStayReviews),
    hostProfiles: deepClone(seedHostProfiles),
    clubs: deepClone(seedClubs),
    clubMembers: deepClone(seedClubMembers),
    clubEvents: deepClone(seedClubEvents),
    eventRsvps: deepClone(seedEventRsvps),
    studentVerifications: deepClone(seedStudentVerifications),
    badges: deepClone(seedBadges),
    earnedBadges: deepClone(seedEarnedBadges),
    challenges: deepClone(seedChallenges),
    challengeProgress: deepClone(seedChallengeProgress),
    xpEvents: deepClone(seedXpEvents),
    quizQuestions: deepClone(seedQuizQuestions),
    quizAttempts: deepClone(seedQuizAttempts),
    passportStamps: deepClone(seedPassportStamps),
    destinations: deepClone(seedDestinations),
    destinationStages: deepClone(seedDestinationStages),
    savedDestinations: deepClone(seedSavedDestinations),
    amsChecks: deepClone(seedAmsChecks),
    returnPlans: deepClone(seedReturnPlans),
    visionHistory: deepClone(seedVisionHistory),
    reactions: deepClone(seedReactions),
    savedPosts: deepClone(seedSavedPosts),
    collections: deepClone(seedCollections),
    groups: deepClone(seedGroups),
    groupMembers: deepClone(seedGroupMembers),
    groupMessages: deepClone(seedGroupMessages),
    pollVotes: deepClone(seedPollVotes),
    courses: deepClone(seedCourses),
    lessons: deepClone(seedLessons),
    courseSessions: deepClone(seedCourseSessions),
    enrollments: deepClone(seedEnrollments),
    certificates: deepClone(seedCertificates),
    courseReviews: deepClone(seedCourseReviews),
    sessionUserId: null,
  };
}

/**
 * Bellek içi, AsyncStorage'a kalıcı yazan basit veritabanı.
 * Tüm mock repository'ler bu sınıf üzerinden çalışır.
 */
export class MockDatabase {
  private tables: Tables | null = null;
  private loading: Promise<Tables> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly persist: boolean = true) {}

  async load(): Promise<Tables> {
    if (this.tables) return this.tables;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      if (this.persist) {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Tables;
            if (
              parsed &&
              Array.isArray(parsed.users) &&
              parsed.users.length > 0 &&
              Array.isArray(parsed.hazards) &&
              Array.isArray(parsed.library) &&
              Array.isArray(parsed.crags) &&
              Array.isArray(parsed.clubs) &&
              Array.isArray(parsed.destinations) &&
              Array.isArray(parsed.groups)
            ) {
              this.tables = parsed;
              return parsed;
            }
          }
        } catch {
          // bozuk veri → yeniden tohumla
        }
      }
      this.tables = seedTables();
      return this.tables;
    })();

    return this.loading;
  }

  /** Değişiklik sonrası çağrılır; yazmaları 150ms içinde birleştirir. */
  markDirty(): void {
    if (!this.persist || !this.tables) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    const snapshot = this.tables;
    this.persistTimer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => undefined);
    }, 150);
  }

  async reset(): Promise<void> {
    this.tables = seedTables();
    this.tables.sessionUserId = CURRENT_USER_ID;
    this.loading = null;
    if (this.persist) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.tables));
    }
  }
}

/** Gerçekçi bir ağ gecikmesi simüle eder. Testlerde 0 ms kullanılır. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
