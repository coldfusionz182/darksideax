// usertitleanims.js

// Map role label -> CSS class
function getUserTitleClass(roleText) {
  if (!roleText) return '';
  const lower = String(roleText).toLowerCase();

  if (lower === 'owner') return 'user-title-owner';
  if (lower === 'admin') return 'user-title-admin';

  return '';
}

// ---------- Build staff role map from Current Staff box ----------

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
    const roleLabel = roleSpan.textContent.trim(); // "Owner", "Admin", etc.

    const clsRole = getUserTitleClass(roleLabel);
    if (clsRole) {
      map.set(name.toLowerCase(), roleLabel); // store under lowercase username
    }
  });

  return map;
}

// ---------- 1. Apply effect to staff list usernames ----------

function enhanceStaffListUsernames(staffMap) {
  const container = document.getElementById('current-staff-list');
  if (!container) return;

  const lines = container.querySelectorAll('.staff-line');

  lines.forEach((line) => {
    const nameSpan = line.querySelector('.staff-name');
    const roleSpan = line.querySelector('.staff-role');
    if (!nameSpan || !roleSpan) return;

    const roleLabel = roleSpan.textContent.trim();

    nameSpan.classList.remove('user-title-owner', 'user-title-admin');

    const cls = getUserTitleClass(roleLabel);
    if (cls) nameSpan.classList.add(cls);
  });
}

// ---------- 2. Apply effect to shoutbox usernames ----------

function applyShoutboxUserAnimations(staffMap) {
  const shoutBox = document.getElementById('shoutbox-messages');
  if (!shoutBox) return;

  const links = shoutBox.querySelectorAll('.profile-username-link');

  links.forEach((link) => {
    const uname = link.textContent.trim();
    const key = uname.toLowerCase();

    const roleLabel = staffMap.get(key) || '';
    const cls = getUserTitleClass(roleLabel);

    link.classList.remove('user-title-owner', 'user-title-admin');
    if (cls) {
      link.classList.add(cls);
    }
  });
}

// ---------- 3. Watch for updates and re-apply ----------

function hookIntoStaffAndShoutbox() {
  const staffContainer = document.getElementById('current-staff-list');
  const shoutBox = document.getElementById('shoutbox-messages');
  if (!staffContainer && !shoutBox) return;

  let staffMap = buildStaffRoleMap();
  enhanceStaffListUsernames(staffMap);
  applyShoutboxUserAnimations(staffMap);

  if (staffContainer) {
    const staffObserver = new MutationObserver(() => {
      staffMap = buildStaffRoleMap();
      enhanceStaffListUsernames(staffMap);
      applyShoutboxUserAnimations(staffMap);
    });
    staffObserver.observe(staffContainer, { childList: true, subtree: true });
  }

  if (shoutBox) {
    const shoutObserver = new MutationObserver(() => {
      applyShoutboxUserAnimations(staffMap);
    });
    shoutObserver.observe(shoutBox, { childList: true, subtree: true });
  }
}

// ---------- Init ----------

document.addEventListener('DOMContentLoaded', () => {
  hookIntoStaffAndShoutbox();
});