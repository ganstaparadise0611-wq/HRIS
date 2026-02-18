/**
 * React Hook for automatic network detection and switching
 * Use this hook in your components to get the current backend URL
 */

import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
    getCurrentBackendUrl,
    initializeNetwork,
    recheckNetwork
} from '../constants/network-detector';

export function useBackendUrl() {
  const [backendUrl, setBackendUrl] = useState<string>(getCurrentBackendUrl());
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [networkType, setNetworkType] = useState<string>('unknown');

  // Detect network on mount
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      setIsDetecting(true);
      const url = await initializeNetwork();
      if (mounted) {
        setBackendUrl(url);
        setIsDetecting(false);
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      setNetworkType(state.type);
      
      // When network changes, recheck connectivity
      if (state.isConnected) {
        console.log('[useBackendUrl] Network changed, rechecking...');
        setIsDetecting(true);
        const newUrl = await recheckNetwork();
        setBackendUrl(newUrl);
        setIsDetecting(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for app state changes (when app comes to foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[useBackendUrl] App became active, rechecking network...');
        setIsDetecting(true);
        const newUrl = await recheckNetwork();
        setBackendUrl(newUrl);
        setIsDetecting(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Manual refresh function
  const refreshNetwork = async () => {
    setIsDetecting(true);
    const newUrl = await recheckNetwork();
    setBackendUrl(newUrl);
    setIsDetecting(false);
    return newUrl;
  };

  return {
    backendUrl,
    isDetecting,
    networkType,
    refreshNetwork,
  };
}
