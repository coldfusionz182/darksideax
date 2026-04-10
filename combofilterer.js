// combofilterer.js

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadComboThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  // show temporary loading state while we fetch + process
  threadListEl.innerHTML = `
    <tr class="thread-row">
      <td colspan="4">Loading combo threads...</td>
    </tr>
  `;

  try {
    const resp = await fetch(
      `/api/list-threads?section=combo&limit=50&_=${Date.now()}`,
      { cache: 'no-store' }
    );
    const data = await resp.json();

    if (!Array.isArray(data)) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">Failed to load combo threads.</td>
        </tr>`;
      return;
    }

    // HARD filter:
    // 1) section === 'combo'
    // 2) tag contains one of: Email:Pass, User:Pass, Url:Email:Pass
    const allowedTags = ['email:pass', 'user:pass', 'url:email:pass'];

    const combosOnly = data.filter((row) => {
      const sectionOk =
        typeof row.section === 'string' &&
        row.section.toLowerCase() === 'combo';

      const tag = (row.tag || '').toString().toLowerCase();

      const tagOk = allowedTags.some((allowed) => tag.includes(allowed));

      return sectionOk && tagOk;
    });

    if (combosOnly.length === 0) {
      // wait 2 seconds before showing "no results"
      setTimeout(() => {
        threadListEl.innerHTML = `
          <tr class="thread-row">
            <td colspan="4">No combo threads yet. Be the first to post!</td>
          </tr>`;
      }, 2000);
      return;
    }

    // sort AFTER filtering
    if (sort === 'oldest') {
      combosOnly.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    } else if (sort === 'replies') {
      combosOnly.sort(
        (a, b) => (b.replies ?? 0) - (a.replies ?? 0)
      );
    } else {
      combosOnly.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    }

    // wait 2 seconds before rendering the final, filtered list
    setTimeout(() => {
      threadListEl.innerHTML = '';

      combosOnly.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'thread-row' + (idx % 2 === 1 ? ' alt' : '');

        const iconTd = document.createElement('td');
        iconTd.className = 'col-icon';
        iconTd.innerHTML = `
          <div class="thread-icon">
            <i class="fa fa-list"></i>
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
            ${
              row.tag
                ? ` · <span class="badge-pill">${row.tag}</span>`
                : ''
            }
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
    }, 2000);
  } catch (err) {
    console.error('loadComboThreads error', err);
    setTimeout(() => {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">Network error loading combo threads.</td>
        </tr>`;
    }, 2000);
  }
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadComboThreads);
}

loadComboThreads();