// notifications.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_NOTIFS = 5;

async function getCurrentUserProfile() {
  // mirror logic from getCurrentUserWithRole / profile section in paste.txt
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

  const username = profile?.username || user.email;

  return {
    id: user.id,
    email: user.email,
    username,
  };
}

function initNotifications() {
  const bellBtn  = document.getElementById('notif-bell-btn');
  const dropdown = document.getElementById('notif-dropdown');
  const countEl  = document.getElementById('notif-count');
  const badgeEl  = document.getElementById('notif-badge-count');
  const listEl   = document.getElementById('notif-list');

  if (!bellBtn || !dropdown || !countEl || !badgeEl || !listEl) return;

  async function fetchReplyNotifications(currentUser, myThreadIds) {
    if (!myThreadIds.length) return [];

    const { data, error } = await supabaseClient
      .from('thread_replies')
      .select('id, thread_id, author_username, created_at')
      .in('thread_id', myThreadIds)
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFS);

    if (error) {
      console.error('notifications: replies error', error);
      return [];
    }

    return (data || [])
      // don’t notify when you reply to your own thread
      .filter(r => r.author_username && r.author_username !== currentUser.username)
      .map(r => ({
        id: `reply-${r.id}`,
        type: 'reply',
        threadId: r.thread_id,
        actor: r.author_username,
        created_at: r.created_at,
      }));
  }

  async function fetchLikeNotifications(currentUser, myThreadIds) {
    if (!myThreadIds.length) return [];

    // join likes → profiles to get liker username
    const { data, error } = await supabaseClient
      .from('thread_likes')
      .select(`
        id,
        thread_id,
        created_at,
        profiles:user_id ( username )
      `)
      .in('thread_id', myThreadIds)
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFS);

    if (error) {
      console.error('notifications: likes error', error);
      return [];
    }

    return (data || [])
      .map(like => {
        const likerName = like.profiles?.username || 'Someone';
        return {
          id: `like-${like.id}`,
          type: 'like',
          threadId: like.thread_id,
          actor: likerName,
          created_at: like.created_at,
        };
      })
      // don’t notify if you like your own thread
      .filter(n => n.actor !== currentUser.username);
  }

  async function refreshNotifications() {
    try {
      const currentUser = await getCurrentUserProfile();
      if (!currentUser) {
        renderNotifications([]);
        return;
      }

      // 1) find threads this user owns
      const { data: myThreads, error: tErr } = await supabaseClient
        .from('threads')
        .select('id, title, author')
        .eq('author', currentUser.username);

      if (tErr) {
        console.error('notifications: threads error', tErr);
        renderNotifications([]);
        return;
      }

      const threadMap = new Map();
      const myThreadIds = [];
      (myThreads || []).forEach(t => {
        myThreadIds.push(t.id);
        threadMap.set(t.id, t.title);
      });

      // 2) replies and likes on those threads
      const [replyNotifs, likeNotifs] = await Promise.all([
        fetchReplyNotifications(currentUser, myThreadIds),
        fetchLikeNotifications(currentUser, myThreadIds),
      ]);

      // 3) attach thread titles + text
      const all = [...replyNotifs, ...likeNotifs].map(n => {
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

      // newest first, max 5
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      renderNotifications(all.slice(0, MAX_NOTIFS));
    } catch (err) {
      console.error('notifications refresh error', err);
      renderNotifications([]);
    }
  }

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

    notifs.forEach(n => {
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
        // later: thread.html?id=n.threadId
        // window.location.href = `thread.html?id=${n.threadId}`;
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

  function toggleDropdown() {
    dropdown.classList.toggle('open');
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
  }

  // initial load + polling
  refreshNotifications();
  setInterval(refreshNotifications, 60000); // poll every 60s

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.classList.contains('open')) return;
    if (dropdown.contains(e.target) || bellBtn.contains(e.target)) return;
    closeDropdown();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotifications);
} else {
  initNotifications();
}