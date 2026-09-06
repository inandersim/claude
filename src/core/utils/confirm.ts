import { Alert, Platform } from 'react-native';

/**
 * Onay diyaloğu. Web'de `Alert.alert` düğmeleri çalışmadığı için tarayıcının
 * kendi `confirm` penceresi kullanılır; yerel platformlarda `Alert.alert`.
 */
export function confirmDialog(
  title: string,
  message: string,
  okLabel: string,
  cancelLabel: string,
  onOk: () => void,
): void {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}
