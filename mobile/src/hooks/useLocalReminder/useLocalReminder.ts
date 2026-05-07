import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'neuronot.daily.reminder';

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

export function useLocalReminder() {
  return {
    requestPermissionAndSchedule: async (hour: number) => {
      const granted = await ensurePermission();
      if (!granted) return false;
      await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: { title: 'Neuronot', body: 'Time to log your day.' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        },
      });
      return true;
    },
    cancel: async () => {
      await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    },
  };
}
