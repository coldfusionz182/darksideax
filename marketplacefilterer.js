// marketplacefilterer.js

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  // Match youtube.com/watch?v= or youtu.be/ or youtube.com/embed/
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  // If it's already an embed URL, return as-is
  if (url.includes('youtube.com/embed/')) return url;
  return null;
}

function getEmbedHtml(url) {
  const ytEmbed = getYouTubeEmbedUrl(url);
  if (ytEmbed) {
    return `<div class="marketplace-embed"><iframe src="${ytEmbed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  // For non-YouTube URLs, show as a clickable link
  if (url) {
    return `<a href="${url}" target="_blank" rel="noopener" class="marketplace-link"><i class="fa fa-external-link-alt"></i> View Media</a>`;
  }
  return '';
}

async function loadMarketplaceThreads() {
  if (!threadListEl) return;

  const sort = sortSelectEl?.value || 'newest';

  threadListEl.innerHTML = `
    <tr class="thread-row">
      <td colspan="5" style="text-align:center; color:#888; padding: 20px;">Fetching marketplace...</td>
    </tr>
  `;

  try {
    const resp = await fetch(
      '/api/list-threads?section=marketplace&limit=50&_=' + Date.now(),
      { cache: 'no-store' }
    );
    const data = await resp.json();

    if (!Array.isArray(data)) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="5">Failed to load marketplace threads.</td>
        </tr>`;
      return;
    }

    const marketplaceOnly = data.filter((row) => {
      return typeof row.section === 'string' && row.section.toLowerCase() === 'marketplace';
    });

    if (marketplaceOnly.length === 0) {
      threadListEl.innerHTML = `
        <tr class="thread-row">
          <td colspan="5">No marketplace threads yet.</td>
        </tr>`;
      return;
    }

    // Sort
    if (sort === 'oldest') {
      marketplaceOnly.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sort === 'replies') {
      marketplaceOnly.sort((a, b) => (b.replies ?? 0) - (a.replies ?? 0));
    } else {
      marketplaceOnly.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    threadListEl.innerHTML = '';

    marketplaceOnly.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'thread-row thread-anim' + (idx % 2 === 1 ? ' alt' : '');
      tr.style.animationDelay = `${idx * 0.05}s`;

      const iconTd = document.createElement('td');
      iconTd.className = 'col-icon';
      iconTd.innerHTML = `
        <div class="thread-icon">
          <i class="fa fa-store"></i>
        </div>
      `;

      const mainTd = document.createElement('td');
      mainTd.className = 'col-thread-main';

      let mediaHtml = '';
      if (row.embed_url) {
        mediaHtml = getEmbedHtml(row.embed_url);
      }

      mainTd.innerHTML = `
        <div class="thread-title">
          <a href="thread.html?id=${row.id}">${row.title}</a>
          ${row.price ? `<span class="marketplace-price">$${row.price}</span>` : ''}
        </div>
        <div class="thread-meta">
          by <span class="rank-member">${row.author}</span>
          · ${new Date(row.created_at).toLocaleDateString()}
          ${row.tag ? ` · <span class="badge-pill">${row.tag}</span>` : ''}
        </div>
        ${mediaHtml}
      `;

      const priceTd = document.createElement('td');
      priceTd.className = 'col-stats';
      priceTd.innerHTML = row.price ? `<span class="marketplace-price-cell">$${row.price}</span>` : '-';

      const repliesTd = document.createElement('td');
      repliesTd.className = 'col-stats';
      repliesTd.textContent = row.replies ?? 0;

      const viewsTd = document.createElement('td');
      viewsTd.className = 'col-stats';
      viewsTd.textContent = row.views ?? 0;

      tr.appendChild(iconTd);
      tr.appendChild(mainTd);
      tr.appendChild(priceTd);
      tr.appendChild(repliesTd);
      tr.appendChild(viewsTd);

      threadListEl.appendChild(tr);
    });
  } catch (err) {
    console.error('loadMarketplaceThreads error', err);
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="5">Network error loading marketplace threads.</td>
      </tr>`;
  }
}

if (sortSelectEl) {
  sortSelectEl.addEventListener('change', loadMarketplaceThreads);
}

loadMarketplaceThreads();
