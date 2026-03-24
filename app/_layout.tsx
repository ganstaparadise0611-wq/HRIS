import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { initializeNetwork, recheckNetwork } from '@/constants/network-detector';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerForPushNotifications, getNotificationsModule } from '@/constants/notifications';

// Augment globalThis so TypeScript knows about our custom flag
declare global {
  // eslint-disable-next-line no-var
  var __fetchWrapped: boolean | undefined;
}

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Initialize network detection on app startup
  useEffect(() => {
    try {
      const originalFetch = globalThis.fetch;
      if (originalFetch && !globalThis.__fetchWrapped) {
        globalThis.__fetchWrapped = true;
        globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const maxAttempts = 2; // fewer attempts to keep UX snappy
          const baseDelay = 400; // ms
          const defaultTimeoutMs = 10000; // per-attempt timeout (increased to reduce AbortError)

          // Allow callers to override timeout via init.timeoutMs (non-standard field)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const timeoutMs = (init as any)?.timeoutMs ?? defaultTimeoutMs;

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Create per-attempt AbortController unless caller provided one
            let controller: AbortController | undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const providedSignal = (init as any)?.signal as AbortSignal | undefined;

            if (!providedSignal) {
              controller = new AbortController();
              const timeoutId = setTimeout(() => controller!.abort(), timeoutMs);
              try {
                const res = await originalFetch(input as any, { ...(init as any), signal: controller.signal });
                clearTimeout(timeoutId);
                if (res && res.status >= 500 && attempt < maxAttempts) {
                  const jitter = Math.floor(Math.random() * 200);
                  const wait = baseDelay * Math.pow(2, attempt - 1) + jitter;
                  await new Promise(r => setTimeout(r, wait));
                  continue;
                }
                return res;
              } catch (err) {
                clearTimeout(timeoutId);
                recheckNetwork().catch(() => {});

                if (attempt < maxAttempts) {
                  const jitter = Math.floor(Math.random() * 200);
                  const wait = baseDelay * Math.pow(2, attempt - 1) + jitter;
                  await new Promise(r => setTimeout(r, wait));
                  continue;
                }
                throw err;
              }
            } else {
              // Caller provided a signal; do not override, just use original fetch
              try {
                const res = await originalFetch(input as any, init as any);
                if (res && res.status >= 500 && attempt < maxAttempts) {
                  const jitter = Math.floor(Math.random() * 200);
                  const wait = baseDelay * Math.pow(2, attempt - 1) + jitter;
                  await new Promise(r => setTimeout(r, wait));
                  continue;
                }
                return res;
              } catch (err) {
                recheckNetwork().catch(() => {});
                if (attempt < maxAttempts) {
                  const jitter = Math.floor(Math.random() * 200);
                  const wait = baseDelay * Math.pow(2, attempt - 1) + jitter;
                  await new Promise(r => setTimeout(r, wait));
                  continue;
                }
                throw err;
              }
            }
          }
          // Should not reach here, fallback
          return originalFetch(input as any, init as any);
        };
      }
    } catch (_wrapErr) {
      // Fetch wrap failed; avoid logging to reduce console noise on mobile
    }

    initializeNetwork().then(() => {
      // Network ready
    }).catch(() => {
      // Init failed; avoid logging to reduce console noise on mobile
    });

    // Register for push notifications (native only)
    if (Platform.OS !== 'web') {
      registerForPushNotifications().catch(() => {});

      const N = getNotificationsModule();
      if (N) {
        // Listen for notifications received while app is foregrounded
        notificationListener.current = N.addNotificationReceivedListener((_notification: any) => {
          // Optionally update a badge or local state here
        });

        // Handle user tapping a notification
        responseListener.current = N.addNotificationResponseReceivedListener((response: any) => {
          const data = response.notification.request.content.data as any;
          if (!data?.type) return;

          switch (data.type) {
            case 'chat':
              router.push('/(tabs)/userchat' as any);
              break;
            case 'leave_request':
              router.push('/(tabs)/userleave' as any);
              break;
            case 'overtime_request':
              router.push('/(tabs)/userovertime' as any);
              break;
            case 'on_duty':
              router.push('/(tabs)/useronduty' as any);
              break;
            case 'task_assigned':
              router.push('/(tabs)/usertasks' as any);
              break;
            case 'feeds':
              router.push('/(tabs)/feeds' as any);
              break;
            default:
              break;
          }
        });
      }
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
