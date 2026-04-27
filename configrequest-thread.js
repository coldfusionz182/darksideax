// configrequest-thread.js

const crContent = document.getElementById('cr-content');

const STATUS_LABELS = {
  in_queue: 'In Queue',
  in_progress: 'In Progress',
  cannot_fulfill: 'Cannot Be Fulfilled',
  completed: 'Completed'
};
const STATUS_ICONS = {
  in_queue: 'fa-clock',
  in_progress: 'fa-spinner',
  cannot_fulfill: 'fa-exclamation-triangle',
  completed: 'fa-check-circle'
};
const NEXT_STATUS = {
  in_queue: 'in_progress',
  in_progress: 'completed',
  completed: 'cannot_fulfill',
  cannot_fulfill: 'in_queue'
};

let _isAdmin = false;
let _currentThread = null;

function getThreadId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function checkRole() {
  const user = await window.getCurrentUserWithRole?.();
  if (user && (user.role === 'owner' || user.role === 'admin')) {
    _isAdmin = true;
  }
}

async function fetchThread(threadId) {
  try {
    const resp = await fetch(`/api/list-threads?section=configrequests&limit=100&_=${Date.now()}`, { cache: 'no-store' });
    const data = await resp.json();
    if (!Array.isArray(data)) return null;
    return data.find(t => String(t.id) === String(threadId)) || null;
  } catch (err) {
    console.error('fetchThread error', err);
    return null;
  }
}

async function handleUpdateStatus(threadId, currentStatus) {
  const nextStatus = NEXT_STATUS[currentStatus] || 'in_queue';
  let download_url = null;

  if (nextStatus === 'completed') {
    download_url = prompt('Enter the download URL for this config file:');
    if (download_url === null) return;
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

    loadPage();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

window.handleUpdateStatus = handleUpdateStatus;

function renderThread(thread) {
  if (!crContent) return;

  if (!thread) {
    crContent.innerHTML = `
      <div class="cr-not-found">
        <i class="fa fa-exclamation-triangle"></i>
        <h2>Config request not found</h2>
        <p>This request may have been removed or the link is invalid.</p>
        <a href="configrequests.html" style="color:#a78bfa;">← Back to Config Requests</a>
      </div>`;
    return;
  }

  _currentThread = thread;
  const status = thread.config_request_status || 'in_queue';
  const isCompleted = status === 'completed';
  const isCannotFulfill = status === 'cannot_fulfill';
  const downloadUrl = thread.download_url || null;

  // Check if title looks like a URL
  const titleIsUrl = thread.title && (thread.title.startsWith('http://') || thread.title.startsWith('https://'));

  let html = `
    <div class="cr-detail-card">
      <div class="cr-detail-header">
        <div class="cr-detail-icon">
          <i class="fa fa-question-circle"></i>
        </div>
        <div>
          <div class="cr-detail-title">${thread.title}</div>
          <div class="cr-detail-meta">
            Requested by <strong>${thread.author}</strong>
            · ${new Date(thread.created_at).toLocaleDateString()}
            · ${new Date(thread.created_at).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div class="cr-info-grid">
        <div class="cr-info-item">
          <div class="cr-info-label">Status</div>
          <div class="cr-info-value">
            <span class="status-badge status-${status}">
              <i class="fa ${STATUS_ICONS[status]}"></i>
              ${STATUS_LABELS[status]}
            </span>
            ${_isAdmin ? `<button class="status-toggle-btn" style="margin-left:8px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.4);color:#a78bfa;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;" onclick="handleUpdateStatus(${thread.id}, '${status}')"><i class="fa fa-exchange-alt"></i> Change Status</button>` : ''}
          </div>
        </div>
        <div class="cr-info-item">
          <div class="cr-info-label">Author</div>
          <div class="cr-info-value">${thread.author}</div>
        </div>
      </div>`;

  // Show the URL if the title is a URL
  if (titleIsUrl) {
    html += `
      <div class="cr-url-box">
        <div class="cr-url-label"><i class="fa fa-link"></i> Target URL</div>
        <div class="cr-url-value"><a href="${thread.title}" target="_blank" rel="noopener">${thread.title}</a></div>
      </div>`;
  }

  // Show download box if completed
  if (isCompleted && downloadUrl) {
    html += `
      <div class="cr-download-box">
        <div class="cr-download-icon">
          <i class="fa fa-download"></i>
        </div>
        <div class="cr-download-text">
          <div class="cr-download-label">Config Ready — Download Available</div>
          <a href="${downloadUrl}" target="_blank" rel="noopener" class="cr-download-link">${downloadUrl}</a>
        </div>
        <a href="${downloadUrl}" target="_blank" rel="noopener" class="cr-download-btn">
          <i class="fa fa-download"></i> Download
        </a>
      </div>`;
  } else if (isCannotFulfill) {
    html += `
      <div class="cr-download-box" style="border-color:rgba(251,191,36,0.3);background:rgba(251,191,36,0.05);">
        <div class="cr-download-icon" style="background:rgba(251,191,36,0.2);color:#fbbf24;">
          <i class="fa fa-exclamation-triangle"></i>
        </div>
        <div class="cr-download-text">
          <div class="cr-download-label" style="color:#fbbf24;">Cannot Be Fulfilled</div>
          <span style="color:#888;font-size:0.85rem;">This config request cannot be completed at this time.</span>
        </div>
      </div>`;
  } else if (isCompleted && !downloadUrl) {
    html += `
      <div class="cr-download-box" style="border-color:rgba(251,191,36,0.3);background:rgba(251,191,36,0.05);">
        <div class="cr-download-icon" style="background:rgba(251,191,36,0.2);color:#fbbf24;">
          <i class="fa fa-exclamation-circle"></i>
        </div>
        <div class="cr-download-text">
          <div class="cr-download-label" style="color:#fbbf24;">Completed — No download link yet</div>
          <span style="color:#888;font-size:0.85rem;">An admin needs to add the download URL.</span>
        </div>
      </div>`;
  }

  html += `</div>`;
  crContent.innerHTML = html;
}

async function loadPage() {
  const threadId = getThreadId();
  if (!threadId) {
    renderThread(null);
    return;
  }

  crContent.innerHTML = `<div class="cr-loading"><i class="fa fa-spinner fa-spin"></i> Loading config request...</div>`;

  const thread = await fetchThread(threadId);
  renderThread(thread);
}

(async () => {
  await checkRole();
  loadPage();
})();
