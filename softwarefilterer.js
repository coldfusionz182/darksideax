// software-only.js (or softwarefilterer.js)

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadSoftwareThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  // 2 second delay before we even start (simulate "hard checking")
  await new Promise((resolve) => setTimeout(resolve, 2000));

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
  // 1) section === 'software'
  // 2) tag is one of: "My Project", "Cracked", "Other" (case‑insensitive)
  const allowedTags = ['my project', 'cracked', 'other'];

  const softwareOnly = data.filter((row) => {
    const sectionOk =
      typeof row.section === 'string' &&
      row.section.toLowerCase() === 'software';

    const tagText = (row.tag || '').toString().toLowerCase();
    const tagOk = allowedTags.includes(tagText);

    return sectionOk && tagOk;
  });

  if (softwareOnly.length === 0) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">No software threads yet. Be the first to post!</td>
      </tr>`;
    return;
  }

  if (sort === 'oldest') {
    softwareOnly.sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
  } else if (sort === 'replies') {
    softwareOnly.sort(
      (a, b) => (b.replies ?? 0) - (a.replies ?? 0)
    );
  } else {
    softwareOnly.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }

  threadListEl.innerHTML = '';

  softwareOnly.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'thread-row' + (idx % 2 === 1 ? ' alt' : '');

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

    threadListEl.appendChild(tr);
  });
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadSoftwareThreads);
}

loadSoftwareThreads();