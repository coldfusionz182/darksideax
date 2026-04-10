// configs-only.js
const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadConfigsThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  const resp = await fetch('/api/list-threads?section=configs&limit=50&_=' + Date.now(), {
    cache: 'no-store',
  });
  const data = await resp.json();

  if (!Array.isArray(data)) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">Failed to load config threads.</td>
      </tr>`;
    return;
  }

  // HARD filter:
  // 1) section === 'configs'
  // 2) title DOES contain "config" (backup check)
  const configsOnly = data.filter((row) => {
    const sectionOk =
      typeof row.section === 'string' &&
      row.section.toLowerCase() === 'configs';

    const title = (row.title || '').toString().toLowerCase();
    const titleOk = title.includes('config');

    return sectionOk && titleOk;
  });

  if (configsOnly.length === 0) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">No config threads yet. Be the first to post!</td>
      </tr>`;
    return;
  }

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
    tr.className = 'thread-row' + (idx % 2 === 1 ? ' alt' : '');

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

    threadListEl.appendChild(tr);
  });
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadConfigsThreads);
}

loadConfigsThreads();