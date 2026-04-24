// adminpanel.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ===================== CURRENT USER / ROLE HELPERS ===================== */

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

function renderAdminsTable(admins, currentUser) {
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

      const isOwnerRow = a.role === 'owner';

      if (!isOwnerRow) {
        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn-row btn-row-danger';
        btnRemove.innerHTML = `<i class="fa fa-user-minus"></i> Remove`;
        btnRemove.addEventListener('click', () =>
          handleDemoteAdmin(a.id, a.email)
        );
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
  try {
    const current = await getCurrentUserWithRole();
    if (!current || (current.role !== 'owner' && current.role !== 'admin')) {
      alert('You do not have permission to perform this action.');
      return;
    }

    const { data: targetUser, error: fetchErr } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (targetUser?.role === 'owner') {
      alert('You cannot modify the owner.');
      return;
    }

    const { error } = await supabaseClient
      .from('users')
      .update({ role: 'user' })
      .eq('id', userId);

    if (error) throw error;

    document.getElementById('stat-last-action').textContent =
      'Removed admin: ' + (email || userId);
    await refreshAdmins(current);
  } catch (err) {
    console.error('demote admin error', err);
    alert('Failed to remove admin: ' + err.message);
  }
}

async function handleAddAdmin(currentUser) {
  const email = prompt('Enter email of user to promote to admin:');
  if (!email) return;

  try {
    if (
      !currentUser ||
      (currentUser.role !== 'owner' && currentUser.role !== 'admin')
    ) {
      alert('You do not have permission to perform this action.');
      return;
    }

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

    if (data.role === 'owner') {
      alert('This user is already the owner.');
      return;
    }

    const { error: updErr } = await supabaseClient
      .from('users')
      .update({ role: 'admin' })
      .eq('id', userId);

    if (updErr) throw updErr;

    document.getElementById('stat-last-action').textContent =
      'Promoted to admin: ' + email;
    await refreshAdmins(currentUser);
  } catch (err) {
    console.error('add admin error', err);
    alert('Failed to add admin: ' + err.message);
  }
}

async function refreshAdmins(currentUser) {
  const admins = await loadAdmins();
  renderAdminsTable(admins, currentUser);
}

/* ===================== NEWEST THREADS SECTION ===================== */

let allThreads = [];

function renderThreadsTable(currentUser) {
  const tbody = document.getElementById('threads-tbody');
  const searchInput = document.getElementById('threads-search-input');
  if (!tbody) return;

  const query = (searchInput?.value || '').toLowerCase();

  const filtered = allThreads.filter((t) => {
    const title = (t.title || '').toLowerCase();
    const author = (t.author || '').toLowerCase();
    return title.includes(query) || author.includes(query);
  });

  tbody.innerHTML = '';

  if (!filtered.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'admin-empty';
    td.textContent = 'No threads found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  filtered.forEach((t) => {
    const tr = document.createElement('tr');

    const tdTitle = document.createElement('td');
    tdTitle.innerHTML = `<a href="thread.html?id=${t.id}" target="_blank">${t.title}</a>`;

    const tdAuthor = document.createElement('td');
    tdAuthor.textContent = t.author || 'unknown';

    const tdTag = document.createElement('td');
    tdTag.textContent = t.tag || '-';

    const tdCreated = document.createElement('td');
    const d = new Date(t.created_at);
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const mi = d.getMinutes().toString().padStart(2, '0');
    tdCreated.textContent = `${dd}/${mm} ${hh}:${mi}`;

    const tdActions = document.createElement('td');
    tdActions.style.textAlign = 'right';
    tdActions.className = 'admin-actions-cell';

    const canDelete =
      currentUser &&
      (currentUser.role === 'owner' || currentUser.role === 'admin');

    if (canDelete) {
      const btnDelete = document.createElement('button');
      btnDelete.className = 'btn-row btn-row-danger';
      btnDelete.innerHTML = `<i class="fa fa-trash"></i> Delete`;
      btnDelete.addEventListener('click', () =>
        handleDeleteThread(t.id, t.title, currentUser)
      );
      tdActions.appendChild(btnDelete);
    }

    tr.appendChild(tdTitle);
    tr.appendChild(tdAuthor);
    tr.appendChild(tdTag);
    tr.appendChild(tdCreated);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

async function loadNewestThreads(currentUser) {
  const tbody = document.getElementById('threads-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="admin-empty">Loading newest threads…</td>
      </tr>
    `;
  }

  try {
    const res = await fetch('/api/list-threads?limit=25');
    const data = await res.json();

    // only keep the first 4
    allThreads = (Array.isArray(data) ? data : []).slice(0, 4);

    renderThreadsTable(currentUser);
  } catch (err) {
    console.error('loadNewestThreads error', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="admin-empty">Failed to load threads.</td>
        </tr>
      `;
    }
  }
}

async function handleDeleteThread(threadId, title, currentUser) {
  try {
    if (
      !currentUser ||
      (currentUser.role !== 'owner' && currentUser.role !== 'admin')
    ) {
      alert('You do not have permission to delete threads.');
      return;
    }

    const isOwner = currentUser.role === 'owner';
    if (!isOwner) {
      const { data: thread, error: threadErr } = await supabaseClient
        .from('threads')
        .select('author')
        .eq('id', threadId)
        .maybeSingle();

      if (threadErr) throw threadErr;
      if (thread?.author === 'ColdFusionz') {
        alert('You cannot delete threads created by ColdFusionz.');
        return;
      }
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      alert('No token, please re‑login.');
      return;
    }

    const res = await fetch('/api/delete-thread', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: threadId }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to delete thread');
    }

    document.getElementById('stat-last-action').textContent =
      'Deleted thread: ' + (title || threadId);

    allThreads = allThreads.filter((t) => t.id !== threadId);
    renderThreadsTable(currentUser);
  } catch (err) {
    console.error('delete thread error', err);
    alert('Failed to delete thread: ' + err.message);
  }
}

/* ===================== CREDITS SECTION (OWNER ONLY) ===================== */

let selectedUserForCredits = null;

async function loadUsernamesForAutocomplete() {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('username')
      .not('username', 'is', null)
      .order('username', { ascending: true });
    
    if (error) {
      console.error('loadUsernamesForAutocomplete error', error);
      return [];
    }
    
    return (data || []).map(p => p.username);
  } catch (err) {
    console.error('loadUsernamesForAutocomplete catch', err);
    return [];
  }
}

async function handleSearchUser(currentUser) {
  const usernameInput = document.getElementById('credits-username');
  const statusEl = document.getElementById('credits-status');
  const userInfoDiv = document.getElementById('credits-user-info');
  const usernameDisplay = document.getElementById('credits-username-display');
  const balanceDisplay = document.getElementById('credits-balance-display');

  if (!usernameInput || !statusEl) return;

  const username = usernameInput.value?.trim();
  if (!username) {
    statusEl.textContent = 'Enter a username to search.';
    statusEl.style.color = '#f43f5e';
    return;
  }

  statusEl.textContent = 'Searching...';
  statusEl.style.color = '#fbbf24';

  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      statusEl.textContent = 'No token, please re-login.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const resp = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'get_user_credits', username }),
    });

    const json = await resp.json();
    if (!resp.ok || !json.success) {
      statusEl.textContent = 'User not found.';
      statusEl.style.color = '#f43f5e';
      if (userInfoDiv) userInfoDiv.style.display = 'none';
      selectedUserForCredits = null;
      return;
    }

    selectedUserForCredits = username;
    if (usernameDisplay) usernameDisplay.textContent = username;
    if (balanceDisplay) balanceDisplay.textContent = json.credits || 0;
    if (userInfoDiv) userInfoDiv.style.display = 'block';
    statusEl.textContent = '';
  } catch (err) {
    console.error('search user error', err);
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = '#f43f5e';
  }
}

async function handleGiveCredits(currentUser) {
  if (!selectedUserForCredits) {
    const statusEl = document.getElementById('credits-status');
    if (statusEl) {
      statusEl.textContent = 'Search for a user first.';
      statusEl.style.color = '#f43f5e';
    }
    return;
  }

  const amountInput = document.getElementById('credits-amount');
  const statusEl = document.getElementById('credits-status');
  const balanceDisplay = document.getElementById('credits-balance-display');

  if (!amountInput || !statusEl) return;

  const amount = parseInt(amountInput.value, 10);

  if (isNaN(amount) || amount === 0) {
    statusEl.textContent = 'Enter a non-zero amount.';
    statusEl.style.color = '#f43f5e';
    return;
  }

  statusEl.textContent = 'Processing...';
  statusEl.style.color = '#fbbf24';

  try {
    console.log('handleGiveCredits - current user role:', currentUser?.role);
    if (!currentUser || currentUser.role !== 'owner') {
      statusEl.textContent = 'Only owner can give credits. Your role: ' + (currentUser?.role || 'unknown');
      statusEl.style.color = '#f43f5e';
      return;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      alert('No token, please re-login.');
      return;
    }

    const resp = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'give', username: selectedUserForCredits, amount }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to give credits');
    }
    statusEl.textContent = `Gave ${amount > 0 ? '+' : ''}${amount} credits. New balance: ${json.credits}`;
    statusEl.style.color = '#10b981';
    amountInput.value = '';
    if (balanceDisplay) balanceDisplay.textContent = json.credits;

    document.getElementById('stat-last-action').textContent =
      `Credits: ${amount > 0 ? '+' : ''}${amount} to ${selectedUserForCredits}`;
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = '#f43f5e';
  }
}

async function handleRemoveCredits(currentUser) {
  if (!selectedUserForCredits) {
    const statusEl = document.getElementById('credits-status');
    if (statusEl) {
      statusEl.textContent = 'Search for a user first.';
      statusEl.style.color = '#f43f5e';
    }
    return;
  }

  const amountInput = document.getElementById('credits-amount');
  const statusEl = document.getElementById('credits-status');
  const balanceDisplay = document.getElementById('credits-balance-display');

  if (!amountInput || !statusEl) return;

  const amount = parseInt(amountInput.value, 10);

  if (isNaN(amount) || amount <= 0) {
    statusEl.textContent = 'Enter a positive amount to remove.';
    statusEl.style.color = '#f43f5e';
    return;
  }

  statusEl.textContent = 'Processing...';
  statusEl.style.color = '#fbbf24';

  try {
    if (!currentUser || currentUser.role !== 'owner') {
      statusEl.textContent = 'Only owner can remove credits.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      alert('No token, please re-login.');
      return;
    }

    const resp = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'give', username: selectedUserForCredits, amount: -amount }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to remove credits');
    }
    statusEl.textContent = `Removed ${amount} credits. New balance: ${json.credits}`;
    statusEl.style.color = '#10b981';
    amountInput.value = '';
    if (balanceDisplay) balanceDisplay.textContent = json.credits;

    document.getElementById('stat-last-action').textContent =
      `Credits: -${amount} from ${selectedUserForCredits}`;
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = '#f43f5e';
  }
}

async function handleResetCredits(currentUser) {
  if (!selectedUserForCredits) {
    const statusEl = document.getElementById('credits-status');
    if (statusEl) {
      statusEl.textContent = 'Search for a user first.';
      statusEl.style.color = '#f43f5e';
    }
    return;
  }

  const statusEl = document.getElementById('credits-status');
  const balanceDisplay = document.getElementById('credits-balance-display');

  if (!statusEl) return;

  if (!confirm(`Reset ${selectedUserForCredits}'s credits to 0?`)) return;

  statusEl.textContent = 'Processing...';
  statusEl.style.color = '#fbbf24';

  try {
    if (!currentUser || currentUser.role !== 'owner') {
      statusEl.textContent = 'Only owner can reset credits.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      alert('No token, please re-login.');
      return;
    }

    const resp = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'give', username: selectedUserForCredits, amount: 0 }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to reset credits');
    }
    statusEl.textContent = `Reset credits to 0.`;
    statusEl.style.color = '#10b981';
    if (balanceDisplay) balanceDisplay.textContent = 0;

    document.getElementById('stat-last-action').textContent =
      `Credits reset for ${selectedUserForCredits}`;
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = '#f43f5e';
  }
}

/* ===================== BAN SECTION (OWNER ONLY) ===================== */

async function handleBanUser(currentUser) {
  const usernameInput = document.getElementById('ban-username');
  const statusEl = document.getElementById('ban-status');

  if (!usernameInput || !statusEl) return;

  const username = usernameInput.value?.trim();
  if (!username) {
    statusEl.textContent = 'Username is required.';
    statusEl.style.color = '#f43f5e';
    return;
  }

  if (!confirm(`Ban user "${username}"? This will delete their account and prevent re-registration.`)) return;

  statusEl.textContent = 'Banning user...';
  statusEl.style.color = '#fbbf24';

  try {
    if (!currentUser || currentUser.role !== 'owner') {
      statusEl.textContent = 'Only owner can ban users.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      statusEl.textContent = 'No token, please re-login.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const resp = await fetch('/api/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'ban', username }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to ban user');
    }

    statusEl.textContent = `Banned: ${json.banned} (${json.email})`;
    statusEl.style.color = '#10b981';
    usernameInput.value = '';

    document.getElementById('stat-last-action').textContent = `Banned user: ${json.banned}`;
    await loadBannedUsers();
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = '#f43f5e';
  }
}

async function handleUnbanUser(email) {
  if (!confirm(`Unban "${email}"? They will be able to re-register.`)) return;

  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      alert('No token, please re-login.');
      return;
    }

    const resp = await fetch('/api/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'unban', email }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to unban');
    }

    document.getElementById('stat-last-action').textContent = `Unbanned: ${json.unbanned}`;
    await loadBannedUsers();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function loadBannedUsers() {
  const tbody = document.getElementById('banned-tbody');
  if (!tbody) return;

  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const resp = await fetch('/api/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'list' }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">Failed to load banned list</td></tr>';
      return;
    }

    const banned = json.banned || [];
    if (banned.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">No banned users</td></tr>';
      return;
    }

    tbody.innerHTML = banned.map(b => `
      <tr>
        <td>${b.email}</td>
        <td>${b.username || 'N/A'}</td>
        <td>${new Date(b.created_at).toLocaleDateString()}</td>
        <td style="text-align:right;">
          <button class="btn-owner-ghost" style="font-size:0.75rem; padding:4px 12px; border-color:#10b981; color:#10b981;" onclick="handleUnbanUser('${b.email}')">
            <i class="fa fa-check"></i> Unban
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('load banned users error', err);
    tbody.innerHTML = '<tr><td colspan="4" class="admin-empty">Error loading banned list</td></tr>';
  }
}

/* ===================== CREATE USER SECTION (OWNER ONLY) ===================== */

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function handleCreateUser(currentUser) {
  const emailInput = document.getElementById('create-user-email');
  const passwordInput = document.getElementById('create-user-password');
  const usernameInput = document.getElementById('create-user-username');
  const statusEl = document.getElementById('create-user-status');
  const resultDiv = document.getElementById('create-user-result');
  const credentialsDiv = document.getElementById('create-user-credentials');

  if (!emailInput || !passwordInput || !statusEl) return;

  const email = emailInput.value?.trim();
  const password = passwordInput.value;
  const username = usernameInput?.value?.trim() || '';

  if (!email) {
    statusEl.textContent = 'Email is required.';
    statusEl.style.color = '#f43f5e';
    return;
  }
  if (!password || password.length < 6) {
    statusEl.textContent = 'Password must be at least 6 characters.';
    statusEl.style.color = '#f43f5e';
    return;
  }

  statusEl.textContent = 'Creating user...';
  statusEl.style.color = '#fbbf24';
  if (resultDiv) resultDiv.style.display = 'none';

  try {
    if (!currentUser || currentUser.role !== 'owner') {
      statusEl.textContent = 'Only owner can create users.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      statusEl.textContent = 'No token, please re-login.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const resp = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'create_user', email, password, username }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to create user');
    }

    statusEl.textContent = 'User created successfully.';
    statusEl.style.color = '#10b981';

    // Show credentials
    if (resultDiv && credentialsDiv) {
      const creds = `Email: ${json.user.email}\nUsername: ${json.user.username || '(not set)'}\nPassword: ${json.user.password}\nUser Token: ${json.user.usertoken}`;
      credentialsDiv.textContent = creds;
      resultDiv.style.display = 'block';
    }

    emailInput.value = '';
    passwordInput.value = '';
    if (usernameInput) usernameInput.value = '';

    document.getElementById('stat-last-action').textContent = `Created user: ${json.user.email}`;
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = '#f43f5e';
  }
}

async function handleResetPassword(currentUser) {
  const emailInput = document.getElementById('reset-password-email');
  const passwordInput = document.getElementById('reset-password-new');
  const statusEl = document.getElementById('reset-password-status');

  if (!emailInput || !passwordInput || !statusEl) return;

  const email = emailInput.value?.trim();
  const newPassword = passwordInput.value;

  if (!email) {
    statusEl.textContent = 'Email is required.';
    statusEl.style.color = '#f43f5e';
    return;
  }
  if (!newPassword || newPassword.length < 6) {
    statusEl.textContent = 'New password must be at least 6 characters.';
    statusEl.style.color = '#f43f5e';
    return;
  }

  statusEl.textContent = 'Resetting password...';
  statusEl.style.color = '#fbbf24';

  try {
    if (!currentUser || currentUser.role !== 'owner') {
      statusEl.textContent = 'Only owner can reset passwords.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      statusEl.textContent = 'No token, please re-login.';
      statusEl.style.color = '#f43f5e';
      return;
    }

    const resp = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'reset_password', email, newPassword }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to reset password');
    }

    statusEl.textContent = `Password reset for ${json.email}`;
    statusEl.style.color = '#10b981';
    emailInput.value = '';
    passwordInput.value = '';

    document.getElementById('stat-last-action').textContent = `Reset password for ${json.email}`;
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.style.color = '#f43f5e';
  }
}

/* ===================== INIT ===================== */

async function initAdminPanel() {
  const main = document.querySelector('.admin-main');
  const deniedSection = document.getElementById('admin-access-denied');
  const userInfo = document.getElementById('admin-user-info');
  const btnAddAdmin = document.getElementById('btn-add-admin');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnCreateUser = document.getElementById('btn-create-user');
  const threadsSearchInput = document.getElementById('threads-search-input');
  const btnThreadsRefresh = document.getElementById('btn-threads-refresh');
  const btnGiveCredits = document.getElementById('btn-give-credits');
  const btnRemoveCredits = document.getElementById('btn-remove-credits');
  const btnResetCredits = document.getElementById('btn-reset-credits');
  const btnSearchUser = document.getElementById('btn-search-user');
  const btnBanUser = document.getElementById('btn-ban-user');
  const btnRefreshBans = document.getElementById('btn-refresh-bans');
  const btnGeneratePassword = document.getElementById('btn-generate-password');
  const btnCopyCredentials = document.getElementById('btn-copy-credentials');
  const btnResetPassword = document.getElementById('btn-reset-password');
  const btnGenerateResetPassword = document.getElementById('btn-generate-reset-password');
  const creditsCard = document.getElementById('admin-credits-card');

  const current = await getCurrentUserWithRole();
  console.log('current user for adminpanel', current);

  if (!current || (current.role !== 'owner' && current.role !== 'admin')) {
    if (main) main.style.display = 'none';
    if (deniedSection) deniedSection.style.display = 'block';
    return;
  }

  if (deniedSection) deniedSection.style.display = 'none';

  // Show credits card by default
  if (creditsCard) {
    creditsCard.style.display = 'block';
  }

  if (userInfo) {
    const roleLabel =
      current.role === 'owner'
        ? 'OWNER'
        : current.role === 'admin'
        ? 'ADMIN'
        : current.role.toUpperCase();

    userInfo.innerHTML = `
      <span><i class="fa fa-user-circle"></i> <strong>${current.username}</strong></span>
      <span class="badge-role">${roleLabel}</span>
    `;
  }

  if (btnAddAdmin)
    btnAddAdmin.addEventListener('click', () => handleAddAdmin(current));
  if (btnRefresh)
    btnRefresh.addEventListener('click', () => refreshAdmins(current));

  if (btnCreateUser)
    btnCreateUser.addEventListener('click', async () => {
      const freshUser = await getCurrentUserWithRole();
      handleCreateUser(freshUser);
    });

  if (threadsSearchInput)
    threadsSearchInput.addEventListener('input', () =>
      renderThreadsTable(current)
    );
  if (btnThreadsRefresh)
    btnThreadsRefresh.addEventListener('click', () =>
      loadNewestThreads(current)
    );

  if (btnGiveCredits)
    btnGiveCredits.addEventListener('click', async () => {
      const freshUser = await getCurrentUserWithRole();
      handleGiveCredits(freshUser);
    });

  if (btnRemoveCredits)
    btnRemoveCredits.addEventListener('click', async () => {
      const freshUser = await getCurrentUserWithRole();
      handleRemoveCredits(freshUser);
    });

  if (btnResetCredits)
    btnResetCredits.addEventListener('click', async () => {
      const freshUser = await getCurrentUserWithRole();
      handleResetCredits(freshUser);
    });

  if (btnSearchUser)
    btnSearchUser.addEventListener('click', async () => {
      const freshUser = await getCurrentUserWithRole();
      handleSearchUser(freshUser);
    });

  if (btnBanUser)
    btnBanUser.addEventListener('click', async () => {
      const freshUser = await getCurrentUserWithRole();
      handleBanUser(freshUser);
    });
  if (btnRefreshBans)
    btnRefreshBans.addEventListener('click', () => loadBannedUsers());

  // Generate password for create user
  if (btnGeneratePassword) {
    btnGeneratePassword.addEventListener('click', () => {
      const passwordInput = document.getElementById('create-user-password');
      if (passwordInput) {
        passwordInput.value = generatePassword();
      }
    });
  }

  // Copy credentials
  if (btnCopyCredentials) {
    btnCopyCredentials.addEventListener('click', () => {
      const credentialsDiv = document.getElementById('create-user-credentials');
      if (credentialsDiv) {
        navigator.clipboard.writeText(credentialsDiv.textContent);
        const originalText = btnCopyCredentials.innerHTML;
        btnCopyCredentials.innerHTML = '<i class="fa fa-check"></i> Copied';
        setTimeout(() => {
          btnCopyCredentials.innerHTML = originalText;
        }, 2000);
      }
    });
  }

  // Reset password
  if (btnResetPassword)
    btnResetPassword.addEventListener('click', async () => {
      const freshUser = await getCurrentUserWithRole();
      handleResetPassword(freshUser);
    });

  // Generate password for reset
  if (btnGenerateResetPassword) {
    btnGenerateResetPassword.addEventListener('click', () => {
      const passwordInput = document.getElementById('reset-password-new');
      if (passwordInput) {
        passwordInput.value = generatePassword();
      }
    });
  }

  // Ban username autocomplete
  const banUsernameInput = document.getElementById('ban-username');
  if (banUsernameInput) {
    loadUsernamesForAutocomplete().then(usernames => {
      if (!usernames.length) return;
      const datalist = document.createElement('datalist');
      datalist.id = 'ban-username-datalist';
      usernames.forEach(username => {
        const option = document.createElement('option');
        option.value = username;
        datalist.appendChild(option);
      });
      document.body.appendChild(datalist);
      banUsernameInput.setAttribute('list', 'ban-username-datalist');
    });
  }

  // Username autocomplete for credits
  const creditsUsernameInput = document.getElementById('credits-username');
  if (creditsUsernameInput) {
    loadUsernamesForAutocomplete().then(usernames => {
      if (!usernames.length) return;
      
      const datalist = document.createElement('datalist');
      datalist.id = 'credits-username-datalist';
      usernames.forEach(username => {
        const option = document.createElement('option');
        option.value = username;
        datalist.appendChild(option);
      });
      document.body.appendChild(datalist);
      creditsUsernameInput.setAttribute('list', 'credits-username-datalist');
    });
  }

  await refreshAdmins(current);
  await loadNewestThreads(current);
  await loadBannedUsers();

  const adminLogoutBtn = document.getElementById('admin-logout-btn');
  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await supabaseClient.auth.signOut();
      localStorage.removeItem('ds_access_token');
      window.location.href = 'index.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminPanel();
});