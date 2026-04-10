// profile.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getQueryParam(name) {
  const url = new URL(window.location.href);
  const v = url.searchParams.get(name);
  return v ? v.trim() : null;
}

// Load current session user (for fallback + "is this my own profile?")
async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

// Load profile by username (public)
async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, created_at')
    .eq('username', username)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Load profile by user id (current user, no ?u)
async function getProfileByUserId(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Optional: user_stats table if you have one
async function getUserStats(userId) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('threads, posts, likes, credits, vouches')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('getUserStats error', error);
    return null;
  }
  return data;
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '–';
}

function setAvatar(avatarUrl, username) {
  const wrapper = document.getElementById('profile-avatar');
  if (!wrapper) return;

  if (avatarUrl) {
    let img = wrapper.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      wrapper.innerHTML = '';
      wrapper.appendChild(img);
    }
    img.src = avatarUrl;
    img.alt = username || 'avatar';
  } else {
    // fall back to icon if no avatar
    wrapper.innerHTML = '<i class="fa fa-user-ninja" id="profile-avatar-icon"></i>';
  }
}

async function initProfilePage() {
  const paramUsername = getQueryParam('u'); // ?u=SomeUser
  const currentUser = await getCurrentUser();

  let profile = null;
  let viewingOwnProfile = false;

  try {
    if (paramUsername) {
      // Visiting /profile.html?u=SomeUser
      profile = await getProfileByUsername(paramUsername);
      if (!profile) {
        alert('Profile not found for user: ' + paramUsername);
        return;
      }
      viewingOwnProfile = currentUser && profile.id === currentUser.id;
    } else {
      // /profile.html with no param => must be logged in, show own profile
      if (!currentUser) {
        window.location.href = 'login.html';
        return;
      }
      profile = await getProfileByUserId(currentUser.id);
      if (!profile) {
        alert('Profile record not found.');
        return;
      }
      viewingOwnProfile = true;
    }
  } catch (err) {
    console.error('Failed to load profile', err);
    alert('Failed to load profile.');
    return;
  }

  // Basic identity
  setText('profile-username', profile.username || 'Unknown');
  setAvatar(profile.avatar_url, profile.username);

  // Role + joined from public.users
  try {
    const { data: userRow } = await supabase
      .from('users')
      .select('role, created_at')
      .eq('id', profile.id)
      .maybeSingle();

    if (userRow?.role) {
      const roleText =
        userRow.role === 'owner'
          ? 'Owner'
          : userRow.role === 'admin'
          ? 'Admin'
          : 'Member';
      setText('profile-role-text', roleText);
    }
    setText(
      'profile-joined',
      formatDate(userRow?.created_at || profile.created_at)
    );
  } catch (e) {
    console.warn('users role fetch error', e);
  }

  // Stats (optional table)
  const stats = await getUserStats(profile.id);
  if (stats) {
    const threads = stats.threads ?? 0;
    const posts = stats.posts ?? 0;
    const likes = stats.likes ?? 0;
    const credits = stats.credits ?? 0;
    const vouches = stats.vouches ?? 0;

    // banner
    setText('banner-threads', threads);
    setText('banner-posts', posts);
    setText('banner-vouches', vouches);
    setText('banner-credits', credits);

    // wide stats
    setText('stat-threads', threads);
    setText('stat-replies', posts);
    setText('stat-likes', likes);
    setText('stat-credits', credits);

    // left cards
    setText('profile-rep', vouches || 0);
    setText('profile-likes-total', likes || 0);
  }

  // Email / UID only for own profile
  if (viewingOwnProfile) {
    setText('profile-email', currentUser?.email || '–');
    setText('info-uid', currentUser?.id || '–');
  } else {
    setText('profile-email', 'Private');
    setText('info-uid', 'Hidden');
  }

  // Likes given / referrals / others can later come from another table
  // Leaving placeholders for now

  // Avatar URL editing – only own profile
  const avatarInput = document.getElementById('avatar-url-input');
  const avatarSaveBtn = document.getElementById('avatar-url-save');
  const avatarStatus = document.getElementById('avatar-url-status');

  if (!viewingOwnProfile) {
    if (avatarInput) {
      avatarInput.disabled = true;
      avatarInput.placeholder = 'Only the user can change their avatar.';
    }
    if (avatarSaveBtn) avatarSaveBtn.disabled = true;
    if (avatarStatus) avatarStatus.textContent = 'Read‑only profile.';
    return;
  }

  if (avatarSaveBtn && avatarInput) {
    avatarSaveBtn.addEventListener('click', async () => {
      const url = avatarInput.value.trim();
      if (!url) {
        if (avatarStatus) avatarStatus.textContent = 'Enter a valid image URL.';
        return;
      }

      try {
        avatarSaveBtn.disabled = true;
        if (avatarStatus) avatarStatus.textContent = 'Saving…';

        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: url })
          .eq('id', profile.id);

        if (error) throw error;

        setAvatar(url, profile.username);
        if (avatarStatus) avatarStatus.textContent = 'Updated.';
      } catch (err) {
        console.error('avatar update error', err);
        if (avatarStatus) avatarStatus.textContent = 'Failed to update.';
      } finally {
        avatarSaveBtn.disabled = false;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initProfilePage();
});