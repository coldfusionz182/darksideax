// get-threads.js
// Shared thread list loader for Accounts + Configs pages

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseAnonKey = 'YOUR_PUBLIC_ANON_KEY_HERE'; // replace with your anon/public key
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ===================== THREAD LIST (accounts.html + configs.html) =====================

// expects in HTML:
// <tbody id="thread-list" data-section="accounts"></tbody>
// or
// <tbody id="thread-list" data-section="configs"></tbody>

const threadListEl = document.getElementById('thread-list');
const sortSelectEl = document.getElementById('sort-select');

async function loadThreads() {
  if (!threadListEl) return;

  const section = threadListEl.dataset.section || 'accounts'; // default
  const sort = sortSelectEl?.value || 'newest';

  let query = supabaseClient
    .from('threads')
    .select('id, title, tag, author, created_at, replies, views')
    .eq('section', section);

  if (sort === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else if (sort === 'replies') {
    query = query.order('replies', { ascending: false });
  } else {
    // newest
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error('loadThreads error', error);
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">Failed to load threads.</td>
      </tr>`;
    return;
  }

  if (!data || data.length === 0) {
    threadListEl.innerHTML = `
      <tr class="thread-row">
        <td colspan="4">No threads yet. Be the first to post!</td>
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
        <i class="fa fa-${section === 'configs' ? 'sliders-h' : 'user-tag'}"></i>
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

// hook sort select
if (sortSelectEl) {
  sortSelectEl.addEventListener('change', () => {
    loadThreads();
  });
}

// initial load
loadThreads();