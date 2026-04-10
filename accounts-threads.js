// accounts-threads.js
const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadAccountThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

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
    return;
  }

  // HARD filter:
  // 1) section === 'accounts'
  // 2) title does NOT contain 'config' (backup check)
  const accountsOnly = data.filter((row) => {
    const sectionOk =
      typeof row.section === 'string' &&
      row.section.toLowerCase() === 'accounts';

    const title = (row.title || '').toString().toLowerCase();
    const titleOk = !title.includes('config');

    return sectionOk && titleOk;
  });

  if (accountsOnly.length === 0) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">No account threads yet. Be the first to post!</td>
      </tr>`;
    return;
  }

  if (sort === 'oldest') {
    accountsOnly.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (sort === 'replies') {
    accountsOnly.sort((a, b) => (b.replies ?? 0) - (a.replies ?? 0));
  } else {
    accountsOnly.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  threadListEl.innerHTML = '';

  accountsOnly.forEach((row, idx) => {
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

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadAccountThreads);
}

loadAccountThreads();