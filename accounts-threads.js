// accounts-threads.js
const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadAccountThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  // base URL filtered to accounts
  let url = '/api/list-threads?section=accounts&limit=50';

  // you can also use sort on the client if needed; server currently sorts by created_at desc
  const resp = await fetch(url);
  const data = await resp.json();

  if (!Array.isArray(data) || data.length === 0) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">No account threads yet. Be the first to post!</td>
      </tr>`;
    return;
  }

  threadListEl.innerHTML = '';

  data.forEach((row, idx) => {
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

// optional: re‑load on sort change
if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadAccountThreads);
}

// initial load
loadAccountThreads();