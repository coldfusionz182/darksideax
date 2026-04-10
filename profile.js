// profile.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================================
// Shared helper: build profile URL from username
// =========================================
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

// ---------- Supabase fetchers ----------
async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function getProfileByUsername(username) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, username, avatar_url, created_at')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getProfileByUserId(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, username, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserRow(userId) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('role, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserContent(username, userId) {
  // Adjust if your replies use email instead of username
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
      .eq('user_id', userId),
  ]);

  return {
    threads: threads || [],
    replies: replies || [],
    likes: likes || [],
  };
}

// =========================================
// Main profile page logic
// =========================================
async function initProfilePage() {
  // DOM refs
  const profileUsernameEl = document.getElementById('profile-username');
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
  const currentUser = await getCurrentUser();

  let profile = null;
  let userRow = null;
  let viewingOwnProfile = false;

  try {
    if (paramUsername) {
      // Visiting /profile.html?u=SomeUser
      profile = await getProfileByUsername(paramUsername);
      if (!profile) {
        if (profileUsernameEl) profileUsernameEl.textContent = 'Profile not found';
        return;
      }
      viewingOwnProfile = !!(currentUser && profile.id === currentUser.id);
      userRow = await getUserRow(profile.id);
    } else {
      // Visiting /profile.html (no ?u) => own profile only
      if (!currentUser) {
        window.location.href = 'login.html';
        return;
      }
      profile = await getProfileByUserId(currentUser.id);
      if (!profile) {
        if (profileUsernameEl) profileUsernameEl.textContent = 'Profile not found';
        return;
      }
      viewingOwnProfile = true;
      userRow = await getUserRow(profile.id);
    }
  } catch (err) {
    console.error('profile load error', err);
    if (profileUsernameEl) profileUsernameEl.textContent = 'Error loading profile';
    return;
  }

  const username =
    profile.username ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'User');
  const role = userRow?.role || 'user';
  const avatarUrl = userRow?.avatar_url || profile.avatar_url || null;
  const joinedAt = userRow?.created_at || profile.created_at || null;

  // Top banner / basic info
  if (profileUsernameEl) profileUsernameEl.textContent = username;
  if (profileRoleTextEl) profileRoleTextEl.textContent = mapRoleToLabel(role);
  if (profileJoinedEl && joinedAt) {
    profileJoinedEl.textContent = formatDateShort(joinedAt);
  }

  // Email & UID visibility
  if (viewingOwnProfile) {
    if (profileEmailEl) profileEmailEl.textContent = currentUser?.email || '–';
    if (infoUidEl) infoUidEl.textContent = currentUser?.id || '–';
  } else {
    if (profileEmailEl) profileEmailEl.textContent = 'Private';
    if (infoUidEl) infoUidEl.textContent = 'Hidden';
  }

  setAvatar(avatarUrl);

  // Content stats
  const { threads, replies, likes } = await getUserContent(username, profile.id);

  const threadsCount = threads.length;
  const repliesCount = replies.length;
  const likesCount = likes.length;
  const credits = 0; // extend when you add credits
  const vouches = 0; // extend when you add vouches

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

  // Recent threads
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

  // Recent replies
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

  // Recent likes
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

  // Avatar URL editing – only own profile
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
          .eq('id', profile.id);
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

// Only run profile logic when on profile page
document.addEventListener('DOMContentLoaded', () => {
  const profileUsernameEl = document.getElementById('profile-username');
  if (!profileUsernameEl) return; // not on profile.html
  initProfilePage();
});