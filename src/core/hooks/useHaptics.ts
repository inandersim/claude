import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS !== 'web';

export const haptics = {
  light: () =>
    enabled
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
      : undefined,
  medium: () =>
    enabled
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
      : undefined,
  success: () =>
    enabled
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
      : undefined,
  error: () =>
    enabled
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
      : undefined,
  selection: () => (enabled ? Haptics.selectionAsync().catch(() => undefined) : undefined),
};
