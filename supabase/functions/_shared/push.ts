// Expo Push Notification istemcisi.
// https://docs.expo.dev/push-notifications/sending-notifications/

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo'nun bir istekteki üst sınırı

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<{
  sent: number;
  failed: number;
  invalidTokens: string[];
}> {
  const valid = messages.filter((m) => /^ExponentPushToken\[.+\]$/.test(m.to));
  const invalidTokens: string[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN')
          ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
          : {}),
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      failed += batch.length;
      continue;
    }
    const payload = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    payload.data?.forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        sent += 1;
        return;
      }
      failed += 1;
      // Cihaz kaydı düştüyse token'ı temizlemek için topla
      if (ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(batch[index].to);
      }
    });
  }

  return { sent, failed, invalidTokens };
}
