/**
 * notifications.ts
 * Expo push notification registration helper.
 * Call registerForPushNotifications() on app start (in _layout.tsx).
 *
 * expo-notifications does NOT support web — all code is guarded with
 * Platform.OS !== 'web' so the module loads safely in Expo Web / browser.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackendUrl } from './backend-config';

// Lazily import native-only modules so they are never loaded on web
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Device = require('expo-device');

  // Configure foreground notification presentation (native only)
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request permission and obtain the Expo push token.
 * Saves the token to the backend so notifications can be sent server-side.
 * No-op on web.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications || !Device) {
    return null;
  }

  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[Push] Skipping – simulator/emulator detected.');
    return null;
  }

  // Android: create a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F27121',
      sound: 'default',
    });
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission not granted.');
    return null;
  }

  // Get the token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Save token to AsyncStorage for quick access
  await AsyncStorage.setItem('expoPushToken', token).catch(() => {});

  // Send token to PHP backend
  await savePushTokenToBackend(token);

  return token;
}

/**
 * Save the push token to the backend, linked to the logged-in user.
 */
export async function savePushTokenToBackend(token: string): Promise<void> {
  try {
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) {
      // User not logged in yet – token will be registered after login
      return;
    }

    const backendUrl = getBackendUrl();
    await fetch(`${backendUrl}/save-push-token.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ user_id: userId, push_token: token }),
    });
  } catch (err) {
    console.warn('[Push] Failed to save token to backend:', err);
  }
}

/**
 * Re-register push token after login (call this right after a successful login).
 * This ensures the token is linked to the correct user_id.
 * No-op on web.
 */
export async function registerPushTokenAfterLogin(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const token = await AsyncStorage.getItem('expoPushToken');
    if (token) {
      await savePushTokenToBackend(token);
    } else {
      await registerForPushNotifications();
    }
  } catch (err) {
    console.warn('[Push] Failed to register token after login:', err);
  }
}

/**
 * Expose the raw Notifications module (for use in _layout.tsx listeners).
 * Returns null on web.
 */
export function getNotificationsModule() {
  return Notifications;
}
