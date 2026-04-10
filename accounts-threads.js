// accounts-threads.js
const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

// core fetcher
async function fetchThreads(sectionFilter = null) {
  if (!threadListEl) return null;

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

  if (!sectionFilter) {
    return data;
  }

  // HARD filter:
  // 1) section === 'accounts'
  // 2) title does NOT contain 'config' (backup check)
  return data.filter((row) => {
    const sectionOk =
      typeof row.section === 'string' &&
      row.section.toLowerCase() === 'accounts';

    const title = (row.title || '').toString().toLowerCase();
    const titleOk = !title.includes('config');

    return sectionOk && titleOk;
  });
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
    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  threadListEl.innerHTML = '';

  sorted.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'thread-row' + (idx % 2 === 1 ? ' alt' : '');

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

// normal load (no filter)
async function initialLoad() {
  const sort = sortSelectEl?.value || 'newest';
  const data = await fetchThreads(null); // no hard filter
  if (!data) return;
  renderThreads(data, sort);

  // after 2 seconds, apply the HARD filter and re-render
  setTimeout(async () => {
    const sort2 = sortSelectEl?.value || 'newest';
    const filtered = await fetchThreads('accounts-only');
    if (!filtered) return;
    renderThreads(filtered, sort2);
  }, 2000);
}

// manual reload (on sort change) uses filtered list
async function loadAccountThreadsFiltered() {
  const sort = sortSelectEl?.value || 'newest';
  const filtered = await fetchThreads('accounts-only');
  if (!filtered) return;
  renderThreads(filtered, sort);
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadAccountThreadsFiltered);
}

// first load: normal, then auto-filter after 2s
initialLoad();