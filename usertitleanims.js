// usertitleanims.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Role → CSS class ----------

function getUserTitleClass(roleOrRank) {
  if (!roleOrRank) return '';
  const lower = String(roleOrRank).toLowerCase();

  if (lower === 'owner') return 'user-title-owner';
  if (lower === 'admin') return 'user-title-admin';

  return '';
}

function getRoleLabel(userRow) {
  if (!userRow) return 'Member';
  if (userRow.userrank && userRow.userrank.trim()) return userRow.userrank.trim();

  switch (userRow.role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    default:
      return 'Member';
  }
}

// ---------- 1. Header username (top right) ----------

async function applyHeaderUserAnimation() {
  const pill = document.querySelector('.user-pill-name');
  if (!pill) return;

  // scripts.js already sets window.dsUserRole / window.currentUser.
  const role =
    (window.currentUser && window.currentUser.role) || window.dsUserRole || 'user';

  pill.classList.remove('user-title-owner', 'user-title-admin');
  const cls = getUserTitleClass(role);
  if (cls) pill.classList.add(cls);
}

// ---------- 2. Current Staff list usernames ----------
// We re-fetch with roles so we know which class to apply.

async function enhanceStaffList() {
  const container = document.getElementById('current-staff-list');
  if (!container) return;

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('email, role, username, userrank')
      .in('role', ['admin', 'owner'])
      .order('role', { ascending: false });

    if (error) {
      console.error('usertitleanims: staff load error', error);
      return;
    }

    container.innerHTML = '';

    if (!data || data.length === 0) {
      container.textContent = 'No staff members found.';
      return;
    }

    data.forEach((u) => {
      const line = document.createElement('div');
      line.className = 'staff-line';

      const displayName =
        (u.username && u.username.trim()) ||
        (u.email ? u.email.split('@')[0] : 'user');

      const roleLabel = getRoleLabel(u);
      const titleClass = getUserTitleClass(u.role || u.userrank);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'staff-name';
      nameSpan.textContent = displayName;
      if (titleClass) nameSpan.classList.add(titleClass);

      const roleSpan = document.createElement('span');
      roleSpan.className = 'staff-role';
      roleSpan.textContent = roleLabel;

      line.appendChild(nameSpan);
      line.appendChild(roleSpan);
      container.appendChild(line);
    });
  } catch (err) {
    console.error('usertitleanims: enhanceStaffList error', err);
  }
}

// ---------- 3. Shoutbox usernames ----------
// We reload shouts with joined role data and apply classes.

let shoutLastTimestamp = null;

async function loadShoutsWithRoles() {
  const shoutBox = document.getElementById('shoutbox-messages');
  if (!shoutBox) return;

  // join shouts -> users by user_id
  const { data, error } = await supabaseClient
    .from('shouts')
    .select(
      `
      id,
      user_id,
      username,
      message,
      created_at,
      users!inner(
        role,
        userrank
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('usertitleanims: loadShoutsWithRoles error', error);
    return;
  }

  shoutBox.innerHTML = '';

  if (!data || data.length === 0) return;

  data
    .slice()
    .reverse()
    .forEach((row) => {
      const line = document.createElement('div');
      line.className = 'shout-line';

      const textContainer = document.createElement('div');

      const userSpan = document.createElement('span');
      userSpan.className = 'shout-user rank-member';

      const userLink = document.createElement('a');
      userLink.className = 'profile-username-link';
      userLink.textContent = row.username || 'user';

      const userRow = row.users || null;
      const cls = getUserTitleClass(userRow?.role || userRow?.userrank);
      if (cls) userLink.classList.add(cls);

      userSpan.appendChild(userLink);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'shout-time';
      const d = new Date(row.created_at);
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      timeSpan.textContent = `${hh}:${mm}`;

      const textSpan = document.createElement('span');
      textSpan.className = 'shout-text';
      textSpan.textContent = row.message;

      textContainer.appendChild(userSpan);
      textContainer.appendChild(timeSpan);
      textContainer.appendChild(textSpan);

      line.appendChild(textContainer);
      shoutBox.appendChild(line);
    });

  shoutBox.scrollTop = shoutBox.scrollHeight;

  shoutLastTimestamp = data[0].created_at;
}

async function hasNewShoutsSinceLastTimestamp() {
  if (!shoutLastTimestamp) return true;

  const { data, error } = await supabaseClient
    .from('shouts')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('usertitleanims: hasNewShouts error', error);
    return false;
  }

  if (!data || data.length === 0) return false;

  const latest = data[0].created_at;
  return new Date(latest) > new Date(shoutLastTimestamp);
}

function setupAnimatedShoutboxPolling() {
  const shoutBox = document.getElementById('shoutbox-messages');
  if (!shoutBox) return;

  // initial load
  loadShoutsWithRoles();

  // poll every 10s, only reload when new shouts exist
  setInterval(async () => {
    try {
      const changed = await hasNewShoutsSinceLastTimestamp();
      if (changed) {
        await loadShoutsWithRoles();
      }
    } catch (e) {
      console.error('usertitleanims: shoutbox poll error', e);
    }
  }, 10000);
}

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', () => {
  applyHeaderUserAnimation();
  enhanceStaffList();
  setupAnimatedShoutboxPolling();
});