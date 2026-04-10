// notifications.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_NOTIFS = 5;

// -------------- USER HELPERS --------------

async function getCurrentUserProfileWithLastSeen() {
  const { data: userData, error } = await supabaseClient.auth.getUser();
  if (error || !userData?.user) return null;

  const user = userData.user;

  const { data: profile, error: pErr } = await supabaseClient
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (pErr) {
    console.error('notifications: profile error', pErr);
  }

  const { data: userRow, error: uErr } = await supabaseClient
    .from('users')
    .select('last_notifications_seen_at')
    .eq('id', user.id)
    .maybeSingle();

  if (uErr) {
    console.error('notifications: users.last_notifications_seen_at error', uErr);
  }

  const username = profile?.username || user.email;

  return {
    id: user.id,
    email: user.email,
    username,
    lastSeen: userRow?.last_notifications_seen_at || null,
  };
}

async function updateLastNotificationsSeen(userId) {
  try {
    const { error } = await supabaseClient
      .from('users')
      .update({ last_notifications_seen_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('notifications: failed to update last_notifications_seen_at', error);
    }
  } catch (e) {
    console.error('notifications: updateLastNotificationsSeen exception', e);
  }
}

// -------------- DOM SETUP --------------

function initNotificationsDom(onBellOpen) {
  const bellBtn  = document.getElementById('notif-bell-btn');
  const dropdown = document.getElementById('notif-dropdown');
  const countEl  = document.getElementById('notif-count');
  const badgeEl  = document.getElementById('notif-badge-count');
  const listEl   = document.getElementById('notif-list');

  if (!bellBtn || !dropdown || !countEl || !badgeEl || !listEl) return null;

  function renderNotifications(notifs) {
    listEl.innerHTML = '';

    if (!notifs.length) {
      const empty = document.createElement('div');
      empty.className = 'notif-empty';
      empty.textContent = 'No notifications yet.';
      listEl.appendChild(empty);

      countEl.style.display = 'none';
      badgeEl.textContent = '0';
      return;
    }

    notifs.forEach((n) => {
      const item = document.createElement('div');
      item.className = 'notif-item';
      item.dataset.id = n.id;

      const title = document.createElement('div');
      title.className = 'notif-item-title';
      title.textContent = n.title;

      const meta = document.createElement('div');
      meta.className = 'notif-item-meta';
      meta.textContent = n.meta;

      item.appendChild(title);
      item.appendChild(meta);

      item.addEventListener('click', () => {
        dropdown.classList.remove('open');
        // optional: window.location.href = `thread.html?id=${n.threadId}`;
      });

      listEl.appendChild(item);
    });

    const count = notifs.length;
    if (count > 0) {
      countEl.style.display = 'block';
      countEl.textContent = String(count);
      badgeEl.textContent = String(count);
    } else {
      countEl.style.display = 'none';
      badgeEl.textContent = '0';
    }
  }

  function openDropdown() {
    dropdown.classList.add('open');
    if (typeof onBellOpen === 'function') {
      onBellOpen();
    }
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
  }

  function toggleDropdown() {
    if (dropdown.classList.contains('open')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.classList.contains('open')) return;
    if (dropdown.contains(e.target) || bellBtn.contains(e.target)) return;
    closeDropdown();
  });

  return {
    renderNotifications,
    setCountVisible: (count) => {
      if (count > 0) {
        countEl.style.display = 'block';
        countEl.textContent = String(count);
        badgeEl.textContent = String(count);
      } else {
        countEl.style.display = 'none';
        badgeEl.textContent = '0';
      }
    },
  };
}

// -------------- DATA FETCHERS --------------

// Threads authored by current user
async function fetchMyThreads(username) {
  const { data, error } = await supabaseClient
    .from('threads')
    .select('id, title, author')
    .eq('author', username);

  if (error) {
    console.error('notifications: threads error', error);
    return [];
  }
  return data || [];
}

// Likes on my threads (uses thread_likes.username)
async function fetchLikeNotifications(currentUser, myThreadIds, lastSeen) {
  if (!myThreadIds.length) return [];

  let query = supabaseClient
    .from('thread_likes')
    .select('id, thread_id, username, created_at')
    .in('thread_id', myThreadIds);

  if (lastSeen) {
    query = query.gt('created_at', lastSeen);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(MAX_NOTIFS);

  if (error) {
    console.error('notifications: likes error', error);
    return [];
  }

  return (data || [])
    .filter((row) => row.username && row.username !== currentUser.username)
    .map((row) => ({
      id: `like-${row.id}`,
      type: 'like',
      actor: row.username,
      threadId: row.thread_id,
      created_at: row.created_at,
    }));
}

// Replies on my threads (uses author_username)
async function fetchReplyNotifications(currentUser, myThreadIds, lastSeen) {
  if (!myThreadIds.length) return [];

  let query = supabaseClient
    .from('thread_replies')
    .select('id, thread_id, author_username, created_at')
    .in('thread_id', myThreadIds);

  if (lastSeen) {
    query = query.gt('created_at', lastSeen);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(MAX_NOTIFS);

  if (error) {
    console.error('notifications: replies error', error);
    return [];
  }

  return (data || [])
    .filter((r) => r.author_username && r.author_username !== currentUser.username)
    .map((r) => ({
      id: `reply-${r.id}`,
      type: 'reply',
      actor: r.author_username,
      threadId: r.thread_id,
      created_at: r.created_at,
    }));
}

// NEW: Rep notifications (rep given to me)
async function fetchRepNotifications(currentUser, lastSeen) {
  let query = supabaseClient
    .from('rep')
    .select('id, username, given_by, amount, created_at')
    .eq('username', currentUser.username);

  if (lastSeen) {
    query = query.gt('created_at', lastSeen);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(MAX_NOTIFS);

  if (error) {
    console.error('notifications: rep error', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: `rep-${row.id}`,
    type: 'rep',
    actor: row.given_by || 'Unknown',
    amount: row.amount,
    created_at: row.created_at,
  }));
}

// Merge likes + replies + rep and attach thread titles
async function refreshNotifications(currentUser, renderNotifications) {
  try {
    const myThreads = await fetchMyThreads(currentUser.username);
    const threadMap = new Map();
    const myThreadIds = [];

    (myThreads || []).forEach((t) => {
      myThreadIds.push(t.id);
      threadMap.set(t.id, t.title);
    });

    const [replyNotifs, likeNotifs, repNotifs] = await Promise.all([
      fetchReplyNotifications(currentUser, myThreadIds, currentUser.lastSeen),
      fetchLikeNotifications(currentUser, myThreadIds, currentUser.lastSeen),
      fetchRepNotifications(currentUser, currentUser.lastSeen),
    ]);

    const all = [...replyNotifs, ...likeNotifs, ...repNotifs].map((n) => {
      if (n.type === 'rep') {
        const amtNum = parseInt(n.amount ?? '0', 10);
        const amt = Number.isNaN(amtNum) ? n.amount : amtNum;
        const sign = amt >= 0 ? '+' : '';
        const prettyAmount = `${sign}${amt}`;
        return {
          ...n,
          title: `${n.actor} gave you ${prettyAmount} rep`,
          meta: new Date(n.created_at).toLocaleString(),
        };
      }

      const threadTitle = threadMap.get(n.threadId) || `Thread #${n.threadId}`;
      let title;
      if (n.type === 'reply') {
        title = `${n.actor} replied to your thread "${threadTitle}"`;
      } else {
        title = `${n.actor} liked your thread "${threadTitle}"`;
      }
      return {
        ...n,
        title,
        meta: new Date(n.created_at).toLocaleString(),
      };
    });

    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderNotifications(all.slice(0, MAX_NOTIFS));
  } catch (err) {
    console.error('notifications refresh error', err);
    renderNotifications([]);
  }
}

// -------------- ENTRY POINT --------------

async function startNotifications() {
  let currentUser = await getCurrentUserProfileWithLastSeen();
  if (!currentUser) {
    // guest: nothing to show
    const domGuest = initNotificationsDom(() => {});
    if (domGuest) domGuest.renderNotifications([]);
    return;
  }

  const dom = initNotificationsDom(async () => {
    // when bell is opened, mark as seen now
    await updateLastNotificationsSeen(currentUser.id);
    currentUser = {
      ...currentUser,
      lastSeen: new Date().toISOString(),
    };
  });

  if (!dom) return;
  const { renderNotifications } = dom;

  await refreshNotifications(currentUser, renderNotifications);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startNotifications);
} else {
  startNotifications();
}