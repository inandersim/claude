import AsyncStorage from '@react-native-async-storage/async-storage';

import { deepClone } from '@/core/utils/clone';
import type {
  Booking,
  Comment,
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
  /** Oturum açmış kullanıcının kimliği (null → çıkış yapılmış) */
  sessionUserId: string | null;
}

const STORAGE_KEY = 'zirve.mockdb.v2';

function seedTables(): Tables {
  return {
    users: deepClone(seedUsers),
    posts: deepClone(seedPosts),
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
    streams: deepClone(seedStreams),
    streamMessages: deepClone(seedStreamMessages),
    listings: deepClone(seedListings),
    favorites: deepClone(seedFavorites),
    instructors: deepClone(seedInstructors),
    instructorReviews: deepClone(seedInstructorReviews),
    bookings: deepClone(seedBookings),
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
              Array.isArray(parsed.hazards)
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
