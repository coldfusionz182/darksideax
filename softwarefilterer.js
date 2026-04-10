// softwarefilterer.js

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadSoftwareThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  threadListEl.innerHTML = `
    <tr class="thread-row">
      <td colspan="4">Loading software threads...</td>
    </tr>
  `;

  try {
    const resp = await fetch(
      `/api/list-threads?section=software&limit=50&_=${Date.now()}`,
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

    // Sort first (no tag filtering yet)
    const softwareOnly = [...data];

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

    // Render all rows first
    if (softwareOnly.length === 0) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="4">No software threads yet. Be the first to post!</td>
        </tr>`;
      return;
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
          ${
            row.tag
              ? ` · <span class="badge-pill thread-tag">${row.tag}</span>`
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

    // After 2 seconds, filter rows using XPath on the DOM
    setTimeout(() => {
      const allowedTags = ['My Project', 'Cracked', 'Other'];

      const rows = Array.from(threadListEl.querySelectorAll('tr.thread-row'));

      rows.forEach((tr, index) => {
        // Build XPath relative to the whole document for this row:
        // //*[@id="thread-list"]/tr[index+1]/td[2]/div[1]/span
        const xpath = `//*[@id="thread-list"]/tr[${index + 1}]/td[2]/div[1]/span`;

        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );

        const span = result.singleNodeValue;
        const text = span ? span.textContent.trim() : '';

        if (!allowedTags.includes(text)) {
          tr.style.display = 'none';
        }
      });
    }, 2000);
  } catch (err) {
    console.error('loadSoftwareThreads error', err);
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">Network error loading software threads.</td>
      </tr>`;
  }
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadSoftwareThreads);
}

loadSoftwareThreads();