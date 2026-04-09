// configs-only.js
// Fetch only threads where section = 'configs' via /api/list-threads

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadConfigsThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  // base API call – already filtered by section=configs on the server
  let url = '/api/list-threads?section=configs&limit=50';

  // (optional) client-side sort handling if you want to change order locally later
  const resp = await fetch(url);
  const data = await resp.json();

  if (!Array.isArray(data) || data.length === 0) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">No config threads yet. Be the first to post!</td>
      </tr>`;
    return;
  }

  // if you want sort options to affect order, you can sort `data` here:
  if (sort === 'oldest') {
    data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (sort === 'replies') {
    data.sort((a, b) => (b.replies ?? 0) - (a.replies ?? 0));
  } else {
    // newest already from API, but we can enforce:
    data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  threadListEl.innerHTML = '';

  data.forEach((row, idx) => {
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

// reload on sort change
if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadConfigsThreads);
}

// initial load
loadConfigsThreads();