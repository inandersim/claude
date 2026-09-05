import { Tabs } from 'expo-router';
import React, { useCallback } from 'react';

import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { AppTabBar, type TabMeta } from '@/components/AppTabBar';
import { useT } from '@/core/i18n';
import { useStreams } from '@/features/live/hooks';

export default function TabsLayout() {
  const { t } = useT();
  const { data: streams } = useStreams();
  const liveCount = streams?.filter((s) => s.status === 'live').length ?? 0;

  const meta: Record<string, TabMeta> = {
    index: { icon: 'house', label: t('tabs.home') },
    explore: { icon: 'compass', label: t('tabs.explore') },
    zmatch: { icon: 'zap', label: t('tabs.zmatch') },
    live: { icon: 'radio', label: t('tabs.live'), badge: liveCount },
    profile: { icon: 'user', label: t('tabs.profile') },
  };

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => <AppTabBar {...props} meta={meta} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveCount, t],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: 'transparent' },
      }}
      tabBar={renderTabBar}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore') }} />
      <Tabs.Screen name="zmatch" options={{ title: t('tabs.zmatch') }} />
      <Tabs.Screen name="live" options={{ title: t('tabs.live') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
