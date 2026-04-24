// crackingtutorialsfilterer.js

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadCrackingTutorialsThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  threadListEl.innerHTML = `
    <tr class="thread-row">
      <td colspan="4" style="text-align:center; color:#888; padding: 20px;">Fetching cracking tutorials...</td>
    </tr>
  `;

  try {
    const resp = await fetch(
      '/api/list-threads?section=crackingtutorials&limit=50&_=' + Date.now(),
      { cache: 'no-store' }
    );
    const data = await resp.json();

    if (!Array.isArray(data)) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">Failed to load cracking tutorial threads.</td>
        </tr>`;
      return;
    }

    // HARD filter:
    const allowedTags = ['my project', 'cracked', 'other'];

    const tutorialsOnly = data.filter((row) => {
      const sectionOk = typeof row.section === 'string' && row.section.toLowerCase() === 'crackingtutorials';
      const tagText = (row.tag || '').toString().toLowerCase();
      return sectionOk && allowedTags.includes(tagText);
    });

    if (tutorialsOnly.length === 0) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">No cracking tutorial threads yet. Be the first to post!</td>
        </tr>`;
      return;
    }

    // Sort
    if (sort === 'oldest') {
      tutorialsOnly.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sort === 'replies') {
      tutorialsOnly.sort((a, b) => (b.replies ?? 0) - (a.replies ?? 0));
    } else {
      tutorialsOnly.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    threadListEl.innerHTML = '';

    tutorialsOnly.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'thread-row thread-anim' + (idx % 2 === 1 ? ' alt' : '');
      tr.style.animationDelay = `${idx * 0.05}s`;

      const iconTd = document.createElement('td');
      iconTd.className = 'col-icon';
      iconTd.innerHTML = `
        <div class="thread-icon">
          <i class="fa fa-graduation-cap"></i>
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
  } catch (err) {
    console.error('loadCrackingTutorialsThreads error', err);
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">Network error loading cracking tutorial threads.</td>
      </tr>`;
  }
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadCrackingTutorialsThreads);
}

loadCrackingTutorialsThreads();
