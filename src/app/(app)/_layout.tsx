import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/core/theme';

export default function AppLayout() {
  const { colors } = useTheme();
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
    </Stack>
  );
}
