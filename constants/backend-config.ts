/**
 * Centralized Backend Configuration with Auto-Network Detection
 * 
 * This configuration automatically switches between local and ngrok URLs
 * based on network availability. No manual switching needed!
 */

import { getCurrentBackendUrl } from './network-detector';

// Get the current backend URL (automatically detected)
export const getBackendUrl = (): string => {
  return getCurrentBackendUrl();
};

// Legacy constant for backward compatibility (uses auto-detection)
export const PHP_BACKEND_URL = getCurrentBackendUrl();

// Supabase Configuration
export const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
// Do NOT hard-code secrets. Provide the real key via environment or a secure store.
// This placeholder prevents accidental leaks in commits.
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'REDACTED';

// Helper function to build API endpoints
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getBackendUrl();
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// Dynamic API endpoints builder
export const getApiEndpoints = () => {
  const baseUrl = getBackendUrl();
  return {
    LOGIN: `${baseUrl}/login.php`,
    SIGNUP: `${baseUrl}/signup.php`,
    GET_CONVERSATIONS: `${baseUrl}/get-conversations.php`,
    GET_MESSAGES: `${baseUrl}/get-messages.php`,
    SEND_MESSAGE: `${baseUrl}/send-message.php`,
    SEARCH_ACCOUNTS: `${baseUrl}/search-accounts.php`,
    CREATE_CONVERSATION: `${baseUrl}/create-conversation.php`,
    ADD_CONVERSATION_MEMBER: `${baseUrl}/add-conversation-member.php`,
  } as const;
};

// Common API endpoints (backward compatibility)
export const API_ENDPOINTS = getApiEndpoints();
