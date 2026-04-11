// staffonline.js
// Requires: window.supabaseClient and window.getCurrentUserWithRole from scripts.js

// --- update rep.last_seen_at for the current logged-in user ---
async function touchLastSeenForCurrentUser() {
  try {
    if (!window.supabaseClient || !window.getCurrentUserWithRole) return;

    const supabaseClient = window.supabaseClient;
    const current = await window.getCurrentUserWithRole();
    if (!current) return;

    const username = current.username;
    const nowIso = new Date().toISOString();

    // does a rep row exist for this user?
    const { data: repRow, error: fetchErr } = await supabaseClient
      .from('rep')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (fetchErr) {
      console.error('staffonline: fetch rep row error', fetchErr);
      return;
    }

    if (!repRow) {
      const { error: insErr } = await supabaseClient
        .from('rep')
        .insert({
          username,
          amount: '0',
          given_by: 'system',
          timegiven: nowIso,
          last_seen_at: nowIso,
        });
      if (insErr) {
        console.error('staffonline: insert rep row error', insErr);
      }
    } else {
      const { error: updErr } = await supabaseClient
        .from('rep')
        .update({ last_seen_at: nowIso })
        .eq('id', repRow.id);
      if (updErr) {
        console.error('staffonline: update rep.last_seen_at error', updErr);
      }
    }
  } catch (e) {
    console.error('staffonline: touchLastSeenForCurrentUser exception', e);
  }
}

// --- load current staff, only if active within last 15 minutes ---

async function loadCurrentStaffOnline() {
  if (!window.supabaseClient) return;
  const supabaseClient = window.supabaseClient;

  const container = document.getElementById('current-staff-list');
  if (!container) return;

  container.innerHTML = '<div style="font-size:11px; color:#555; padding:4px 0;">Checking for staff...</div>';

  try {
    // 1) get staff users (admin/owner) from public.users
    const { data: users, error } = await supabaseClient
      .from('users')
      .select('id, email, role, username, userrank')
      .in('role', ['admin', 'owner'])
      .order('role', { ascending: false });

    if (error) {
      console.error('staffonline: loadCurrentStaffOnline error', error);
      return;
    }

    if (!users || users.length === 0) {
      container.textContent = 'No staff members found.';
      return;
    }

    // 2) get last_seen_at from rep for those usernames
    const usernames = users
      .map((u) => u.username)
      .filter((u) => !!u && u.trim().length > 0);

    const lastSeenMap = new Map();

    if (usernames.length > 0) {
      const { data: repRows, error: repErr } = await supabaseClient
        .from('rep')
        .select('username, last_seen_at')
        .in('username', usernames);

      if (repErr) {
        console.error('staffonline: rep last_seen_at error', repErr);
      } else if (repRows) {
        repRows.forEach((r) => {
          if (r.username && r.last_seen_at) {
            lastSeenMap.set(r.username, r.last_seen_at);
          }
        });
      }
    }

    const now = Date.now();
const fiveMinutesMs = 5 * 60 * 1000;

const activeStaff = users.filter((u) => {
  const ls = lastSeenMap.get(u.username);
  if (!ls) return false;
  const diff = now - new Date(ls).getTime();
  return diff <= fiveMinutesMs;
});

    container.innerHTML = '';

    if (!activeStaff.length) {
      container.textContent = 'No staff online in the last 15 minutes.';
      return;
    }

    activeStaff.forEach((u, idx) => {
      const line = document.createElement('div');
      line.className = 'staff-line thread-anim';
      line.style.animationDelay = `${idx * 0.1}s`;

      const displayName = u.username && u.username.trim()
        ? u.username
        : (u.email ? u.email.split('@')[0] : 'Unknown');

      const roleLabel = (u.userrank && u.userrank.trim())
        ? u.userrank
        : (u.role === 'owner'
            ? 'Owner'
            : u.role === 'admin'
              ? 'Administrator'
              : 'Staff');

      // Determine Branding Class
      let brandingClass = 'ds-user-member';
      if (u.role === 'owner') brandingClass = 'ds-user-owner';
      else if (u.role === 'admin') brandingClass = 'ds-user-admin';

      line.innerHTML = `
        <span class="staff-name ${brandingClass}">${displayName}</span>
        <span class="staff-role">${roleLabel}</span>
      `;

      container.appendChild(line);
    });
  } catch (err) {
    console.error('staffonline: loadCurrentStaffOnline exception', err);
  }
}

// --- init on page load ---

async function initStaffOnline() {
  await touchLastSeenForCurrentUser();
  await loadCurrentStaffOnline();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStaffOnline);
} else {
  initStaffOnline();
}