import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(creatorId: Id<'creators'> | undefined) {
  const registerToken = useMutation(api.notifications.registerPushToken);
  const registered = useRef(false);

  useEffect(() => {
    if (!creatorId || registered.current) return;

    async function register() {
      // Push notifications only work on physical devices
      if (!Device.isDevice) {
        console.log('[Push] Must use physical device for push notifications');
        return;
      }

      // Check/request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Notification permission not granted');
        return;
      }

      // Android needs a notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10b981',
        });
      }

      try {
        const token = (
          await Notifications.getExpoPushTokenAsync({
            projectId: '2adbda2f-fecd-4fdd-91b8-56db76e0c780',
          })
        ).data;

        console.log('[Push] Token:', token);

        await registerToken({
          creatorId: creatorId!,
          token,
          platform: Platform.OS as 'ios' | 'android' | 'web',
        });

        registered.current = true;
        console.log('[Push] Token registered successfully');
      } catch (error) {
        console.error('[Push] Error registering token:', error);
      }
    }

    register();
  }, [creatorId, registerToken]);
}
