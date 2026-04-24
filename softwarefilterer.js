// softwarefilterer.js

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');
let _isOwner = false;

(async () => {
  const user = await window.getCurrentUserWithRole?.();
  if (user && (user.role === 'owner' || user.role === 'admin')) _isOwner = true;
})();

async function handleDeleteThread(threadId) {
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
    loadSoftwareThreads();
  } catch (err) {
    alert('Failed to delete thread: ' + err.message);
  }
}

async function handleToggleLock(threadId, currentStatus) {
  const newStatus = !currentStatus;
  try {
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { alert('No token, please re-login.'); return; }
    const resp = await fetch('/api/toggle-thread-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ id: threadId, is_locked: newStatus }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'Failed to toggle lock');
    }
    loadSoftwareThreads();
  } catch (err) {
    alert('Failed to toggle lock: ' + err.message);
  }
}

async function loadSoftwareThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  // Show nothing initially per user request
  threadListEl.innerHTML = `
    <tr class="thread-row">
      <td colspan="4" style="text-align:center; color:#888; padding: 20px;">Fetching software...</td>
    </tr>
  `;

  try {
    const resp = await fetch(
      '/api/list-threads?section=software&limit=50&_=' + Date.now(),
      { cache: 'no-store' }
    );
    const data = await resp.json();

    if (!Array.isArray(data)) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">Failed to load software threads.</td>
        </tr>`;
      return;
    }

    // HARD filter:
    const allowedTags = ['my project', 'cracked', 'other'];

    const softwareOnly = data.filter((row) => {
      const sectionOk = typeof row.section === 'string' && row.section.toLowerCase() === 'software';
      const tagText = (row.tag || '').toString().toLowerCase();
      return sectionOk && allowedTags.includes(tagText);
    });

    if (softwareOnly.length === 0) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">No software threads yet. Be the first to post!</td>
        </tr>`;
      return;
    }

    // Sort
    if (sort === 'oldest') {
      softwareOnly.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sort === 'replies') {
      softwareOnly.sort((a, b) => (b.replies ?? 0) - (a.replies ?? 0));
    } else {
      softwareOnly.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    threadListEl.innerHTML = '';

    softwareOnly.forEach((row, idx) => {
      const tr = document.createElement('tr');
      // Added .thread-anim for "appearing nicely"
      tr.className = 'thread-row thread-anim' + (idx % 2 === 1 ? ' alt' : '');
      // Staggered delay
      tr.style.animationDelay = `${idx * 0.05}s`;

      const iconTd = document.createElement('td');
      iconTd.className = 'col-icon';
      iconTd.innerHTML = `
        <div class="thread-icon">
          <i class="fa fa-cubes"></i>
        </div>
      `;

      const mainTd = document.createElement('td');
      mainTd.className = 'col-thread-main';
      mainTd.innerHTML = `
        <div class="thread-title">
          <a href="thread.html?id=${row.id}">${row.title}</a>
        </div>
        <div class="thread-meta">
          by <span class="rank-member">${row.author}</span>
          · ${new Date(row.created_at).toLocaleDateString()}
          ${row.tag ? ` · <span class="badge-pill">${row.tag}</span>` : ''}
        </div>
      `;

      const repliesTd = document.createElement('td');
      repliesTd.className = 'col-stats';
      repliesTd.textContent = row.replies ?? 0;

      const viewsTd = document.createElement('td');
      viewsTd.className = 'col-stats';
      viewsTd.textContent = row.views ?? 0;

      tr.appendChild(iconTd);
      tr.appendChild(mainTd);
      tr.appendChild(repliesTd);
      tr.appendChild(viewsTd);

      if (_isOwner) {
        const actionsTd = document.createElement('td');
        actionsTd.className = 'col-stats';
        actionsTd.style.display = 'flex';
        actionsTd.style.gap = '4px';
        actionsTd.style.alignItems = 'center';

        // Lock/Unlock button
        const lockBtn = document.createElement('button');
        const isLocked = row.is_locked === true;
        lockBtn.style.cssText = isLocked
          ? 'background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.4);color:#4ade80;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;'
          : 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;';
        lockBtn.innerHTML = isLocked ? '<i class="fa fa-unlock"></i>' : '<i class="fa fa-lock"></i>';
        lockBtn.title = isLocked ? 'Unlock thread' : 'Lock thread';
        lockBtn.addEventListener('click', () => handleToggleLock(row.id, row.is_locked));
        actionsTd.appendChild(lockBtn);

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.style.cssText = 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;';
        delBtn.innerHTML = '<i class="fa fa-trash"></i>';
        delBtn.addEventListener('click', () => handleDeleteThread(row.id));
        actionsTd.appendChild(delBtn);

        tr.appendChild(actionsTd);
      }

      threadListEl.appendChild(tr);
    });
  } catch (err) {
    console.error('loadSoftwareThreads error', err);
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">Network error loading software threads.</td>
      </tr>`;
  }
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadSoftwareThreads);
}

loadSoftwareThreads();
