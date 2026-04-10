import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// global current user for other scripts (threadcreation.js, thread page etc.)
window.currentUser = null;
window.supabaseClient = supabaseClient;


async function getCurrentUserWithRole() {
  const { data: userData, error } = await supabaseClient.auth.getUser();
  if (error || !userData?.user) return null;

  const user = userData.user;

  const [{ data: profile }, { data: userRow }] = await Promise.all([
    supabaseClient
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle(),
    supabaseClient
      .from('users')
      .select('role, avatar_url')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const userInfo = {
    id: user.id,
    email: user.email,
    username: profile?.username || user.email,
    role: userRow?.role || 'user',
    avatar_url: userRow?.avatar_url || null,
  };

  window.currentUser = userInfo;
  return userInfo;
}

// make it available to other scripts (like softwareauth.js)
window.getCurrentUserWithRole = getCurrentUserWithRole;

// --- header auth state ---
async function updateHeaderAuthState() {
  const authLinks = document.querySelector('.auth-links');
  if (!authLinks) return;

  const current = await getCurrentUserWithRole();
  if (!current) {
    window.dsUserRole = 'guest';
    return;
  }

  window.dsUserRole = current.role;

  // text-only user pill, no avatar image
  authLinks.innerHTML = `
    <button class="user-pill" id="header-profile-link">
      <span class="user-pill-name">${current.username}</span>
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
  updateHeaderAuthState();

  // --- show Admin Panel navbar link for admin/owner ---
  async function showAdminNavIfAllowed() {
    const navAdmin = document.getElementById('nav-admin-link');
    if (!navAdmin) return;

    const current = await getCurrentUserWithRole();
    if (!current) return;

    if (current.role === 'admin' || current.role === 'owner') {
      navAdmin.style.display = 'inline-block';
    }
  }
  showAdminNavIfAllowed();

  // ===================== SHOUTBOX (index.html) =====================
const shoutInput = document.getElementById('shout-input');
const shoutSendBtn = document.getElementById('shout-send');
const shoutBox = document.getElementById('shoutbox-messages');
const shoutForm = document.getElementById('shoutbox-form');
const shoutMeta = document.getElementById('shoutbox-meta');
const shoutFooter = document.getElementById('shoutbox-footer');

// track latest shout timestamp we know about
let lastShoutTimestamp = null;

async function fetchCurrentUserProfile() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) return null;

  const user = data.user;
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    username: profile?.username || user.email,
  };
}

// include role for shout permissions
async function fetchCurrentUserProfileWithRole() {
  const base = await fetchCurrentUserProfile();
  if (!base) return null;
  const { data: userRow } = await supabaseClient
    .from('users')
    .select('role')
    .eq('id', base.id)
    .maybeSingle();
  return { ...base, role: userRow?.role || 'user' };
}

function createShoutContextMenu() {
  let menu = document.getElementById('shout-context-menu');
  if (menu) return menu;

  menu = document.createElement('div');
  menu.id = 'shout-context-menu';
  menu.className = 'shout-context-menu';
  menu.style.position = 'absolute';
  menu.style.zIndex = '9999';
  menu.style.display = 'none';
  menu.innerHTML = `<div class="shout-context-item">Delete message</div>`;
  document.body.appendChild(menu);

  document.addEventListener('click', () => {
    menu.style.display = 'none';
  });

  return menu;
}

// adjust this if you want admins blocked from specific owner ID
const OWNER_ID = 'PUT_OWNER_USER_ID_HERE';

function canCurrentUserDeleteShout(currentUser, row) {
  if (!currentUser) return false;

  // owner can delete any shout
  if (currentUser.role === 'owner') return true;

  if (currentUser.role === 'admin') {
    if (row.user_id === OWNER_ID) return false;
    return true;
  }

  // normal users: only their own shouts
  return row.user_id === currentUser.id;
}

async function renderShout(row, currentUser) {
  const line = document.createElement('div');
  line.className = 'shout-line';

  // text container (username, time, message) – NO avatar
  const textContainer = document.createElement('div');

  const userSpan = document.createElement('span');
  userSpan.className = 'shout-user rank-member';

  const userLink = document.createElement('a');
  userLink.className = 'profile-username-link';
  // if profiles are gone, just don't set href
  // userLink.href = 'profile.html?u=' + encodeURIComponent(row.username);
  userLink.textContent = row.username;
  userSpan.appendChild(userLink);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'shout-time';
  const d = new Date(row.created_at);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  timeSpan.textContent = `${hh}:${mm}`;

  const textSpan = document.createElement('span');
  textSpan.className = 'shout-text';
  textSpan.textContent = row.message;

  textContainer.appendChild(userSpan);
  textContainer.appendChild(timeSpan);
  textContainer.appendChild(textSpan);

  line.appendChild(textContainer);
  shoutBox.appendChild(line);

  // delete‑permissions + context menu stay the same
  const canDelete = canCurrentUserDeleteShout(currentUser, row);
  if (!canDelete) return;

  const menu = createShoutContextMenu();
  const menuItem = menu.querySelector('.shout-context-item');

  userSpan.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu.style.display = 'block';
    const rect = userSpan.getBoundingClientRect();
    menu.style.left = `${rect.right + 6}px`;
    menu.style.top = `${rect.top}px`;

    const handler = async () => {
      menu.style.display = 'none';
      menuItem.removeEventListener('click', handler);

      try {
        const { error } = await supabaseClient
          .from('shouts')
          .delete()
          .eq('id', row.id);
        if (error) throw error;
        line.remove();
      } catch (err) {
        console.error('delete shout error', err);
        alert('Failed to delete shout.');
      }
    };

    menuItem.addEventListener('click', handler);
  });
}

// load last 50 and update lastShoutTimestamp
async function loadShouts(currentUser) {
  if (!shoutBox) return;

  const { data, error } = await supabaseClient
    .from('shouts')
    .select('id, user_id, username, message, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('loadShouts error', error);
    return;
  }

  shoutBox.innerHTML = '';
  data.slice().reverse().forEach((row) => renderShout(row, currentUser));
  shoutBox.scrollTop = shoutBox.scrollHeight;

  if (data && data.length > 0) {
    // newest row first because of descending order
    lastShoutTimestamp = data[0].created_at;
  }
}

// cheap check: has anything newer than lastShoutTimestamp?
async function hasNewShouts() {
  if (!lastShoutTimestamp) return true; // force first load

  const { data, error } = await supabaseClient
    .from('shouts')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('hasNewShouts error', error);
    return false;
  }

  if (!data || data.length === 0) return false;

  const latest = data[0].created_at;
  return new Date(latest) > new Date(lastShoutTimestamp);
}

async function setupShoutbox() {
  if (!shoutInput || !shoutSendBtn || !shoutBox || !shoutForm) return;

  const me = await fetchCurrentUserProfileWithRole();
  if (!me) {
    shoutInput.disabled = true;
    shoutSendBtn.disabled = true;
    if (shoutFooter) shoutFooter.textContent = 'Login to chat in the shoutbox.';
  } else if (shoutMeta) {
    shoutMeta.textContent = `Logged in as ${me.username} · live chat`;
  }

  // initial load
  await loadShouts(me);

  // poll every 10 seconds, only reload if new shouts exist
  setInterval(async () => {
    try {
      const changed = await hasNewShouts();
      if (changed) {
        await loadShouts(me);
      }
    } catch (e) {
      console.error('shoutbox poll error', e);
    }
  }, 10000); // 10 seconds

  // if you want JUST polling, you can remove this realtime block entirely
  // supabaseClient
  //   .channel('public:shouts')
  //   .on(
  //     'postgres_changes',
  //     { event: 'INSERT', schema: 'public', table: 'shouts' },
  //     (payload) => {
  //       renderShout(payload.new, me);
  //       shoutBox.scrollTop = shoutBox.scrollHeight;
  //     },
  //   )
  //   .subscribe();

  shoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const meNow = await fetchCurrentUserProfileWithRole();
    if (!meNow) return;

    const text = shoutInput.value.trim();
    if (!text) return;
    if (text.length > 180) return;

    const msg = text;
    shoutInput.value = '';

    try {
      const { error } = await supabaseClient.from('shouts').insert({
        user_id: meNow.id,
        username: meNow.username,
        message: msg,
      });
      if (error) throw error;
    } catch (err) {
      console.error('send shout error', err);
    }
  });
}

  async function loadAdmins() {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, email, role')
      .in('role', ['admin', 'owner']);
    if (error) {
      console.error('loadAdmins error', error);
      return [];
    }
    return data || [];
  }

  async function initAdminPanel() {
    const current = await getCurrentUserWithRole();
    const panel = document.getElementById('admin-panel');
    const list = document.getElementById('admin-list');
    const actions = document.getElementById('admin-actions');

    if (!panel || !list || !actions) return;

    if (!current || !['admin', 'owner'].includes(current.role)) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'block';

    const admins = await loadAdmins();
    list.innerHTML = admins
      .map(
        (a) => `
      <div class="admin-row">
        <span>${a.email || a.id}</span>
        <span class="badge badge-${a.role}">${a.role}</span>
      </div>
    `,
      )
      .join('');

    if (current.role === 'owner') {
      actions.innerHTML = `
        <button id="add-admin" class="btn btn-small btn-primary">Add admin</button>
        <button id="remove-admin" class="btn btn-small btn-outline">Remove admin</button>
      `;
      document.getElementById('add-admin').onclick = () =>
        alert('Add admin not implemented yet');
      document.getElementById('remove-admin').onclick = () =>
        alert('Remove admin not implemented yet');
    } else {
      actions.innerHTML = `<p>You can view admins but only the Owner can change them.</p>`;
    }
  }

  initAdminPanel();

  async function loadShouts(currentUser) {
    if (!shoutBox) return;

    const { data, error } = await supabaseClient
      .from('shouts')
      .select('id, user_id, username, message, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('loadShouts error', error);
      return;
    }

    shoutBox.innerHTML = '';
    data.slice().reverse().forEach((row) => renderShout(row, currentUser));
    shoutBox.scrollTop = shoutBox.scrollHeight;
  }

  async function setupShoutbox() {
    if (!shoutInput || !shoutSendBtn || !shoutBox || !shoutForm) return;

    const me = await fetchCurrentUserProfileWithRole();
    if (!me) {
      shoutInput.disabled = true;
      shoutSendBtn.disabled = true;
      if (shoutFooter) shoutFooter.textContent = 'Login to chat in the shoutbox.';
    } else if (shoutMeta) {
      shoutMeta.textContent = `Logged in as ${me.username} · live chat`;
    }

    await loadShouts(me);

    setInterval(() => {
      loadShouts(me);
    }, 20000); // 1 second

    supabaseClient
      .channel('public:shouts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shouts' },
        (payload) => {
          renderShout(payload.new, me);
          shoutBox.scrollTop = shoutBox.scrollHeight;
        },
      )
      .subscribe();

    shoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const meNow = await fetchCurrentUserProfileWithRole();
      if (!meNow) return;

      const text = shoutInput.value.trim();
      if (!text) return;
      if (text.length > 180) return;

      const msg = text;
      shoutInput.value = '';

      try {
        const { error } = await supabaseClient.from('shouts').insert({
          user_id: meNow.id,
          username: meNow.username,
          message: msg,
        });
        if (error) throw error;
      } catch (err) {
        console.error('send shout error', err);
      }
    });
  }

  setupShoutbox();

  // ===================== Accounts thread list (accounts.html) =====================
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
            const res = await fetch('/api/delete-thread', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ id: t.id }),
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
      const res = await fetch('/api/list-threads');
      if (!res.ok) throw new Error('Failed to load threads');
      threadsData = await res.json();
      sortThreads(sortSelect ? sortSelect.value : 'newest');
    } catch (e) {
      console.error('loadThreads error', e);
    }
  }

  if (threadListBody) {
    if (sortSelect) {
      sortSelect.addEventListener('change', () => sortThreads(sortSelect.value));
    }
    loadThreads();
  }

  // ===================== helper: render [HIDDEN] blocks =====================
  function renderHiddenContent(rawContent, canSeeHidden) {
    if (!rawContent) return '';

    if (canSeeHidden) {
      return rawContent.replace(/\[HIDDEN\](.*?)\[\/HIDDEN\]/gis, '$1');
    }

    return rawContent.replace(
      /\[HIDDEN\](.*?)\[\/HIDDEN\]/gis,
      '[Hidden content – login and reply to this thread to view]'
    );
  }

  // BBCode -> HTML: url + color
  function bbcodeToHtml(text) {
    if (!text) return '';

    let out = text;

    // [url=...]link[/url]
    out = out.replace(
      /\[url=(https?:\/\/[^\]]+)\](.*?)\[\/url\]/gis,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>'
    );

    // [color=#hex]text[/color]
    out = out.replace(
      /\[color=([#a-zA-Z0-9]+)\](.*?)\[\/color\]/gis,
      '<span style="color:$1;">$2</span>'
    );

    return out;
  }

  // ===================== Single thread view (thread.html) =====================
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
        const res = await fetch(`/api/get-thread?id=${encodeURIComponent(threadId)}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load thread');
        }

        const t = data.thread;

        // let avatars.js hook into this
        window.dispatchEvent(new CustomEvent('ds-thread-loaded', { detail: { thread: t } }));

        threadTitleDisplay.textContent = t.title;
        threadMetaDisplay.textContent = `[${t.tag}] Started by ${t.author} • ${formatDateShort(
          t.created_at,
        )}`;
        threadAuthorName.textContent = t.author;
        threadCreatedAt.textContent = `Posted ${formatDateShort(t.created_at)}`;

        if (t.tag) {
          threadTagText.textContent = t.tag;
          threadTagPill.style.display = 'inline-flex';
        }

        // decide if this visitor can see hidden content
        const currentWithRole = await getCurrentUserWithRole().catch(() => null);
        const user = currentWithRole;

        let canSeeHidden = false;
        if (user && (user.role === 'admin' || user.role === 'owner')) {
          canSeeHidden = true;
        }

        const renderedContent = renderHiddenContent(t.content, canSeeHidden);
        const htmlContent = bbcodeToHtml(renderedContent);
        threadContentDisplay.innerHTML = htmlContent;

        // likes + replies logic
const { data: userData } = await supabaseClient.auth.getUser();
const rawUser = userData?.user || null;

if (!rawUser) {
  replyInfoText.textContent = 'Login to like or reply.';
  replyText.disabled = true;
  replySubmit.disabled = true;
  likeBtn.disabled = true;
  likeBtn.classList.add('disabled');
} else {
  replyInfoText.textContent = `Reply as ${rawUser.email} · member`;

  let liked = false;
  let likeCount = 0;

  const { data: likes } = await supabaseClient
    .from('thread_likes')
    .select('user_id')
    .eq('thread_id', threadId);

  likeCount = likes ? likes.length : 0;
  likeCountEl.textContent = likeCount;

  if (rawUser) {
    liked = !!likes?.find(row => row.user_id === rawUser.id);
    if (liked) {
      likeBtn.classList.add('liked');
      likeText.textContent = 'Liked';
    }
  }

  if (rawUser) {
    likeBtn.addEventListener('click', async () => {
      likeBtn.disabled = true;
      try {
        if (!liked) {
          // get username for this liker
          let likerUsername = rawUser.email;
          try {
            if (window.getCurrentUserWithRole) {
              const current = await window.getCurrentUserWithRole();
              if (current?.username) likerUsername = current.username;
            }
          } catch (e) {
            console.warn('could not get username for like, falling back to email', e);
          }

          const { error } = await supabaseClient
            .from('thread_likes')
            .insert({
              thread_id: threadId,
              user_id: rawUser.id,
              username: likerUsername, // <-- writes to the new column
            });

          if (error) throw error;

          liked = true;
          likeBtn.classList.add('liked');
          likeText.textContent = 'Liked';
          likeCount += 1;
          likeCountEl.textContent = likeCount;
        } else {
          const { error } = await supabaseClient
            .from('thread_likes')
            .delete()
            .eq('thread_id', threadId)
            .eq('user_id', rawUser.id);

          if (error) throw error;

          liked = false;
          likeBtn.classList.remove('liked');
          likeText.textContent = 'Like';
          likeCount = Math.max(0, likeCount - 1);
          likeCountEl.textContent = likeCount;
        }
      } catch (err) {
        console.error('like error', err);
        alert('Failed to update like.');
      } finally {
        likeBtn.disabled = false;
      }
    });
  }
}

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
                ${
                  canDelete
                    ? '<button class="btn btn-small btn-outline reply-delete-btn" style="float:right;"><i class="fa fa-trash"></i></button>'
                    : ''
                }
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
                  const res = await fetch('/api/delete-reply', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ id: r.id }),
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
              content: text,
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
        console.error('load single thread error:', err);
        threadTitleDisplay.textContent = 'Error loading thread';
        threadContentDisplay.textContent = 'Could not load this thread.';
      }
    })();
  }

  // ===================== PROFILE PAGE (profile.html) =====================
  const profileUsernameEl = document.getElementById('profile-username');
  const profileRoleTextEl = document.getElementById('profile-role-text');
  const profileEmailEl = document.getElementById('profile-email');
  const profileJoinedEl = document.getElementById('profile-joined');
  const statThreadsEl = document.getElementById('stat-threads');
  const statRepliesEl = document.getElementById('stat-replies');
  const statLikesEl = document.getElementById('stat-likes');
  const profileThreadsList = document.getElementById('profile-threads-list');
  const profileRepliesList = document.getElementById('profile-replies-list');
  const profileLikesList = document.getElementById('profile-likes-list');

  function mapRoleToLabel(role) {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Administrator';
      default:
        return 'Member';
    }
  }

  if (profileUsernameEl && profileRoleTextEl) {
    (async () => {
      const { data: userData, error } = await supabaseClient.auth.getUser();
      if (error || !userData?.user) {
        profileUsernameEl.textContent = 'Not logged in';
        return;
      }

      const user = userData.user;

      const [{ data: profile }, { data: userRow }] = await Promise.all([
        supabaseClient
          .from('profiles')
          .select('username, created_at')
          .eq('id', user.id)
          .maybeSingle(),
        supabaseClient
          .from('users')
          .select('role, avatar_url')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      const uname = profile?.username || user.email;
      const role = userRow?.role || 'user';
      const avatarUrl = userRow?.avatar_url || null;

      profileUsernameEl.textContent = uname;
      if (profileEmailEl) profileEmailEl.textContent = user.email;
      if (profileJoinedEl && profile?.created_at) {
        profileJoinedEl.textContent = formatDateShort(profile.created_at);
      }

      profileRoleTextEl.textContent = mapRoleToLabel(role);

      const avatarEl = document.getElementById('profile-avatar');
      const avatarIcon = document.getElementById('profile-avatar-icon');

      if (avatarEl && avatarUrl) {
        avatarEl.innerHTML = '';
        const img = document.createElement('img');
        img.id = 'profile-avatar-img';
        img.src = avatarUrl;
        avatarEl.appendChild(img);
      } else if (avatarIcon) {
        avatarIcon.style.display = 'block';
      }

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
          .eq('user_id', user.id),
      ]);

      if (statThreadsEl) statThreadsEl.textContent = threads ? threads.length : 0;
      if (statRepliesEl) statRepliesEl.textContent = replies ? replies.length : 0;
      if (statLikesEl) statLikesEl.textContent = likes ? likes.length : 0;

      const bannerThreads = document.getElementById('banner-threads');
      const bannerPosts = document.getElementById('banner-posts');
      if (bannerThreads) bannerThreads.textContent = threads ? threads.length : 0;
      if (bannerPosts) bannerPosts.textContent = replies ? replies.length : 0;

      if (profileThreadsList) {
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
      }

      if (profileRepliesList) {
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
      }

      if (profileLikesList) {
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
      }

      // avatar URL input logic (writes to users.avatar_url)
      const avatarInput = document.getElementById('avatar-url-input');
      const avatarSave = document.getElementById('avatar-url-save');
      const avatarStatus = document.getElementById('avatar-url-status');

      if (avatarInput && avatarSave && avatarEl) {
        if (avatarUrl) {
          avatarInput.value = avatarUrl;
        }

        avatarSave.addEventListener('click', async () => {
          const url = avatarInput.value.trim();
          if (!url) {
            avatarStatus.textContent = 'Enter an image URL first.';
            return;
          }
          avatarStatus.textContent = 'Saving avatar...';

          try {
            const { error: upError } = await supabaseClient
              .from('users')
              .update({ avatar_url: url })
              .eq('id', user.id);
            if (upError) throw upError;

            avatarEl.innerHTML = '';
            const img = document.createElement('img');
            img.id = 'profile-avatar-img';
            img.src = url;
            avatarEl.appendChild(img);

            // update header avatar if present
            const headerAvatar = document.querySelector('.user-avatar-header');
            if (headerAvatar) headerAvatar.src = url;

            avatarStatus.textContent = 'Avatar updated.';
          } catch (err) {
            console.error('avatar update error', err);
            avatarStatus.textContent = 'Failed to update avatar.';
          }
        });
      }
    })();
  }

  // ===================== INDEX: Current Staff (from public.users) =====================
  async function loadCurrentStaff() {
  const container = document.getElementById('current-staff-list');
  if (!container) return;

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('email, role, username, userrank')
      .in('role', ['admin', 'owner'])
      .order('role', { ascending: false });

    if (error) {
      console.error('loadCurrentStaff error', error);
      return;
    }

    container.innerHTML = '';

    if (!data || data.length === 0) {
      container.textContent = 'No staff members found.';
      return;
    }

    data.forEach((u) => {
      const line = document.createElement('div');
      line.className = 'staff-line';

      const displayName =
        (u.username && u.username.trim()) ||
        (u.email ? u.email.split('@')[0] : 'user');

      const roleLabel =
        u.userrank && u.userrank.trim()
          ? u.userrank
          : u.role === 'owner'
          ? 'Owner'
          : u.role === 'admin'
          ? 'Admin'
          : u.role || 'Staff';

      // TEXT ONLY: no avatar <img>, no images/default-avatar.png
      line.innerHTML = `
        <span class="staff-name">${displayName}</span>
        <span class="staff-role">${roleLabel}</span>
      `;

      container.appendChild(line);
    });
  } catch (err) {
    console.error('loadCurrentStaff error', err);
  }
}

loadCurrentStaff();

  // ===================== INDEX: Accounts threads counter =====================
  async function updateIndexAccountsThreads() {
    const el = document.getElementById('index-accounts-threads');
    if (!el) return; // not on index.html

    try {
      const { count, error } = await supabaseClient
        .from('threads')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('updateIndexAccountsThreads error', error);
        return;
      }

      el.textContent = count ?? 0;
    } catch (err) {
      console.error('updateIndexAccountsThreads error', err);
    }
  }

  updateIndexAccountsThreads();
});