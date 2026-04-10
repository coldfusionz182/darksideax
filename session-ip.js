// session-ip.js
// Fetches the user's public IP once per session and stores it in sessionStorage.
// Also exposes a helper to read it elsewhere.

const SESSION_IP_KEY = 'darkside_session_ip';

// Call this to fetch & cache the IP for the current session
async function fetchAndStoreSessionIp() {
  try {
    // If IP already stored this session, use it
    const existing = sessionStorage.getItem(SESSION_IP_KEY);
    if (existing) {
      return existing;
    }

    // Public IP API (no auth)
    const resp = await fetch('https://api.ipify.org?format=json');
    if (!resp.ok) throw new Error('IP request failed');

    const data = await resp.json();
    const ip = data?.ip || '';

    if (ip) {
      sessionStorage.setItem(SESSION_IP_KEY, ip);
    }

    return ip;
  } catch (err) {
    console.error('Failed to fetch session IP', err);
    return null;
  }
}

// Helper to use from other scripts
export async function getSessionIp() {
  const existing = sessionStorage.getItem(SESSION_IP_KEY);
  if (existing) return existing;
  return await fetchAndStoreSessionIp();
}

// Auto-fetch as soon as this module is loaded
fetchAndStoreSessionIp();