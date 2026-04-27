// configrequests-threads.js

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');
const crTitleInput = document.getElementById('cr-title-input');
const crTagSelect = document.getElementById('cr-tag-select');
const crSubmitBtn = document.getElementById('cr-submit-btn');
const crSubmitStatus = document.getElementById('cr-submit-status');
const crRefreshBtn = document.getElementById('cr-refresh-btn');

let _isAdmin = false;
let _currentUser = null;

const STATUS_ORDER = { in_queue: 0, in_progress: 1, cannot_fulfill: 2, completed: 3 };
const STATUS_LABELS = {
  in_queue: 'In Queue',
  in_progress: 'In Progress',
  cannot_fulfill: 'Cannot Be Fulfilled',
  completed: 'Completed'
};
const STATUS_ICONS = {
  in_queue: 'fa-clock',
  in_progress: 'fa-spinner fa-spin',
  cannot_fulfill: 'fa-exclamation-triangle',
  completed: 'fa-check-circle'
};
const NEXT_STATUS = {
  in_queue: 'in_progress',
  in_progress: 'completed',
  completed: 'cannot_fulfill',
  cannot_fulfill: 'in_queue'
};

async function checkRole() {
  _currentUser = await window.getCurrentUserWithRole?.();
  if (_currentUser && (_currentUser.role === 'owner' || _currentUser.role === 'admin')) {
    _isAdmin = true;
  }
}

async function fetchConfigRequests() {
  if (!threadListEl) return null;

  try {
    // Show loading message (same pattern as accounts-threads.js)
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="5" style="text-align:center; color:#888; padding: 20px;">Fetching config requests...</td>
      </tr>`;

    const resp = await fetch(
      `/api/list-threads?section=configrequests&limit=100&_=${Date.now()}`,
      { cache: 'no-store' }
    );
    const data = await resp.json();

    if (!Array.isArray(data)) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="5">Failed to load config requests.</td>
        </tr>`;
      return null;
    }

    // Double check it's config requests (same pattern as accounts-threads.js)
    const configRequestsOnly = data.filter((row) => {
      const sectionOk = typeof row.section === 'string' && row.section.toLowerCase() === 'configrequests';
      // Also ensure title doesn't contain 'config' to avoid conflicts with configs category
      const title = (row.title || '').toString().toLowerCase();
      return sectionOk && !title.includes('config');
    });

    return configRequestsOnly;
  } catch (err) {
    console.error('fetchConfigRequests error', err);
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="5">Failed to load config requests.</td>
      </tr>`;
    return null;
  }
}

async function handleUpdateStatus(threadId, currentStatus) {
  const nextStatus = NEXT_STATUS[currentStatus] || 'in_queue';
  const label = STATUS_LABELS[nextStatus];

  let download_url = null;

  // If changing to completed, prompt for download URL
  if (nextStatus === 'completed') {
    download_url = prompt('Enter the download URL for this config file:');
    if (download_url === null) return; // cancelled
    download_url = download_url.trim();
    if (!download_url) {
      alert('A download URL is required to mark a request as Completed.');
      return;
    }
  }

  try {
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { alert('No token, please re-login.'); return; }

    const body = { action: 'update_config_request_status', threadId, status: nextStatus };
    if (download_url) body.download_url = download_url;

    const resp = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to update status');
    }

    loadConfigRequests();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Make globally accessible for onclick
window.handleUpdateStatus = handleUpdateStatus;

async function handleStatusDropdownChange(threadId, newStatus) {
  let download_url = null;

  if (newStatus === 'completed') {
    download_url = prompt('Enter the download URL for this config file:');
    if (download_url === null) {
      loadConfigRequests(); // reset dropdown
      return;
    }
    download_url = download_url.trim();
    if (!download_url) {
      alert('A download URL is required to mark a request as Completed.');
      loadConfigRequests(); // reset dropdown
      return;
    }
  }

  try {
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { alert('No token, please re-login.'); loadConfigRequests(); return; }

    const body = { action: 'update_config_request_status', threadId, status: newStatus };
    if (download_url) body.download_url = download_url;

    const resp = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to update status');
    }

    loadConfigRequests();
  } catch (err) {
    alert('Error: ' + err.message);
    loadConfigRequests();
  }
}

window.handleStatusDropdownChange = handleStatusDropdownChange;

async function handleDeleteThread(threadId) {
  if (!confirm('Delete this config request?')) return;
  try {
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { alert('No token, please re-login.'); return; }
    const resp = await fetch('/api/delete-thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ id: threadId }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to delete');
    }
    loadConfigRequests();
  } catch (err) {
    alert('Failed to delete thread: ' + err.message);
  }
}

window.handleDeleteConfigRequest = handleDeleteThread;

function renderThreads(list, sortMode) {
  if (!threadListEl) return;

  if (!list || list.length === 0) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="5">No config requests yet. Be the first to request one!</td>
      </tr>`;
    return;
  }

  const sorted = [...list];

  if (sortMode === 'oldest') {
    sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (sortMode === 'status') {
    sorted.sort((a, b) => {
      const sa = STATUS_ORDER[a.config_request_status] ?? 0;
      const sb = STATUS_ORDER[b.config_request_status] ?? 0;
      if (sa !== sb) return sa - sb;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  } else {
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  threadListEl.innerHTML = '';

  sorted.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'thread-row thread-anim' + (idx % 2 === 1 ? ' alt' : '');
    tr.style.animationDelay = `${idx * 0.05}s`;

    const status = row.config_request_status || 'in_queue';

    const iconTd = document.createElement('td');
    iconTd.className = 'col-icon';
    iconTd.innerHTML = `
      <div class="thread-icon">
        <i class="fa fa-question-circle"></i>
      </div>
    `;

    const mainTd = document.createElement('td');
    mainTd.className = 'col-thread-main';
    mainTd.innerHTML = `
      <div class="thread-title">
        <a href="configrequest-thread.html?id=${row.id}">${row.title}</a>
      </div>
      <div class="thread-meta">
        by <span class="rank-member">${row.author}</span>
        · ${new Date(row.created_at).toLocaleDateString()}
        ${row.tag ? ` · <span class="badge-pill">${row.tag}</span>` : ''}
      </div>
    `;

    const statusTd = document.createElement('td');
    statusTd.className = 'col-status';
    let statusHtml = '';
    if (_isAdmin) {
      statusHtml = `
        <select onchange="handleStatusDropdownChange(${row.id}, this.value)" style="background:rgba(0,0,0,0.3);border:1px solid #2a2a2a;border-radius:4px;padding:4px 8px;font-size:0.75rem;color:#e0e0e0;font-family:inherit;cursor:pointer;">
          <option value="in_queue" ${status === 'in_queue' ? 'selected' : ''}>🕐 In Queue</option>
          <option value="in_progress" ${status === 'in_progress' ? 'selected' : ''}>🔄 In Progress</option>
          <option value="completed" ${status === 'completed' ? 'selected' : ''}>✅ Completed</option>
          <option value="cannot_fulfill" ${status === 'cannot_fulfill' ? 'selected' : ''}>⚠️ Cannot Be Fulfilled</option>
        </select>`;
    } else {
      statusHtml = `<span class="status-badge status-${status}"><i class="fa ${STATUS_ICONS[status]}"></i> ${STATUS_LABELS[status]}</span>`;
    }
    statusTd.innerHTML = statusHtml;

    const repliesTd = document.createElement('td');
    repliesTd.className = 'col-stats';
    repliesTd.textContent = row.replies ?? 0;

    const viewsTd = document.createElement('td');
    viewsTd.className = 'col-stats';
    viewsTd.textContent = row.views ?? 0;

    tr.appendChild(iconTd);
    tr.appendChild(mainTd);
    tr.appendChild(statusTd);
    tr.appendChild(repliesTd);
    tr.appendChild(viewsTd);

    if (_isAdmin) {
      const delTd = document.createElement('td');
      delTd.className = 'col-stats';
      const btn = document.createElement('button');
      btn.style.cssText = 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;';
      btn.innerHTML = '<i class="fa fa-trash"></i>';
      btn.addEventListener('click', () => handleDeleteThread(row.id));
      delTd.appendChild(btn);
      tr.appendChild(delTd);
    }

    threadListEl.appendChild(tr);
  });
}

async function loadConfigRequests() {
  const sort = sortSelectEl?.value || 'newest';
  const data = await fetchConfigRequests();
  if (!data) return;
  renderThreads(data, sort);
}

// Submit new config request
async function handleSubmitRequest() {
  if (!crTitleInput || !crSubmitStatus) return;

  const title = crTitleInput.value?.trim();
  if (!title) {
    crSubmitStatus.textContent = 'Please enter a URL or target name.';
    crSubmitStatus.style.color = '#f43f5e';
    return;
  }

  if (!_currentUser) {
    crSubmitStatus.textContent = 'You must be logged in to post.';
    crSubmitStatus.style.color = '#f43f5e';
    return;
  }

  const tag = crTagSelect?.value || 'Request';

  crSubmitStatus.textContent = 'Submitting request...';
  crSubmitStatus.style.color = '#fbbf24';

  try {
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      crSubmitStatus.textContent = 'No token, please re-login.';
      crSubmitStatus.style.color = '#f43f5e';
      return;
    }

    const resp = await fetch('/api/create-thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        title,
        tag,
        author: _currentUser.username || 'Anonymous',
        content: title,
        section: 'configrequests'
      }),
    });

    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to create request');
    }

    crSubmitStatus.textContent = 'Request submitted successfully!';
    crSubmitStatus.style.color = '#10b981';
    crTitleInput.value = '';

    loadConfigRequests();
  } catch (err) {
    crSubmitStatus.textContent = 'Error: ' + err.message;
    crSubmitStatus.style.color = '#f43f5e';
  }
}

// Event listeners
if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadConfigRequests);
}

if (crSubmitBtn) {
  crSubmitBtn.addEventListener('click', handleSubmitRequest);
}

if (crRefreshBtn) {
  crRefreshBtn.addEventListener('click', loadConfigRequests);
}

// Allow Enter key in input
if (crTitleInput) {
  crTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitRequest();
    }
  });
}

// Init
(async () => {
  await checkRole();
  loadConfigRequests();
})();
