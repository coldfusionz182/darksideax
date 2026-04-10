// softwareauth.js

// Requires: supabaseClient and getCurrentUserWithRole from scripts.js

const authKeyValueEl = document.getElementById('auth-key-value');
const authCopyBtn = document.getElementById('auth-copy-btn');
const authNewKeyBtn = document.getElementById('auth-newkey-btn');
const authStatusEl = document.getElementById('auth-status-text');

let currentUserInfo = null;
let lastGenTimestamp = 0;
const REGEN_COOLDOWN_MS = 30_000;

// 16‑character key: A‑Z + 0‑9
function generateSoftwareKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function setStatus(msg, color = '#9ca3c9') {
  if (!authStatusEl) return;
  authStatusEl.textContent = msg;
  authStatusEl.style.color = color;
}

async function loadCurrentUserAndKey() {
  // Get user + role from existing helper
  currentUserInfo = await getCurrentUserWithRole().catch(() => null);

  if (!currentUserInfo) {
    if (authKeyValueEl) authKeyValueEl.textContent = 'Login required to generate a key.';
    if (authNewKeyBtn) authNewKeyBtn.disabled = true;
    setStatus('You must be logged in to use Software Auth.', '#f97373');
    return;
  }

  const role = (currentUserInfo.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'owner') {
    if (authKeyValueEl) authKeyValueEl.textContent = 'No key available.';
    if (authNewKeyBtn) authNewKeyBtn.disabled = true;
    setStatus('Only Admins and the Owner can generate a Software Auth key.', '#f97373');
    return;
  }

  // Fetch existing softwarekey from public.users
  const { data, error } = await supabaseClient
    .from('users')
    .select('softwarekey')
    .eq('id', currentUserInfo.id)
    .maybeSingle();

  if (error) {
    console.error('load softwarekey error', error);
    setStatus('Failed to load existing key. You can try generating a new one.', '#f97373');
    return;
  }

  const existing = data?.softwarekey || '';
  if (existing && authKeyValueEl) {
    authKeyValueEl.textContent = existing;
    setStatus('Existing Software Auth key loaded.', '#a7f3d0');
  } else {
    if (authKeyValueEl) authKeyValueEl.textContent = 'No key generated yet.';
    setStatus('Click "Gen Key" to create your Software Auth key.', '#9ca3c9');
  }
}

async function handleGenerateKey() {
  if (!currentUserInfo) {
    setStatus('You must be logged in to generate a key.', '#f97373');
    return;
  }

  const role = (currentUserInfo.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'owner') {
    setStatus('Only Admins and the Owner can generate a Software Auth key.', '#f97373');
    return;
  }

  const now = Date.now();
  const diff = now - lastGenTimestamp;
  if (diff < REGEN_COOLDOWN_MS) {
    const secondsLeft = Math.ceil((REGEN_COOLDOWN_MS - diff) / 1000);
    setStatus(`You can generate a new key in ${secondsLeft}s.`, '#facc15');
    return;
  }

  const newKey = generateSoftwareKey();

  // Persist to public.users softwarekey
  const { error } = await supabaseClient
    .from('users')
    .update({ softwarekey: newKey })
    .eq('id', currentUserInfo.id);

  if (error) {
    console.error('update softwarekey error', error);
    setStatus('Failed to update key. Try again later.', '#f97373');
    return;
  }

  lastGenTimestamp = now;
  if (authKeyValueEl) authKeyValueEl.textContent = newKey;
  setStatus('New Software Auth key generated and saved.', '#a7f3d0');
}

async function handleCopyKey() {
  if (!authKeyValueEl) return;
  const text = authKeyValueEl.textContent.trim();
  if (!text || text === 'No key generated yet.' || text === 'No key available.') {
    setStatus('No valid key to copy.', '#f97373');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus('Key copied to clipboard.', '#a7f3d0');
  } catch (e) {
    console.error('copy key error', e);
    setStatus('Failed to copy key to clipboard.', '#f97373');
  }
}

function initSoftwareAuthPage() {
  if (authNewKeyBtn) {
    authNewKeyBtn.addEventListener('click', handleGenerateKey);
  }
  if (authCopyBtn) {
    authCopyBtn.addEventListener('click', handleCopyKey);
  }

  loadCurrentUserAndKey();
}

document.addEventListener('DOMContentLoaded', initSoftwareAuthPage);