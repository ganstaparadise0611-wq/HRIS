/**
 * Network Detection and Auto-Switching Utility
 * Automatically detects which backend URL is reachable and switches accordingly
 */

import { NETWORK_CONFIG } from './network-config';

// Start with local network (more likely to work when on same WiFi)
let currentBackendUrl: string = NETWORK_CONFIG.local;
let lastSuccessfulUrl: string = NETWORK_CONFIG.local;
let isChecking = false;
let isInitialized = false;

/**
 * Test if a URL is reachable
 */
async function testConnectivity(url: string, timeout: number = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`${url}/test.php`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Detect best available network and return the URL
 */
export async function detectBestNetwork(): Promise<string> {
  if (isChecking) {
    return currentBackendUrl;
  }
  
  isChecking = true;
  
  try {
    const { preferred, local, ngrok } = NETWORK_CONFIG;
    
    // If user forced a specific mode, use it
    if (preferred === 'local') {
      currentBackendUrl = local;
      lastSuccessfulUrl = local;
      return local;
    }
    
    if (preferred === 'ngrok') {
      currentBackendUrl = ngrok;
      lastSuccessfulUrl = ngrok;
      return ngrok;
    }
    
    // Auto mode: try several likely local hosts quickly, then fallback to ngrok
    const candidates = [local, 'http://127.0.0.1:8000', 'http://localhost:8000', 'http://10.0.2.2:8000'];
    const tried = new Set<string>();

    console.log('[Network] Auto-detecting network, candidates:', candidates);

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (tried.has(candidate)) continue;
      tried.add(candidate);
      try {
        console.log('[Network] Testing candidate:', candidate);
        // Use short timeout for local checks so detection stays fast
        const works = await testConnectivity(candidate, 1500);
        if (works) {
          console.log('[Network] ✓ Candidate connected:', candidate);
          currentBackendUrl = candidate;
          lastSuccessfulUrl = candidate;
          return candidate;
        }
      } catch (e) {
        console.warn('[Network] Candidate test error for', candidate, e);
      }
    }

    console.log('[Network] Local candidates unavailable, checking local ngrok agent...');

    // Check local ngrok agent (if running) to discover active public tunnel
    try {
      const ngrokApi = 'http://127.0.0.1:4040/api/tunnels';
      console.log('[Network] Querying ngrok API at', ngrokApi);
      const apiWorks = await testConnectivity('http://127.0.0.1:4040', 800);
      if (apiWorks) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1200);
          const res = await fetch(ngrokApi, { method: 'GET', signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
          clearTimeout(timeoutId);
          if (res.ok) {
            const body = await res.json();
            if (body && Array.isArray(body.tunnels) && body.tunnels.length > 0) {
              const publicUrl = body.tunnels[0].public_url;
              console.log('[Network] Found active ngrok tunnel:', publicUrl);
              currentBackendUrl = publicUrl.replace(/\/$/, '');
              lastSuccessfulUrl = currentBackendUrl;
              return currentBackendUrl;
            }
          }
        } catch (e) {
          console.warn('[Network] Failed to query ngrok API:', e);
        }
      }
    } catch (e) {
      console.warn('[Network] ngrok API check error:', e);
    }

    console.log('[Network] Checking configured ngrok URL...', ngrok);
    const ngrokWorks = await testConnectivity(ngrok, 3000);

    if (ngrokWorks) {
      console.log('[Network] ✓ Ngrok connected!');
      currentBackendUrl = ngrok;
      lastSuccessfulUrl = ngrok;
      return ngrok;
    }
    
    // Both failed, use last successful or default to ngrok
    console.log('[Network] ⚠ Both networks unavailable, using last successful:', lastSuccessfulUrl);
    currentBackendUrl = lastSuccessfulUrl;
    return lastSuccessfulUrl;
    
  } catch (error) {
    console.error('[Network] Detection error:', error);
    return lastSuccessfulUrl;
  } finally {
    isChecking = false;
  }
}

/**
 * Get current backend URL (returns last known good URL immediately)
 */
export function getCurrentBackendUrl(): string {
  // Auto-initialize on first call
  if (!isInitialized) {
    isInitialized = true;
    // Start async detection in background
    initializeNetwork().catch(err => {
      console.error('[Network] Failed to initialize:', err);
    });
  }
  return currentBackendUrl;
}

/**
 * Force a network recheck
 */
export async function recheckNetwork(): Promise<string> {
  return await detectBestNetwork();
}

/**
 * Initialize network detection (call this once at app startup)
 */
export async function initializeNetwork(): Promise<string> {
  const url = await detectBestNetwork();
  console.log('[Network] Initialized with URL:', url);
  return url;
}
