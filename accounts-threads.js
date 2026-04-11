// accounts-threads.js

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

// Core fetcher for accounts threads (always returns accounts-only list)
async function fetchAccountThreads() {
  if (!threadListEl) return null;

  try {
    // Show nothing initially per user request
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4" style="text-align:center; color:#888; padding: 20px;">Fetching accounts...</td>
      </tr>`;

    const resp = await fetch(
      `/api/list-threads?section=accounts&limit=50&_=${Date.now()}`,
      { cache: 'no-store' }
    );
    const data = await resp.json();

    if (!Array.isArray(data)) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">Failed to load account threads.</td>
        </tr>`;
      return null;
    }

    // Double check it's accounts just in case, and filter out 'config' mentions if needed
    const accountsOnly = data.filter((row) => {
      const sectionOk = typeof row.section === 'string' && row.section.toLowerCase() === 'accounts';
      const title = (row.title || '').toString().toLowerCase();
      return sectionOk && !title.includes('config');
    });

    return accountsOnly;
  } catch (err) {
    console.error('fetchAccountThreads error', err);
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">Failed to load account threads.</td>
      </tr>`;
    return null;
  }
}

function renderThreads(list, sortMode) {
  if (!threadListEl) return;

  if (!list || list.length === 0) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">No account threads yet. Be the first to post!</td>
      </tr>`;
    return;
  }

  const sorted = [...list];

  if (sortMode === 'oldest') {
    sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (sortMode === 'replies') {
    sorted.sort((a, b) => (b.replies ?? 0) - (a.replies ?? 0));
  } else {
    // newest
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  threadListEl.innerHTML = '';

  sorted.forEach((row, idx) => {
    const tr = document.createElement('tr');
    // Applied .thread-anim for "appearing nicely"
    tr.className = 'thread-row thread-anim' + (idx % 2 === 1 ? ' alt' : '');
    // Staggered delay for each row
    tr.style.animationDelay = `${idx * 0.05}s`;

    const iconTd = document.createElement('td');
    iconTd.className = 'col-icon';
    iconTd.innerHTML = `
      <div class="thread-icon">
        <i class="fa fa-user-tag"></i>
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

    threadListEl.appendChild(tr);
  });
}

// Load + render accounts threads according to current sort
async function loadAccountThreads() {
  const sort = sortSelectEl?.value || 'newest';
  const data = await fetchAccountThreads();
  if (!data) return;
  renderThreads(data, sort);
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadAccountThreads);
}

// Initial load
loadAccountThreads();