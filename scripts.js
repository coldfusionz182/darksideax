// scripts.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NjU4OTUsImV4cCI6MjA5MTI0MTg5NX0.6Ogv0QubiShMDK1uDTN-QKFkmmE6Fv3Iu4WzBSSIT7M';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function updateHeaderAuthState() {
  const authLinks = document.querySelector('.auth-links');
  if (!authLinks) return;

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData?.user) {
    window.dsUserRole = 'guest';
    return;
  }

  const user = userData.user;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('username, role')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.username || user.email;
  const role = profile?.role || 'user';

  window.dsUserRole = role;

  // make name clickable → profile.html
  authLinks.innerHTML = `
    <button class="user-pill" id="header-profile-link">
      <i class="fa fa-user-circle"></i>
      <span>${displayName}</span>
    </button>
    <button class="btn btn-small btn-outline" id="logout-btn">
      <i class="fa fa-sign-out-alt"></i> Logout
    </button>
  `;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      localStorage.removeItem('ds_access_token');
      window.location.reload();
    });
  }

  const profileLinkBtn = document.getElementById('header-profile-link');
  if (profileLinkBtn) {
    profileLinkBtn.addEventListener('click', () => {
      window.location.href = 'profile.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // --- header auth state ---
  updateHeaderAuthState();

  // --- Shoutbox (index + section pages) ---
  const input = document.getElementById('shout-input');
  const sendBtn = document.getElementById('shout-send');
  const box = document.getElementById('shoutbox-messages');

  if (input && sendBtn && box) {
    function addShout(text) {
      const line = document.createElement('div');
      line.className = 'shout-line';

      const user = document.createElement('span');
      user.className = 'shout-user rank-member';
      user.textContent = 'You';

      const time = document.createElement('span');
      time.className = 'shout-time';
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      time.textContent = `${hh}:${mm}`;

      const msg = document.createElement('span');
      msg.className = 'shout-text';
      msg.textContent = text;

      line.appendChild(user);
      line.appendChild(time);
      line.appendChild(msg);
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    }

    sendBtn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      addShout(text);
      input.value = '';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

  // --- Accounts thread list (accounts.html) ---
  const threadListBody = document.getElementById('thread-list');
  const sortSelect = document.getElementById('sort-select');
  let threadsData = [];

  function formatDateShort(iso) {
    const d = new Date(iso);
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${dd}/${mm} ${hh}:${min}`;
  }

  function renderThreads(list) {
    if (!threadListBody) return;
    threadListBody.innerHTML = '';
    list.forEach((t) => {
      const tr = document.createElement('tr');
      tr.className = 'forum-row';

      const tdIcon = document.createElement('td');
      tdIcon.className = 'col-icon';
      tdIcon.innerHTML = `<div class="forum-icon"><i class="fa fa-bookmark"></i></div>`;

      const tdMain = document.createElement('td');
      tdMain.className = 'col-thread-main';
      const titleDiv = document.createElement('div');
      titleDiv.className = 'thread-title';
      titleDiv.innerHTML = `<span class="thread-tag">${t.tag}</span><a href="thread.html?id=${t.id}">${t.title}</a>`;
      const metaDiv = document.createElement('div');
      metaDiv.className = 'thread-meta';
      const created = t.created_at || t.createdAt;
      metaDiv.textContent = `Started by ${t.author} • ${formatDateShort(created)}`;
      tdMain.appendChild(titleDiv);
      tdMain.appendChild(metaDiv);

      const tdReplies = document.createElement('td');
      tdReplies.className = 'col-stats';
      tdReplies.innerHTML = `<span class="stats-count">${t.replies || 0}</span><br><span class="stats-desc">Replies</span>`;

      const tdViews = document.createElement('td');
      tdViews.className = 'col-stats';
      tdViews.innerHTML = `<span class="stats-count">${t.views || 0}</span><br><span class="stats-desc">Views</span>`;

      const tdLast = document.createElement('td');
      tdLast.className = 'col-last';
      const lastUser = t.last_post_user || t.lastPostUser || t.author;
      const lastTime = t.last_post_time || t.lastPostTime || created;
      tdLast.innerHTML = `
        <div class="last-title"><a href="thread.html?id=${t.id}">${t.title}</a></div>
        <div class="last-meta">by <a href="#">${lastUser}</a> · ${formatDateShort(lastTime)}</div>
      `;

      tr.appendChild(tdIcon);
      tr.appendChild(tdMain);
      tr.appendChild(tdReplies);
      tr.appendChild(tdViews);
      tr.appendChild(tdLast);

      // Admin-only delete button
      if (window.dsUserRole === 'admin') {
        const tdDelete = document.createElement('td');
        tdDelete.className = 'col-actions';
        tdDelete.innerHTML = `
          <button class="btn btn-small btn-outline delete-thread">
            <i class="fa fa-trash"></i>
          </button>
        `;
        tr.appendChild(tdDelete);

        const btn = tdDelete.querySelector('.delete-thread');
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this thread?')) return;

          const { data: sessionData } = await supabaseClient.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (!token) {
            alert('Not logged in.');
            return;
          }

          try {
            const res = await fetch('/.netlify/functions/delete-thread', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ id: t.id })
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
              throw new Error(json.error || 'Delete failed');
            }

            threadsData = threadsData.filter((th) => th.id !== t.id);
            sortThreads(sortSelect ? sortSelect.value : 'newest');
          } catch (err) {
            console.error('delete-thread error', err);
            alert('Failed to delete thread.');
          }
        });
      }

      threadListBody.appendChild(tr);
    });
  }

  function sortThreads(mode) {
    if (!threadsData.length) return;
    const sorted = [...threadsData];
    if (mode === 'newest') {
      sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (mode === 'oldest') {
      sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (mode === 'replies') {
      sorted.sort((a, b) => (b.replies || 0) - (a.replies || 0));
    }
    renderThreads(sorted);
  }

  async function loadThreads() {
    if (!threadListBody) return;
    try {
      const res = await fetch('/.netlify/functions/list-threads');
      if (!res.ok) throw new Error('Failed to load threads');
      threadsData = await res.json();
      sortThreads(sortSelect ? sortSelect.value : 'newest');
    } catch (e) {
      console.error('loadThreads error:', e);
    }
  }

  if (threadListBody) {
    if (sortSelect) {
      sortSelect.addEventListener('change', () => sortThreads(sortSelect.value));
    }
    loadThreads();
  }

  // --- New thread form (new-thread.html, login required) ---
  const newThreadForm = document.getElementById('new-thread-form');
  let currentUser = null;

  async function getCurrentUser() {
    const { data, error } = await supabaseClient.auth.getUser();
    if (!error && data?.user) currentUser = data.user;
  }

  if (newThreadForm) {
    const titleEl = document.getElementById('thread-title');
    const tagEl = document.getElementById('thread-tag');
    const authorEl = document.getElementById('thread-author');
    const contentEl = document.getElementById('thread-content');
    const statusEl = document.getElementById('thread-status');
    const submitBtn = document.getElementById('thread-submit');

    getCurrentUser().then(async () => {
      if (currentUser) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('username')
          .eq('id', currentUser.id)
          .maybeSingle();

        authorEl.value = profile?.username || currentUser.email;
      } else {
        statusEl.textContent = 'You must be logged in to post a thread.';
        submitBtn.disabled = true;
      }
    });

    newThreadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentUser) {
        statusEl.textContent = 'You must be logged in to post a thread.';
        return;
      }

      if (
        !titleEl.value.trim() ||
        !tagEl.value ||
        !authorEl.value.trim() ||
        !contentEl.value.trim()
      ) {
        statusEl.textContent = 'Please fill in all fields.';
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = 'Creating thread...';

      try {
        const res = await fetch('/.netlify/functions/create-thread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleEl.value.trim(),
            tag: tagEl.value,
            author: authorEl.value.trim(),
            content: contentEl.value.trim()
          })
        });

        if (!res.ok) throw new Error('Request failed');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Unknown error');

        statusEl.textContent = 'Thread created! Redirecting...';
        setTimeout(() => {
          window.location.href = 'accounts.html';
        }, 800);
      } catch (err) {
        console.error('create-thread error', err);
        statusEl.textContent = 'Error creating thread. Check backend.';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // --- Single thread view (thread.html) with likes + replies ---
  const threadTitleDisplay = document.getElementById('thread-title-display');
  const threadMetaDisplay = document.getElementById('thread-meta-display');
  const threadContentDisplay = document.getElementById('thread-content-display');
  const threadAuthorName = document.getElementById('thread-author-name');
  const threadCreatedAt = document.getElementById('thread-created-at');
  const threadTagPill = document.getElementById('thread-tag-pill');
  const threadTagText = document.getElementById('thread-tag-text');
  const likeBtn = document.getElementById('thread-like-btn');
  const likeText = document.getElementById('thread-like-text');
  const likeCountEl = document.getElementById('thread-like-count');
  const replyForm = document.getElementById('reply-form');
  const replyText = document.getElementById('reply-text');
  const replyStatus = document.getElementById('reply-status');
  const replySubmit = document.getElementById('reply-submit');
  const replyInfoText = document.getElementById('reply-info-text');
  const repliesList = document.getElementById('replies-list');
  const repliesPlaceholder = document.getElementById('replies-placeholder');

  if (threadTitleDisplay && threadContentDisplay) {
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get('id');

    if (!threadId) {
      threadTitleDisplay.textContent = 'Thread not found';
      threadContentDisplay.textContent = 'Missing thread id in URL.';
      return;
    }

    (async () => {
      try {
        // load thread
        const res = await fetch(
          `/.netlify/functions/get-thread?id=${encodeURIComponent(threadId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load thread');
        }

        const t = data.thread;
        threadTitleDisplay.textContent = t.title;
        threadMetaDisplay.textContent = `[${t.tag}] Started by ${t.author} • ${formatDateShort(
          t.created_at
        )}`;
        threadAuthorName.textContent = t.author;
        threadCreatedAt.textContent = `Posted ${formatDateShort(t.created_at)}`;
        threadContentDisplay.textContent = t.content;

        if (t.tag) {
          threadTagText.textContent = t.tag;
          threadTagPill.style.display = 'inline-flex';
        }

        // check login
        const { data: userData } = await supabaseClient.auth.getUser();
        const user = userData?.user || null;
        if (!user) {
          replyInfoText.textContent = 'Login to like or reply.';
          replyText.disabled = true;
          replySubmit.disabled = true;
          likeBtn.disabled = true;
          likeBtn.classList.add('disabled');
        } else {
          replyInfoText.textContent = 'Reply as ' + (user.email || 'member');
        }

        // load likes for this thread + this user
        let liked = false;
        let likeCount = 0;

        {
          const { data: likes } = await supabaseClient
            .from('thread_likes')
            .select('user_id')
            .eq('thread_id', threadId);

          likeCount = likes ? likes.length : 0;
          likeCountEl.textContent = `${likeCount} likes`;

          if (user) {
            liked = !!likes?.find((row) => row.user_id === user.id);
            if (liked) {
              likeBtn.classList.add('liked');
              likeText.textContent = 'Liked';
            }
          }
        }

        // like toggle
        if (user) {
          likeBtn.addEventListener('click', async () => {
            likeBtn.disabled = true;
            try {
              if (!liked) {
                const { error } = await supabaseClient.from('thread_likes').insert({
                  thread_id: threadId,
                  user_id: user.id
                });
                if (error) throw error;
                liked = true;
                likeBtn.classList.add('liked');
                likeText.textContent = 'Liked';
                likeCount += 1;
              } else {
                const { error } = await supabaseClient
                  .from('thread_likes')
                  .delete()
                  .eq('thread_id', threadId)
                  .eq('user_id', user.id);
                if (error) throw error;
                liked = false;
                likeBtn.classList.remove('liked');
                likeText.textContent = 'Like';
                likeCount = Math.max(0, likeCount - 1);
              }
              likeCountEl.textContent = `${likeCount} likes`;
            } catch (err) {
              console.error('like error', err);
              alert('Failed to update like.');
            } finally {
              likeBtn.disabled = false;
            }
          });
        }

        // load replies
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
          if (!replies || replies.length === 0) {
            const div = document.createElement('div');
            div.className = 'reply-item';
            div.innerHTML =
              '<div class="reply-meta">No replies yet. Be the first to drop one.</div>';
            repliesList.appendChild(div);
            return;
          }

          replies.forEach((r) => {
            const div = document.createElement('div');
            div.className = 'reply-item';

            const canDelete = window.dsUserRole === 'admin';

            div.innerHTML = `
              <div class="reply-meta">
                <strong>${r.author}</strong> • ${formatDateShort(r.created_at)}
                ${canDelete ? '<button class="btn btn-small btn-outline reply-delete-btn" style="float:right;"><i class="fa fa-trash"></i></button>' : ''}
              </div>
              <div class="reply-body">${r.content}</div>
            `;

            if (canDelete) {
              const btn = div.querySelector('.reply-delete-btn');
              btn.addEventListener('click', async () => {
                if (!confirm('Delete this reply?')) return;

                const { data: sessionData } = await supabaseClient.auth.getSession();
                const token = sessionData?.session?.access_token;
                if (!token) {
                  alert('Not logged in.');
                  return;
                }

                try {
                  const res = await fetch('/.netlify/functions/delete-reply', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ id: r.id })
                  });
                  const json = await res.json();
                  if (!res.ok || !json.success) {
                    throw new Error(json.error || 'Delete failed');
                  }

                  await loadReplies();
                } catch (err) {
                  console.error('delete-reply error', err);
                  alert('Failed to delete reply.');
                }
              });
            }

            repliesList.appendChild(div);
          });
        }

        await loadReplies();

        // reply submit
        replyForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          replyStatus.textContent = '';

          const { data: userData2 } = await supabaseClient.auth.getUser();
          const user2 = userData2?.user || null;
          if (!user2) {
            replyStatus.textContent = 'You must be logged in to reply.';
            return;
          }

          const text = replyText.value.trim();
          if (!text) {
            replyStatus.textContent = 'Type a reply first.';
            return;
          }

          replySubmit.disabled = true;
          replyStatus.textContent = 'Posting reply...';

          try {
            const displayAuthor = user2.email;
            const { error } = await supabaseClient.from('thread_replies').insert({
              thread_id: threadId,
              author: displayAuthor,
              content: text
            });
            if (error) throw error;

            replyText.value = '';
            replyStatus.textContent = 'Reply posted.';
            await loadReplies();
          } catch (err) {
            console.error('reply error', err);
            replyStatus.textContent = 'Failed to post reply.';
          } finally {
            replySubmit.disabled = false;
          }
        });

        if (repliesPlaceholder) {
          repliesPlaceholder.remove();
        }
      } catch (err) {
        console.error('load single thread error', err);
        threadTitleDisplay.textContent = 'Error loading thread';
        threadContentDisplay.textContent = 'Could not load this thread.';
      }
    })();
  }

  // --- PROFILE PAGE (profile.html) ---
  const profileUsernameEl = document.getElementById('profile-username');
  const profileRoleTextEl = document.getElementById('profile-role-text');
  const profileRolePill = document.getElementById('profile-role-pill');
  const profileEmailEl = document.getElementById('profile-email');
  const profileJoinedEl = document.getElementById('profile-joined');
  const statThreadsEl = document.getElementById('stat-threads');
  const statRepliesEl = document.getElementById('stat-replies');
  const statLikesEl = document.getElementById('stat-likes');
  const profileThreadsList = document.getElementById('profile-threads-list');
  const profileRepliesList = document.getElementById('profile-replies-list');
  const profileLikesList = document.getElementById('profile-likes-list');
  const profileThreadsEmpty = document.getElementById('profile-threads-empty');
  const profileRepliesEmpty = document.getElementById('profile-replies-empty');
  const profileLikesEmpty = document.getElementById('profile-likes-empty');

  if (profileUsernameEl && profileRoleTextEl) {
    (async () => {
      const { data: userData, error } = await supabaseClient.auth.getUser();
      if (error || !userData?.user) {
        profileUsernameEl.textContent = 'Not logged in';
        if (profileRolePill) profileRolePill.style.display = 'none';
        return;
      }

      const user = userData.user;

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('username, role, created_at')
        .eq('id', user.id)
        .maybeSingle();

      const uname = profile?.username || user.email;
      const role = profile?.role || 'user';

      profileUsernameEl.textContent = uname;
      profileEmailEl.textContent = user.email;
      profileRoleTextEl.textContent = role === 'admin' ? 'Administrator' : 'Member';
      if (profile?.created_at) {
        profileJoinedEl.textContent = formatDateShort(profile.created_at);
      }

      // stats
      const [{ data: threads }, { data: replies }, { data: likes }] = await Promise.all([
        supabaseClient
          .from('threads')
          .select('id, title, tag, created_at')
          .eq('author', uname)
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('thread_replies')
          .select('id, thread_id, content, created_at')
          .eq('author', user.email)
          .order('created_at', { ascending: false }),
        supabaseClient
          .from('thread_likes')
          .select('id, thread_id, created_at')
          .eq('user_id', user.id)
      ]);

      statThreadsEl.textContent = threads ? threads.length : 0;
      statRepliesEl.textContent = replies ? replies.length : 0;
      statLikesEl.textContent = likes ? likes.length : 0;

      // threads list
      profileThreadsList.innerHTML = '';
      if (!threads || threads.length === 0) {
        const li = document.createElement('li');
        li.className = 'meta';
        li.textContent = 'You have not created any threads yet.';
        profileThreadsList.appendChild(li);
      } else {
        threads.slice(0, 5).forEach((t) => {
          const li = document.createElement('li');
          li.innerHTML = `
            <a href="thread.html?id=${t.id}">
              <span class="badge-pill">${t.tag}</span>${t.title}
            </a>
            <div class="meta">Posted ${formatDateShort(t.created_at)}</div>
          `;
          profileThreadsList.appendChild(li);
        });
      }

      // replies list
      profileRepliesList.innerHTML = '';
      if (!replies || replies.length === 0) {
        const li = document.createElement('li');
        li.className = 'meta';
        li.textContent = 'You have not replied to any threads yet.';
        profileRepliesList.appendChild(li);
      } else {
        replies.slice(0, 5).forEach((r) => {
          const li = document.createElement('li');
          li.innerHTML = `
            <a href="thread.html?id=${r.thread_id}">
              Reply on thread #${r.thread_id}
            </a>
            <div class="meta">${formatDateShort(r.created_at)}</div>
          `;
          profileRepliesList.appendChild(li);
        });
      }

      // likes list
      profileLikesList.innerHTML = '';
      if (!likes || likes.length === 0) {
        const li = document.createElement('li');
        li.className = 'meta';
        li.textContent = 'You have not liked any threads yet.';
        profileLikesList.appendChild(li);
      } else {
        likes.slice(0, 5).forEach((lk) => {
          const li = document.createElement('li');
          li.innerHTML = `
            <a href="thread.html?id=${lk.thread_id}">
              Liked thread #${lk.thread_id}
            </a>
            <div class="meta">${formatDateShort(lk.created_at)}</div>
          `;
          profileLikesList.appendChild(li);
        });
      }
    })();
  }
});