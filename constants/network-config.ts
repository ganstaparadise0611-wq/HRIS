/**
 * Network Configuration Storage
 * This file is auto-updated by the PowerShell scripts
 */

export interface NetworkConfig {
  local: string;
  ngrok: string;
  preferred: 'auto' | 'local' | 'ngrok';
}

// These URLs are automatically updated by start-system.ps1 and switch-network.ps1
export const NETWORK_CONFIG: NetworkConfig = {
  
  // Ngrok URL (updated when ngrok starts)
  ngrok: 'https://ellen-subtrigonal-velda.ngrok-free.dev',
  
  // Local network URL (auto-detected by script)
  local: 'http://10.253.120.119:8000',

  // Preferred mode: 'auto' = try local first, fallback to ngrok
  preferred: 'auto'
};
