// session-ip.js
// Handles fetching the user's public IP once per session
// and keeping a session-only username -> IP map.

const SESSION_IP_KEY = 'darkside_session_ip';
const USERS_IP_KEY = 'darkside_users_ip_map';

// Fetch & cache the IP for the current session
async function fetchAndStoreSessionIp() {
  try {
    const existing = sessionStorage.getItem(SESSION_IP_KEY);
    if (existing) return existing;

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

// Public helper: get current session IP (fetch if missing)
export async function getSessionIp() {
  const existing = sessionStorage.getItem(SESSION_IP_KEY);
  if (existing) return existing;
  return await fetchAndStoreSessionIp();
}

// Public helper: read full users->IP map
export function getUsersIpMapFromSession() {
  try {
    const raw = sessionStorage.getItem(USERS_IP_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) {
    console.warn('Failed to parse USERS_IP_KEY', e);
    return {};
  }
}

// Public helper: update map with a username + ip
export function updateUsersIpMap(username, ip) {
  if (!username || !ip) return;

  const now = new Date().toISOString();
  let map = {};
  try {
    const raw = sessionStorage.getItem(USERS_IP_KEY);
    if (raw) map = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse USERS_IP_KEY, resetting', e);
  }

  const existing = map[username] || {};
  const firstSeen = existing.firstSeen || now;

  map[username] = {
    ip,
    firstSeen,
    lastSeen: now,
  };

  sessionStorage.setItem(USERS_IP_KEY, JSON.stringify(map));
}

// Utility: get text content via XPath
export function getTextByXPath(xpath) {
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  );
  const node = result.singleNodeValue;
  return node ? node.textContent.trim() : '';
}

// Auto-fetch IP when this module loads
fetchAndStoreSessionIp();