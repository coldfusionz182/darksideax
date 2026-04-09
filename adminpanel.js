// adminpanel.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// helper: current user + role from public.users
async function getCurrentUserWithRole() {
  const { data: userData, error } = await supabaseClient.auth.getUser();
  if (error || !userData?.user) return null;

  const user = userData.user;

  const [{ data: profile }, { data: userRow }] = await Promise.all([
    supabaseClient
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email,
    username: profile?.username || user.email,
    role: userRow?.role || 'user',
  };
}

async function loadAdmins() {
  const { data, error } = await supabaseClient
    .from('users')
    .select('id, email, role')
    .in('role', ['admin', 'owner']);

  console.log('loadAdmins result', { data, error });

  if (error) {
    alert('Error loading admins: ' + error.message);
    return [];
  }
  return data || [];
}

function renderAdminsTable(admins) {
  const tbody = document.getElementById('admins-tbody');
  const statAdminCount = document.getElementById('stat-admin-count');

  if (!tbody) return;
  tbody.innerHTML = '';

  if (!admins.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'admin-empty';
    td.textContent = 'No admins found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    admins.forEach((a) => {
      const tr = document.createElement('tr');

      const tdEmail = document.createElement('td');
      tdEmail.textContent = a.email || '(no email)';

      const tdRole = document.createElement('td');
      tdRole.innerHTML =
        a.role === 'owner'
          ? `<span class="badge-role-owner">OWNER</span>`
          : `<span class="badge-role-admin">ADMIN</span>`;

      const tdUid = document.createElement('td');
      tdUid.textContent = a.id;

      const tdActions = document.createElement('td');
      tdActions.style.textAlign = 'right';
      tdActions.className = 'admin-actions-cell';

      if (a.role === 'admin') {
        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn-row btn-row-danger';
        btnRemove.innerHTML = `<i class="fa fa-user-minus"></i> Remove`;
        btnRemove.addEventListener('click', () => handleDemoteAdmin(a.id, a.email));
        tdActions.appendChild(btnRemove);
      } else {
        const span = document.createElement('span');
        span.className = 'btn-row btn-row-muted';
        span.innerHTML = `<i class="fa fa-crown"></i> Owner`;
        tdActions.appendChild(span);
      }

      tr.appendChild(tdEmail);
      tr.appendChild(tdRole);
      tr.appendChild(tdUid);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  if (statAdminCount) statAdminCount.textContent = admins.length.toString();
}

async function handleDemoteAdmin(userId, email) {
  if (!confirm(`Remove admin rights from ${email}?`)) return;

  try {
    const { error } = await supabaseClient
      .from('users')
      .update({ role: 'user' })
      .eq('id', userId);

    if (error) throw error;

    document.getElementById('stat-last-action').textContent =
      'Removed admin: ' + (email || userId);
    await refreshAdmins();
  } catch (err) {
    console.error('demote admin error', err);
    alert('Failed to remove admin: ' + err.message);
  }
}

async function handleAddAdmin() {
  const email = prompt('Enter email of user to promote to admin:');
  if (!email) return;

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      alert('No entry in public.users for that email. Create the user first.');
      return;
    }

    const userId = data.id;

    const { error: updErr } = await supabaseClient
      .from('users')
      .update({ role: 'admin' })
      .eq('id', userId);

    if (updErr) throw updErr;

    document.getElementById('stat-last-action').textContent =
      'Promoted to admin: ' + email;
    await refreshAdmins();
  } catch (err) {
    console.error('add admin error', err);
    alert('Failed to add admin: ' + err.message);
  }
}

async function refreshAdmins() {
  const admins = await loadAdmins();
  renderAdminsTable(admins);
}

// --- Create user via backend endpoint ---
async function handleCreateUser() {
  const emailInput = document.getElementById('create-email');
  const passInput = document.getElementById('create-password');
  const roleSelect = document.getElementById('create-role');
  const statusEl = document.getElementById('create-user-status');

  const email = emailInput.value.trim();
  const password = passInput.value.trim();
  const role = roleSelect.value;

  if (!email || !password) {
    statusEl.textContent = 'Email and password are required.';
    return;
  }

  statusEl.textContent = 'Creating user...';

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token || null;

  try {
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role, token }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to create user');
    }

    statusEl.textContent = `User created: ${json.user.email} (${json.user.role})`;
    emailInput.value = '';
    passInput.value = '';
    roleSelect.value = 'user';

    await refreshAdmins();
  } catch (err) {
    console.error('create user error', err);
    statusEl.textContent = 'Error: ' + err.message;
  }
}

async function initAdminPanel() {
  const main = document.querySelector('.admin-main');
  const deniedSection = document.getElementById('admin-access-denied');
  const userInfo = document.getElementById('admin-user-info');
  const btnAddAdmin = document.getElementById('btn-add-admin');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnCreateUser = document.getElementById('btn-create-user');

  const current = await getCurrentUserWithRole();
  console.log('current user for adminpanel', current);

  if (!current || current.role !== 'owner') {
    if (main) main.style.display = 'none';
    if (deniedSection) deniedSection.style.display = 'block';
    return;
  }

  if (deniedSection) deniedSection.style.display = 'none';

  if (userInfo) {
    userInfo.innerHTML = `
      <span><i class="fa fa-user-circle"></i> <strong>${current.username}</strong></span>
      <span class="badge-role">OWNER</span>
    `;
  }

  if (btnAddAdmin) btnAddAdmin.addEventListener('click', handleAddAdmin);
  if (btnRefresh) btnRefresh.addEventListener('click', refreshAdmins);
  if (btnCreateUser) btnCreateUser.addEventListener('click', handleCreateUser);

  await refreshAdmins();
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminPanel();
});