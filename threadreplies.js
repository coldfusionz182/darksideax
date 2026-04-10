// threadreplies.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// re‑use same helper shape as scripts.js
async function getCurrentUserWithRole() {
  const { data: userData, error } = await supabaseClient.auth.getUser();
  if (error || !userData?.user) return null;

  const user = userData.user;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const { data: userRow } = await supabaseClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    username: profile?.username || user.email,
    role: userRow?.role || 'user',
  };
}

function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

async function initThreadReplies() {
  const replyForm = document.getElementById('reply-form');
  const replyText = document.getElementById('reply-text');
  const replyStatus = document.getElementById('reply-status');
  const replyInfoText = document.getElementById('reply-info-text');
  const repliesList = document.getElementById('replies-list');
  const repliesPlaceholder = document.getElementById('replies-placeholder');

  if (!replyForm || !replyText || !repliesList) return;

  const params = new URLSearchParams(window.location.search);
  const threadId = params.get('id');
  if (!threadId) {
    replyInfoText.textContent = 'Missing thread id.';
    replyText.disabled = true;
    return;
  }

  // get current user
  const current = await getCurrentUserWithRole();
  if (!current) {
    replyInfoText.textContent = 'Login to like or reply.';
    replyText.disabled = true;
    return;
  }

  replyInfoText.textContent = `Reply as ${current.username}`;

  // change header DS role so delete buttons in scripts.js still work if needed
  window.dsUserRole = current.role;

  async function loadReplies() {
    const { data: replies, error } = await supabaseClient
      .from('thread_replies')
      .select('id, author, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('load replies error', error);
      return;
    }

    repliesList.innerHTML = '';

    if (!replies || !replies.length) {
      const div = document.createElement('div');
      div.className = 'reply-item';
      div.innerHTML = `<div class="reply-meta">No replies yet. Be the first to drop one.</div>`;
      repliesList.appendChild(div);
      return;
    }

    replies.forEach(r => {
      const div = document.createElement('div');
      div.className = 'reply-item';

      const meta = document.createElement('div');
      meta.className = 'reply-meta';
      meta.textContent = `${r.author} • ${formatDateShort(r.created_at)}`;

      const body = document.createElement('div');
      body.className = 'reply-body';
      body.textContent = r.content;

      div.appendChild(meta);
      div.appendChild(body);

      repliesList.appendChild(div);
    });
  }

  await loadReplies();

  replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    replyStatus.textContent = '';

    const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
    const user = userData?.user || null;
    if (userErr || !user) {
      replyStatus.textContent = 'You must be logged in to reply.';
      return;
    }

    const text = replyText.value.trim();
    if (!text) {
      replyStatus.textContent = 'Type a reply first.';
      return;
    }

    replyStatus.textContent = 'Posting reply...';
    replyForm.querySelector('#reply-submit').disabled = true;

    try {
      const displayAuthor = current.username || user.email;

      const { error } = await supabaseClient
        .from('thread_replies')
        .insert({
          thread_id: threadId,
          author: displayAuthor,
          author_username: displayAuthor,
          content: text,
        });

      if (error) throw error;

      replyText.value = '';
      replyStatus.textContent = 'Reply posted.';
      if (repliesPlaceholder) repliesPlaceholder.remove();
      await loadReplies();
    } catch (err) {
      console.error('reply error', err);
      replyStatus.textContent = 'Failed to post reply.';
    } finally {
      replyForm.querySelector('#reply-submit').disabled = false;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThreadReplies);
} else {
  initThreadReplies();
}