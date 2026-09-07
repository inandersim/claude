import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/core/theme';
import { useSessionStore } from '@/features/auth/session.store';
import { usePushRegistration } from '@/features/notifications/usePush';

export default function AppLayout() {
  const { colors } = useTheme();
  // Oturum açıkken cihazın bildirim adresini kaydeder. Adres alınamazsa
  // (izin yok, web, Expo Go) uygulama bildirimsiz çalışmaya devam eder.
  usePushRegistration(useSessionStore((s) => s.user));
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen
        name="post/new"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="match/request"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="match/[id]" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="location/[id]" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="live/[id]" />
      <Stack.Screen
        name="live/start"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="hazards/index" />
      <Stack.Screen name="hazards/[id]" />
      <Stack.Screen
        name="hazards/report"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="market/index" />
      <Stack.Screen name="market/[id]" />
      <Stack.Screen
        name="market/new"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="instructors/index" />
      <Stack.Screen name="instructors/[id]" />
      <Stack.Screen
        name="instructors/book"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      {/* v1.1 */}
      <Stack.Screen name="library/index" />
      <Stack.Screen name="library/[id]" />
      <Stack.Screen name="live-location" />
      <Stack.Screen
        name="stories/create"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="stories/[authorId]"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen name="stays/index" />
      <Stack.Screen name="stays/[id]" />
      <Stack.Screen
        name="stays/reserve"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="stays/register"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="plans" />
      <Stack.Screen name="first-aid/index" />
      <Stack.Screen name="first-aid/[slug]" />
      <Stack.Screen name="first-aid/contacts" />
      {/* v1.2 */}
      <Stack.Screen name="assistant/index" />
      <Stack.Screen name="assistant/[threadId]" />
      <Stack.Screen name="maps/index" />
      <Stack.Screen name="maps/planner" />
      <Stack.Screen name="maps/route/[id]" />
      <Stack.Screen name="climbing/index" />
      <Stack.Screen name="climbing/[cragId]" />
      <Stack.Screen name="climbing/route/[id]" />
      <Stack.Screen
        name="climbing/submit"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="climbing/logbook" />
      <Stack.Screen name="satellite/index" />
      <Stack.Screen name="satellite/messages" />
      <Stack.Screen name="satellite/sos" />
      <Stack.Screen name="stays/booking/[id]" />
      <Stack.Screen name="stays/host/index" />
      <Stack.Screen name="stays/host/[businessId]" />
      <Stack.Screen name="clubs/index" />
      <Stack.Screen name="clubs/[id]" />
      <Stack.Screen name="clubs/event/[id]" />
      <Stack.Screen
        name="clubs/event/new"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="clubs/verify" />
      <Stack.Screen name="fun/index" />
      <Stack.Screen name="fun/challenges" />
      <Stack.Screen name="fun/leaderboard" />
      <Stack.Screen name="fun/badges" />
      <Stack.Screen name="fun/quiz" />
      <Stack.Screen name="fun/roulette" />
      <Stack.Screen name="fun/passport" />
      {/* v1.3 */}
      <Stack.Screen name="destinations/index" />
      <Stack.Screen name="destinations/[id]" />
      <Stack.Screen name="destinations/ams" />
      <Stack.Screen name="destinations/plans" />
      <Stack.Screen
        name="destinations/plan-new"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="assistant/vision"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="assistant/vision-history" />
      <Stack.Screen name="first-aid/country" />
      <Stack.Screen
        name="post/status"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="social/index" />
      <Stack.Screen name="social/saved" />
      <Stack.Screen name="social/tag/[tag]" />
      <Stack.Screen name="groups/index" />
      <Stack.Screen name="groups/[id]" />
      <Stack.Screen name="groups/info/[id]" />
      <Stack.Screen
        name="groups/create"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="groups/join" />
      <Stack.Screen name="courses/index" />
      <Stack.Screen name="courses/[id]" />
      <Stack.Screen name="courses/lesson/[id]" />
      <Stack.Screen name="courses/my" />
      <Stack.Screen name="courses/certificate/[id]" />
      <Stack.Screen
        name="courses/create"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      {/* v1.4 */}
      <Stack.Screen name="tracks/index" />
      <Stack.Screen name="tracks/[id]" />
      <Stack.Screen
        name="tracks/record"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="tracks/import"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="tracks/community/[id]" />
      <Stack.Screen name="tracks/pois" />
      <Stack.Screen
        name="navigate/[id]"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen name="weather/index" />
      {/* v1.6 */}
      <Stack.Screen name="tv/index" />
      <Stack.Screen name="tv/watch/[id]" options={{ animation: 'fade' }} />
      <Stack.Screen name="tv/channel/[id]" />
      <Stack.Screen name="tv/news/[id]" />
      <Stack.Screen
        name="tv/submit"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="heritage/index" />
      <Stack.Screen name="heritage/[id]" />
      <Stack.Screen name="heritage/guide/[id]" />
      <Stack.Screen name="heritage/tours" />
      <Stack.Screen name="kids/index" />
      <Stack.Screen name="kids/place/[id]" />
      <Stack.Screen name="kids/hunt" />
      <Stack.Screen name="kids/checklist" />
      {/* v1.5 */}
      <Stack.Screen name="countries/index" />
      <Stack.Screen name="countries/[code]" />
      <Stack.Screen name="countries/checklist/[code]" />
      <Stack.Screen name="articles/index" />
      <Stack.Screen name="articles/[slug]" />
      <Stack.Screen name="articles/writer/[userId]" />
      <Stack.Screen name="articles/writers" />
      <Stack.Screen
        name="articles/write"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="articles/apply" />
      <Stack.Screen name="articles/saved" />
      <Stack.Screen name="wildlife/index" />
      <Stack.Screen name="wildlife/species/[id]" />
      <Stack.Screen
        name="wildlife/identify"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="wildlife/questions" />
      <Stack.Screen name="wildlife/question/[id]" />
      <Stack.Screen
        name="wildlife/ask"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="wildlife/deterrent"
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
      <Stack.Screen name="telemed/index" />
      <Stack.Screen name="telemed/doctor/[id]" />
      <Stack.Screen
        name="telemed/request"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="telemed/consult/[id]" />
      <Stack.Screen name="telemed/history" />
    </Stack>
  );
}
