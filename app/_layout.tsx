import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { initializeNetwork, recheckNetwork } from '@/constants/network-detector';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Initialize network detection on app startup
  useEffect(() => {
    console.log('[App] Installing global fetch wrapper and initializing network detection...');

    // Wrap global fetch with retry + exponential backoff and a network re-check on failure
    try {
      const originalFetch = globalThis.fetch;
      if (originalFetch && !globalThis.__fetchWrapped) {
        globalThis.__fetchWrapped = true;
        globalThis.fetch = async (input: RequestInfo, init?: RequestInit) => {
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
                  console.warn(`[fetch] Server error ${res.status}, retrying in ${wait}ms (attempt ${attempt})`);
                  await new Promise(r => setTimeout(r, wait));
                  continue;
                }
                return res;
              } catch (err) {
                clearTimeout(timeoutId);
                console.warn('[fetch] Network/error on attempt', attempt, err);
                // Fire-and-forget network recheck (don't await) to avoid blocking retries
                recheckNetwork().catch(e => console.warn('[fetch] recheckNetwork failed:', e));

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
                  console.warn(`[fetch] Server error ${res.status}, retrying in ${wait}ms (attempt ${attempt})`);
                  await new Promise(r => setTimeout(r, wait));
                  continue;
                }
                return res;
              } catch (err) {
                console.warn('[fetch] Network/error on attempt', attempt, err);
                recheckNetwork().catch(e => console.warn('[fetch] recheckNetwork failed:', e));
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
    } catch (wrapErr) {
      console.error('[App] Failed to wrap fetch:', wrapErr);
    }

    initializeNetwork().then(url => {
      console.log('[App] Network initialized with URL:', url);
    }).catch(err => {
      console.error('[App] Network initialization error:', err);
    });
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
