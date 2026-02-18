// Simple smoke test for fetch retry/backoff logic
(async () => {
  // Mock original fetch that fails the first two times, then succeeds
  let callCount = 0;
  const originalFetch = async (input, init) => {
    callCount++;
    console.log(`[mockFetch] call ${callCount}`);
    if (callCount < 3) {
      // Simulate network error on attempts 1 and 2
      const err = new Error('Simulated network error');
      err.name = 'FetchError';
      throw err;
    }
    // On attempt 3, return a fake Response-like object
    return { ok: true, status: 200, text: async () => 'ok' };
  };

  // Dummy recheckNetwork that resolves immediately
  const recheckNetwork = async () => {
    console.log('[recheckNetwork] called');
    return 'http://localhost:8000';
  };

  // Create wrapper
  function createFetchWrapper({ originalFetch, recheckNetwork, maxAttempts = 3, baseDelay = 50 }) {
    return async (input, init) => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await originalFetch(input, init);
          if (res && res.status >= 500 && attempt < maxAttempts) {
            const jitter = Math.floor(Math.random() * 50);
            const wait = baseDelay * Math.pow(2, attempt - 1) + jitter;
            console.warn(`[fetch] Server error ${res.status}, retrying in ${wait}ms (attempt ${attempt})`);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          return res;
        } catch (err) {
          console.warn(`[fetch] Network error on attempt ${attempt}:`, err.message);
          try {
            await recheckNetwork();
          } catch (e) {
            console.warn('[fetch] recheckNetwork failed:', e);
          }
          if (attempt < maxAttempts) {
            const jitter = Math.floor(Math.random() * 50);
            const wait = baseDelay * Math.pow(2, attempt - 1) + jitter;
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          throw err;
        }
      }
    };
  }

  const wrappedFetch = createFetchWrapper({ originalFetch, recheckNetwork, maxAttempts: 4, baseDelay: 20 });

  try {
    console.log('Starting test: expecting the wrapper to retry and eventually succeed');
    const res = await wrappedFetch('http://example.local/test');
    console.log('Test succeeded, response status:', res.status);
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(2);
  }

})();
