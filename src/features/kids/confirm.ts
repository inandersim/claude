import { Alert, Platform } from 'react-native';

/** Web'de Alert.alert düğmeleri çalışmaz; onay diyaloğu için basit yedek. */
export function confirmDialog(
  title: string,
  message: string,
  okLabel: string,
  cancelLabel: string,
  onOk: () => void,
) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}
