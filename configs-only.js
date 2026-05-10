// configs-only.js
const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');
let _isOwner = false;

async function checkRole() {
  const user = await window.getCurrentUserWithRole?.();
  if (user && (user.role === 'owner' || user.role === 'admin')) _isOwner = true;
}

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
    loadConfigsThreads();
  } catch (err) {
    alert('Failed to delete thread: ' + err.message);
  }
}

async function loadConfigsThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  // Show nothing initially per user request
  threadListEl.innerHTML = `
    <tr class="thread-row">
      <td colspan="4" style="text-align:center; color:#888; padding: 20px;">Fetching configs...</td>
    </tr>`;

  try {
    const resp = await fetch(
      '/api/list-threads?section=configs&limit=50&_=' + Date.now(),
      { cache: 'no-store' }
    );
    const data = await resp.json();

    if (!Array.isArray(data)) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">Failed to load config threads.</td>
        </tr>`;
      return;
    }

    // Double check it's configs just in case
    const configsOnly = data.filter((row) => {
      const sectionOk = typeof row.section === 'string' && row.section.toLowerCase() === 'configs';
      return sectionOk;
    });

    if (configsOnly.length === 0) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">No config threads yet. Be the first to post!</td>
        </tr>`;
      return;
    }

    // Sort
    if (sort === 'oldest') {
      configsOnly.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sort === 'replies') {
      configsOnly.sort((a, b) => (b.replies ?? 0) - (a.replies ?? 0));
    } else {
      configsOnly.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    threadListEl.innerHTML = '';

    configsOnly.forEach((row, idx) => {
      const tr = document.createElement('tr');
      // Added .thread-anim for "appearing nicely"
      tr.className = 'thread-row thread-anim' + (idx % 2 === 1 ? ' alt' : '');
      // Staggered delay
      tr.style.animationDelay = `${idx * 0.05}s`;

      const iconTd = document.createElement('td');
      iconTd.className = 'col-icon';
      iconTd.innerHTML = `
        <div class="thread-icon">
          <i class="fa fa-sliders-h"></i>
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
  } catch (err) {
    console.error('loadConfigsThreads error', err);
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">Network error loading config threads.</td>
      </tr>`;
  }
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadConfigsThreads);
}

(async () => {
  await checkRole();
  loadConfigsThreads();
})();
