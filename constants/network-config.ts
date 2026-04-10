/**
 * Network Configuration Storage
 * This file is auto-updated by the PowerShell scripts
 */

export interface NetworkConfig {
  local: string;
  ngrok: string;
  /** Optional: Cloudflare Tunnel, localtunnel, fxtun, etc. See TUNNEL-ALTERNATIVES.md */
  custom?: string;
  preferred: 'auto' | 'local' | 'ngrok' | 'custom';
}

// These URLs are automatically updated by start-system.ps1 and switch-network.ps1
export const NETWORK_CONFIG: NetworkConfig = {

  // Ngrok URL (updated when ngrok starts) — free tier has monthly bandwidth limit
  ngrok: 'https://ellen-subtrigonal-velda.ngrok-free.dev',

  // Local network URL (your PC on Wi‑Fi) — same network only
  local: 'http://192.168.15.43:8000',

  // Custom tunnel when ngrok hits bandwidth limit. See TUNNEL-ALTERNATIVES.md
  custom: undefined, // Set to your tunnel URL, e.g. from: npx localtunnel --port 8000

  // Auto: try local first, then tunnels (ngrok/custom) if unreachable
  preferred: 'auto'
};
