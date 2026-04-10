// profile.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== Shared helper: profile URL from username ==========
export function getProfileUrlForUsername(username) {
  if (!username) return 'profile.html';
  return 'profile.html?u=' + encodeURIComponent(username.trim());
}

// ---------- small helpers ----------
function getQueryParam(name) {
  const url = new URL(window.location.href);
  const v = url.searchParams.get(name);
  return v ? v.trim() : null;
}

function formatDateShort(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const hh = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

function mapRoleToLabel(role, userrank) {
  if (userrank && userrank.trim()) return userrank; // e.g. "Admin"
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    default:
      return 'Member';
  }
}

function setAvatar(avatarUrl) {
  const avatarEl = document.getElementById('profile-avatar');
  if (!avatarEl) return;

  if (avatarUrl) {
    avatarEl.innerHTML = '';
    const img = document.createElement('img');
    img.id = 'profile-avatar-img';
    img.src = avatarUrl;
    avatarEl.appendChild(img);
  } else {
    avatarEl.innerHTML = '<i class="fa fa-user-ninja" id="profile-avatar-icon"></i>';
  }
}

// ---------- Supabase lookups using `users` ----------
async function getCurrentAuthUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user; // auth.users row
}

async function getUserByUsername(username) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('uuid, email, role, username, avatar_url, userrank, created_at')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserByUuid(uuid) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('uuid, email, role, username, avatar_url, userrank, created_at')
    .eq('uuid', uuid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserContent(username, uuid) {
  const [{ data: threads }, { data: replies }, { data: likes }] = await Promise.all([
    supabaseClient
      .from('threads')
      .select('id, title, tag, created_at')
      .eq('author', username)
      .order('created_at', { ascending: false }),
    supabaseClient
      .from('thread_replies')
      .select('id, thread_id, content, created_at')
      .eq('author', username)
      .order('created_at', { ascending: false }),
    supabaseClient
      .from('thread_likes')
      .select('id, thread_id, created_at')
      .eq('user_id', uuid),
  ]);

  return {
    threads: threads || [],
    replies: replies || [],
    likes: likes || [],
  };
}

// ========== main profile logic ==========
async function initProfilePage() {
  const profileUsernameEl = document.getElementById('profile-username');
  if (!profileUsernameEl) return; // not on profile.html

  const profileRoleTextEl = document.getElementById('profile-role-text');
  const profileEmailEl = document.getElementById('profile-email');
  const profileJoinedEl = document.getElementById('profile-joined');
  const infoUidEl = document.getElementById('info-uid');

  const bannerThreads = document.getElementById('banner-threads');
  const bannerPosts = document.getElementById('banner-posts');
  const bannerVouches = document.getElementById('banner-vouches');
  const bannerCredits = document.getElementById('banner-credits');

  const statThreadsEl = document.getElementById('stat-threads');
  const statRepliesEl = document.getElementById('stat-replies');
  const statLikesEl = document.getElementById('stat-likes');
  const statCreditsEl = document.getElementById('stat-credits');

  const profileRepEl = document.getElementById('profile-rep');
  const profileLikesTotalEl = document.getElementById('profile-likes-total');

  const profileThreadsList = document.getElementById('profile-threads-list');
  const profileRepliesList = document.getElementById('profile-replies-list');
  const profileLikesList = document.getElementById('profile-likes-list');

  const avatarInput = document.getElementById('avatar-url-input');
  const avatarSave = document.getElementById('avatar-url-save');
  const avatarStatus = document.getElementById('avatar-url-status');

  const paramUsername = getQueryParam('u');
  const authUser = await getCurrentAuthUser();

  let userRow = null;
  let viewingOwnProfile = false;

  try {
    if (paramUsername) {
      // Viewing someone else (or yourself) by username
      userRow = await getUserByUsername(paramUsername);
      if (!userRow) {
        profileUsernameEl.textContent = 'Profile not found';
        return;
      }
      viewingOwnProfile = !!(authUser && authUser.id === userRow.uuid);
    } else {
      // /profile.html → must be own profile
      if (!authUser) {
        window.location.href = 'login.html';
        return;
      }
      userRow = await getUserByUuid(authUser.id);
      if (!userRow) {
        profileUsernameEl.textContent = 'Profile not found';
        return;
      }
      viewingOwnProfile = true;
    }
  } catch (err) {
    console.error('profile load error', err);
    profileUsernameEl.textContent = 'Error loading profile';
    return;
  }

  const username =
    (userRow.username && userRow.username.trim()) ||
    (userRow.email ? userRow.email.split('@')[0] : 'User');
  const roleLabel = mapRoleToLabel(userRow.role, userRow.userrank);
  const avatarUrl = userRow.avatar_url || null;
  const joinedAt = userRow.created_at || null;

  // header info
  profileUsernameEl.textContent = username;
  if (profileRoleTextEl) profileRoleTextEl.textContent = roleLabel;
  if (profileJoinedEl && joinedAt) profileJoinedEl.textContent = formatDateShort(joinedAt);

  if (viewingOwnProfile) {
    if (profileEmailEl) profileEmailEl.textContent = userRow.email || '–';
    if (infoUidEl) infoUidEl.textContent = userRow.uuid || '–';
  } else {
    if (profileEmailEl) profileEmailEl.textContent = 'Private';
    if (infoUidEl) infoUidEl.textContent = 'Hidden';
  }

  setAvatar(avatarUrl);

  // threads / replies / likes
  const { threads, replies, likes } = await getUserContent(username, userRow.uuid);

  const threadsCount = threads.length;
  const repliesCount = replies.length;
  const likesCount = likes.length;
  const credits = 0;
  const vouches = 0;

  if (bannerThreads) bannerThreads.textContent = threadsCount;
  if (bannerPosts) bannerPosts.textContent = repliesCount;
  if (bannerVouches) bannerVouches.textContent = vouches;
  if (bannerCredits) bannerCredits.textContent = credits;

  if (statThreadsEl) statThreadsEl.textContent = threadsCount;
  if (statRepliesEl) statRepliesEl.textContent = repliesCount;
  if (statLikesEl) statLikesEl.textContent = likesCount;
  if (statCreditsEl) statCreditsEl.textContent = credits;

  if (profileRepEl) profileRepEl.textContent = vouches;
  if (profileLikesTotalEl) profileLikesTotalEl.textContent = likesCount;

  // recent threads
  if (profileThreadsList) {
    profileThreadsList.innerHTML = '';
    if (!threadsCount) {
      const li = document.createElement('li');
      li.className = 'meta';
      li.textContent = viewingOwnProfile
        ? 'You have not created any threads yet.'
        : 'No threads yet.';
      profileThreadsList.appendChild(li);
    } else {
      threads.slice(0, 5).forEach((t) => {
        const li = document.createElement('li');
        li.innerHTML = `
          <a href="thread.html?id=${t.id}">
            <span class="badge-pill">${t.tag || ''}</span>${t.title}
          </a>
          <div class="meta">Posted ${formatDateShort(t.created_at)}</div>
        `;
        profileThreadsList.appendChild(li);
      });
    }
  }

  // recent replies
  if (profileRepliesList) {
    profileRepliesList.innerHTML = '';
    if (!repliesCount) {
      const li = document.createElement('li');
      li.className = 'meta';
      li.textContent = viewingOwnProfile
        ? 'You have not replied to any threads yet.'
        : 'No replies yet.';
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

  // recent likes
  if (profileLikesList) {
    profileLikesList.innerHTML = '';
    if (!likesCount) {
      const li = document.createElement('li');
      li.className = 'meta';
      li.textContent = viewingOwnProfile
        ? 'You have not liked any threads yet.'
        : 'No likes yet.';
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

  // avatar editing – only own profile
  if (!viewingOwnProfile) {
    if (avatarInput) {
      avatarInput.disabled = true;
      avatarInput.placeholder = 'Only the user can change their avatar.';
    }
    if (avatarSave) avatarSave.disabled = true;
    if (avatarStatus) avatarStatus.textContent = 'Read‑only profile.';
    return;
  }

  if (avatarInput && avatarSave) {
    if (avatarUrl) avatarInput.value = avatarUrl;

    avatarSave.addEventListener('click', async () => {
      const url = avatarInput.value.trim();
      if (!url) {
        if (avatarStatus) avatarStatus.textContent = 'Enter an image URL first.';
        return;
      }
      if (avatarStatus) avatarStatus.textContent = 'Saving avatar...';

      try {
        const { error: upError } = await supabaseClient
          .from('users')
          .update({ avatar_url: url })
          .eq('uuid', userRow.uuid);
        if (upError) throw upError;

        setAvatar(url);
        const headerAvatar = document.querySelector('.user-avatar-header');
        if (headerAvatar) headerAvatar.src = url;
        if (avatarStatus) avatarStatus.textContent = 'Avatar updated.';
      } catch (err) {
        console.error('avatar update error', err);
        if (avatarStatus) avatarStatus.textContent = 'Failed to update avatar.';
      }
    });
  }
}

// Run only when profile DOM exists
document.addEventListener('DOMContentLoaded', () => {
  const profileUsernameEl = document.getElementById('profile-username');
  if (!profileUsernameEl) return;
  initProfilePage();
});