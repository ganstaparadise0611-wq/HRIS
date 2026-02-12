/**
 * Centralized Backend Configuration
 * 
 * Update the IP address and port here to change it across the entire app.
 * This ensures all API calls point to the same backend server.
 */

// PHP Backend Configuration
// Change this IP address to match your computer's local IP or deployed server
export const PHP_BACKEND_URL = 'http://192.168.15.24:8000';

// Supabase Configuration
export const SUPABASE_URL = 'https://cgyqweheceduyrpxqvwd.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_MJmY9d0yFuPp6KtQ62stGw_lFHMnNAK';

// Helper function to build API endpoints
export const buildApiUrl = (endpoint: string): string => {
  return `${PHP_BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  LOGIN: `${PHP_BACKEND_URL}/login.php`,
  SIGNUP: `${PHP_BACKEND_URL}/signup.php`,
  GET_CONVERSATIONS: `${PHP_BACKEND_URL}/get-conversations.php`,
  GET_MESSAGES: `${PHP_BACKEND_URL}/get-messages.php`,
  SEND_MESSAGE: `${PHP_BACKEND_URL}/send-message.php`,
  SEARCH_ACCOUNTS: `${PHP_BACKEND_URL}/search-accounts.php`,
  CREATE_CONVERSATION: `${PHP_BACKEND_URL}/create-conversation.php`,
  // Add more endpoints as needed
} as const;
