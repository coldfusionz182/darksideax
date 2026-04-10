// usertitleanims.js

// We assume scripts.js already created supabaseClient and window.currentUser / window.dsUserRole.
// This file only decorates usernames with CSS classes based on role.

function getUserTitleClass(roleOrRank) {
  if (!roleOrRank) return '';
  const lower = String(roleOrRank).toLowerCase();

  if (lower === 'owner') return 'user-title-owner';
  if (lower === 'admin') return 'user-title-admin';

  return '';
}

// ---------- 1. Header username (top-right) ----------

function applyHeaderUserAnimation() {
  const pill = document.querySelector('.user-pill-name');
  if (!pill) return;

  const role =
    (window.currentUser && window.currentUser.role) || window.dsUserRole || 'user';

  pill.classList.remove('user-title-owner', 'user-title-admin');
  const cls = getUserTitleClass(role);
  if (cls) pill.classList.add(cls);
}

// ---------- 2. Staff list usernames ----------
// We rely on the HTML already rendered by scripts.js and only decorate names.

function enhanceStaffListUsernames() {
  const container = document.getElementById('current-staff-list');
  if (!container) return;

  const lines = container.querySelectorAll('.staff-line');

  lines.forEach((line) => {
    const nameSpan = line.querySelector('.staff-name');
    const roleSpan = line.querySelector('.staff-role');
    if (!nameSpan || !roleSpan) return;

    const roleText = roleSpan.textContent.trim().toLowerCase();
    let inferredRole = '';

    if (roleText === 'owner') inferredRole = 'owner';
    else if (roleText === 'admin') inferredRole = 'admin';

    nameSpan.classList.remove('user-title-owner', 'user-title-admin');

    const cls = getUserTitleClass(inferredRole);
    if (cls) nameSpan.classList.add(cls);
  });
}

// ---------- 3. Shoutbox usernames ----------
// After scripts.js renders the shoutbox, usernames are in .profile-username-link.
// We infer role by matching those names against staff list or a known map.

function buildStaffRoleMap() {
  const map = new Map();
  const container = document.getElementById('current-staff-list');
  if (!container) return map;

  const lines = container.querySelectorAll('.staff-line');
  lines.forEach((line) => {
    const nameSpan = line.querySelector('.staff-name');
    const roleSpan = line.querySelector('.staff-role');
    if (!nameSpan || !roleSpan) return;

    const name = nameSpan.textContent.trim();
    const roleText = roleSpan.textContent.trim().toLowerCase();

    let inferredRole = '';
    if (roleText === 'owner') inferredRole = 'owner';
    else if (roleText === 'admin') inferredRole = 'admin';

    if (inferredRole) {
      map.set(name.toLowerCase(), inferredRole);
    }
  });

  return map;
}

function applyShoutboxUserAnimations() {
  const shoutBox = document.getElementById('shoutbox-messages');
  if (!shoutBox) return;

  const staffMap = buildStaffRoleMap();
  const links = shoutBox.querySelectorAll('.profile-username-link');

  links.forEach((link) => {
    const uname = link.textContent.trim();
    const key = uname.toLowerCase();
    const role = staffMap.get(key) || ''; // owner/admin if staff

    link.classList.remove('user-title-owner', 'user-title-admin');
    const cls = getUserTitleClass(role);
    if (cls) link.classList.add(cls);
  });
}

// ---------- 4. Re-apply on shoutbox reload ----------

function hookIntoShoutboxRendering() {
  const shoutBox = document.getElementById('shoutbox-messages');
  if (!shoutBox) return;

  const observer = new MutationObserver(() => {
    applyShoutboxUserAnimations();
  });

  observer.observe(shoutBox, { childList: true, subtree: true });
}

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', () => {
  applyHeaderUserAnimation();
  enhanceStaffListUsernames();
  hookIntoShoutboxRendering();

  // If scripts.js ever updates currentUser and fires a custom event,
  // we can re-apply header styles:
  window.addEventListener('ds-user-updated', () => {
    applyHeaderUserAnimation();
  });
});