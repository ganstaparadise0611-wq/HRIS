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
    
    // Auto mode: try local first (faster), fallback to ngrok
    console.log('[Network] Testing local network...', local);
    const localWorks = await testConnectivity(local, 2000);
    
    if (localWorks) {
      console.log('[Network] ✓ Local network connected!');
      currentBackendUrl = local;
      lastSuccessfulUrl = local;
      return local;
    }
    
    console.log('[Network] Local network unavailable, trying ngrok...', ngrok);
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
