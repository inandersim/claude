import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { layout, useTheme } from '@/core/theme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Kaydırılabilir içerik */
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Sekme çubuğu için alt boşluk ekler */
  withTabBar?: boolean;
  scrollProps?: ScrollViewProps;
}

/** Güvenli alanları ve arka planı yöneten ekran kabuğu. */
export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  style,
  contentStyle,
  withTabBar = false,
  scrollProps,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  const bottomSpace = withTabBar ? layout.tabBarHeight + insets.bottom + 16 : 0;

  if (scroll) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }, padding, style]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
          contentContainerStyle={[
            { paddingBottom: bottomSpace + 24 },
            contentStyle,
            scrollProps?.contentContainerStyle,
          ]}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, padding, style]}>
      <View style={[styles.root, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
