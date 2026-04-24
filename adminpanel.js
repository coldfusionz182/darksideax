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

async function handleGiveCredits(currentUser) {
  const usernameInput = document.getElementById('credits-username');
  const amountInput = document.getElementById('credits-amount');
  const statusEl = document.getElementById('credits-status');

  if (!usernameInput || !amountInput || !statusEl) return;

  const username = usernameInput.value?.trim();
  const amount = parseInt(amountInput.value, 10);

  if (!username) {
    statusEl.textContent = 'Enter a username.';
    statusEl.style.color = '#f43f5e';
    return;
  }
  if (isNaN(amount) || amount === 0) {
    statusEl.textContent = 'Enter a non-zero amount (positive to give, negative to remove).';
    statusEl.style.color = '#f43f5e';
    return;
  }

  statusEl.textContent = 'Processing...';
  statusEl.style.color = '#fbbf24';

  try {
    if (!currentUser || currentUser.role !== 'owner') {
      statusEl.textContent = 'Only owner can give credits.';
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
      body: JSON.stringify({ action: 'give', username, amount }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to give credits');
    }
    statusEl.textContent = `Gave ${amount > 0 ? '+' : ''}${amount} credits to ${username}. New balance: ${json.credits}`;
    statusEl.style.color = '#10b981';
    usernameInput.value = '';
    amountInput.value = '';

    document.getElementById('stat-last-action').textContent =
      `Credits: ${amount > 0 ? '+' : ''}${amount} to ${username}`;
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
  const btnCreateUser = document.getElementById('btn-create-user'); // unused
  const threadsSearchInput = document.getElementById('threads-search-input');
  const btnThreadsRefresh = document.getElementById('btn-threads-refresh');
  const btnGiveCredits = document.getElementById('btn-give-credits');
  const creditsCard = document.getElementById('admin-credits-card');

  const current = await getCurrentUserWithRole();
  console.log('current user for adminpanel', current);

  if (!current || (current.role !== 'owner' && current.role !== 'admin')) {
    if (main) main.style.display = 'none';
    if (deniedSection) deniedSection.style.display = 'block';
    return;
  }

  if (deniedSection) deniedSection.style.display = 'none';

  // Show credits card to all admin panel users
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

  if (threadsSearchInput)
    threadsSearchInput.addEventListener('input', () =>
      renderThreadsTable(current)
    );
  if (btnThreadsRefresh)
    btnThreadsRefresh.addEventListener('click', () =>
      loadNewestThreads(current)
    );

  if (btnGiveCredits)
    btnGiveCredits.addEventListener('click', () => handleGiveCredits(current));

  await refreshAdmins(current);
  await loadNewestThreads(current);

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