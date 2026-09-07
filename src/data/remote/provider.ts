import type { DataProvider } from '../repositories';

import { createRemoteContext, type RemoteContext } from './context';
import { createRealtimeApi } from './realtime';
import type { SupabaseLike } from './postgrest';
import { createArticleRepository } from './repos/articles';
import { createPhoneAuthRepository } from './repos/auth';
import { createClimbingRepository } from './repos/climbing';
import { createClubRepository } from './repos/clubs';
import {
  createAuthRepository,
  createBillingRepository,
  createBusinessRepository,
  createEmergencyRepository,
  createExploreRepository,
  createFeedRepository,
  createHazardRepository,
  createInstructorRepository,
  createLibraryRepository,
  createLiveRepository,
  createMarketRepository,
  createMatchRepository,
  createMessageRepository,
  createNotificationRepository,
  createPresenceRepository,
  createStoryRepository,
  createUserRepository,
} from './repos/core';
import { createCourseRepository } from './repos/courses';
import { createFunRepository } from './repos/fun';
import { createGroupRepository } from './repos/groups';
import { createInventoryRepository } from './repos/inventory';
import {
  createCountryRepository,
  createDestinationRepository,
  createHeritageRepository,
  createKidsRepository,
} from './repos/places';
import { createSocialRepository } from './repos/social';
import { createTelemedRepository } from './repos/telemed';
import {
  createAiRepository,
  createMapsRepository,
  createSatelliteRepository,
  createVisionRepository,
  createWeatherRepository,
} from './repos/tools';
import { createTrackRepository } from './repos/tracks';
import { createTvRepository } from './repos/tv';
import { createWildlifeRepository } from './repos/wildlife';

export interface RemoteProviderOptions {
  /** Oturum kullanıcısını dışarıdan bildirmek için (test/SSR). */
  sessionUserId?: string | null;
}

/**
 * `DataProvider` sözleşmesinin Supabase (PostgREST) uygulaması.
 *
 * Aynı arayüzü `createMockProvider` de uygular; ekranlar hangisinin bağlı
 * olduğunu bilmez. İş kuralları `src/domain` içindeki saf fonksiyonlardan
 * gelir — mock ile birebir aynı davranış için ortak kaynak kullanılır.
 */
export function createRemoteProvider(
  client: SupabaseLike,
  options: RemoteProviderOptions = {},
): DataProvider & { context: RemoteContext } {
  const ctx = createRemoteContext(client);
  if (options.sessionUserId !== undefined) ctx.setSessionUserId(options.sessionUserId);

  return {
    context: ctx,
    // E-posta/şifre `repos/core.ts`, telefon OTP `repos/auth.ts` içinde;
    // ekranlar ikisini tek `AuthApi` olarak görür.
    auth: { ...createAuthRepository(ctx), ...createPhoneAuthRepository(ctx) },
    users: createUserRepository(ctx),
    feed: createFeedRepository(ctx),
    explore: createExploreRepository(ctx),
    matches: createMatchRepository(ctx),
    notifications: createNotificationRepository(ctx),
    messages: createMessageRepository(ctx),
    hazards: createHazardRepository(ctx),
    live: createLiveRepository(ctx),
    market: createMarketRepository(ctx),
    instructors: createInstructorRepository(ctx),
    library: createLibraryRepository(ctx),
    presence: createPresenceRepository(ctx),
    stories: createStoryRepository(ctx),
    businesses: createBusinessRepository(ctx),
    billing: createBillingRepository(ctx),
    emergency: createEmergencyRepository(ctx),
    ai: createAiRepository(ctx),
    maps: createMapsRepository(ctx),
    climbing: createClimbingRepository(ctx),
    satellite: createSatelliteRepository(ctx),
    inventory: createInventoryRepository(ctx),
    clubs: createClubRepository(ctx),
    fun: createFunRepository(ctx),
    destinations: createDestinationRepository(ctx),
    vision: createVisionRepository(ctx),
    social: createSocialRepository(ctx),
    groups: createGroupRepository(ctx),
    courses: createCourseRepository(ctx),
    tracks: createTrackRepository(ctx),
    weather: createWeatherRepository(ctx),
    countries: createCountryRepository(ctx),
    articles: createArticleRepository(ctx),
    wildlife: createWildlifeRepository(ctx),
    telemed: createTelemedRepository(ctx),
    tv: createTvRepository(ctx),
    heritage: createHeritageRepository(ctx),
    kids: createKidsRepository(ctx),
    realtime: createRealtimeApi(client),

    /**
     * Demo verisini sıfırlama yalnızca mock sağlayıcıda anlamlıdır; gerçek
     * veritabanında hiçbir şey yapmaz (yıkıcı bir işlem istemciden tetiklenmez).
     */
    async reset() {
      /* uzak sağlayıcıda kasıtlı olarak boş */
    },
  };
}
