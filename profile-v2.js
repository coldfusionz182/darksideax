import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Rank hierarchy: owner > admin > elite > veteran > contributor > trusted > member
const RANK_HIERARCHY = ['owner', 'admin', 'elite', 'veteran', 'contributor', 'trusted', 'member'];

const RANK_ICONS = {
  owner: 'fa-crown',
  admin: 'fa-shield-alt',
  elite: 'fa-gem',
  veteran: 'fa-medal',
  contributor: 'fa-trophy',
  trusted: 'fa-check-circle',
  member: 'fa-user'
};

function getRankClass(userrank, role) {
  // Role-based ranks take absolute priority (owner/admin)
  if (role === 'owner') return 'ds-user-owner';
  if (role === 'admin') return 'ds-user-admin';
  // Then userrank
  const rank = (userrank || '').toLowerCase();
  if (rank === 'elite') return 'ds-user-elite';
  if (rank === 'veteran') return 'ds-user-veteran';
  if (rank === 'contributor') return 'ds-user-contributor';
  if (rank === 'trusted') return 'ds-user-trusted';
  return 'ds-user-member';
}

function getRankDisplay(userrank, role) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  const rank = (userrank || '').toLowerCase();
  if (rank && RANK_HIERARCHY.includes(rank)) {
    return rank.charAt(0).toUpperCase() + rank.slice(1);
  }
  return 'Member';
}

function renderGroupPills(user) {
  const container = document.getElementById('profile-groups-row');
  if (!container) return;
  container.innerHTML = '';

  // Always show the primary rank pill
  const primaryRank = user.role === 'owner' ? 'owner' : user.role === 'admin' ? 'admin' : (user.userrank || 'member').toLowerCase();
  const primaryPill = document.createElement('span');
  primaryPill.className = `group-pill group-pill-${primaryRank}`;
  const primaryIcon = RANK_ICONS[primaryRank] || 'fa-user';
  primaryPill.innerHTML = `<i class="fa ${primaryIcon}"></i> ${getRankDisplay(user.userrank, user.role)}`;
  container.appendChild(primaryPill);

  // If user has a userrank AND a staff role, show both pills
  if (user.userrank && (user.role === 'owner' || user.role === 'admin')) {
    const rank = user.userrank.toLowerCase();
    if (rank !== 'owner' && rank !== 'admin') {
      const extraPill = document.createElement('span');
      extraPill.className = `group-pill group-pill-${rank}`;
      const extraIcon = RANK_ICONS[rank] || 'fa-user';
      extraPill.innerHTML = `<i class="fa ${extraIcon}"></i> ${rank.charAt(0).toUpperCase() + rank.slice(1)}`;
      container.appendChild(extraPill);
    }
  }
}

async function loadProfile() {
  const usernameEl = document.getElementById('profile-username');
  if (!usernameEl) return;

  // 1. Resolve Identity (Own or Other Profile via ?user=USERNAME)
  const urlUser = getParam('user');
  console.log('Profile query param user=', urlUser, 'location=', window.location.search);
  const { data: { user: authUser } } = await supabase.auth.getUser();

  let targetUser = null;
  let isOwner = false;

  try {
    if (urlUser) {
      // Viewing another user's profile by username
      // Username is in users table
      const { data: userData, error: uErr } = await supabase
        .from('users')
        .select('id, email, username, role, avatar_url, userrank, created_at, discord, telegram')
        .ilike('username', urlUser)
        .maybeSingle();

      if (uErr) console.warn('Supabase users table error:', uErr);
      if (!userData) {
        usernameEl.textContent = 'User not found';
        return;
      }
      targetUser = userData;
      isOwner = authUser ? authUser.id === targetUser.id : false;
    } else {
      // Viewing own profile
      if (!authUser) {
        usernameEl.textContent = 'Please Login';
        return;
      }
      const { data: userData, error: uErr } = await supabase
        .from('users')
        .select('id, email, username, role, avatar_url, userrank, created_at, discord, telegram')
        .eq('id', authUser.id)
        .maybeSingle();

      if (uErr) console.warn('Supabase users table error:', uErr);
      if (!userData) throw new Error('Data not found');

      targetUser = userData;
      isOwner = true;
    }
  } catch (err) {
    console.error('Profile Load Error:', err);
    usernameEl.textContent = 'Profile Error';
    return;
  }

  const isStaff = targetUser.role === 'admin' || targetUser.role === 'owner';

  // Update page title
  document.title = `${targetUser.username}'s Profile • Darkside`;

  // 2. Populate UI
  usernameEl.textContent = targetUser.username;
  document.getElementById('profile-joined').textContent = formatDate(targetUser.created_at);
  if (document.getElementById('info-uid')) document.getElementById('info-uid').textContent = targetUser.id.substring(0, 8);

  const avatarContainer = document.getElementById('profile-avatar');
  if (targetUser.avatar_url) {
    avatarContainer.innerHTML = `<img src="${targetUser.avatar_url}" id="profile-avatar-img" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
  }

  // Social Inputs (Load existing)
  if (targetUser.discord) document.getElementById('discord-input').value = targetUser.discord;
  if (targetUser.telegram) document.getElementById('telegram-input').value = targetUser.telegram;

  // Branding Integration - use userrank for color, fallback to role
  const rankClass = getRankClass(targetUser.userrank, targetUser.role);
  usernameEl.className = 'profile-username-big ' + rankClass;

  // Display rank text (userrank takes priority, fallback to role) with color
  const rankDisplay = getRankDisplay(targetUser.userrank, targetUser.role);
  const rankTextEl = document.getElementById('profile-role-text');
  rankTextEl.textContent = rankDisplay;
  rankTextEl.className = 'profile-rank-text ' + rankClass;

  // Privacy
  if (isOwner) {
    document.getElementById('profile-email-row').style.display = 'flex';
    document.getElementById('profile-email').textContent = targetUser.email;
    document.getElementById('profile-uid-row').style.display = 'flex';
    if (document.getElementById('avatar-url-input')) document.getElementById('avatar-url-input').value = targetUser.avatar_url || '';
  } else {
    const settingsSection = document.getElementById('profile-settings-section');
    if (settingsSection) settingsSection.style.display = 'none';
  }

  if (isStaff && !isOwner) {
    document.getElementById('staff-profile-actions').style.display = 'block';
  }

  // 3. Activity & Stats
  const [{ data: threads }, { data: replies }, { data: likesGiven }] = await Promise.all([
    supabase.from('threads').select('id, title, tag, created_at').ilike('author', targetUser.username).order('created_at', { ascending: false }),
    supabase.from('thread_replies').select('id, thread_id, content, created_at').ilike('author', targetUser.email).order('created_at', { ascending: false }),
    supabase.from('thread_likes').select('id, thread_id, created_at').ilike('username', targetUser.username).order('created_at', { ascending: false })
  ]);

  const likesCount = likesGiven?.length || 0;
  document.getElementById('stat-threads').textContent = threads?.length || 0;
  document.getElementById('stat-replies').textContent = replies?.length || 0;
  document.getElementById('stat-likes').textContent = likesCount;
  document.getElementById('profile-likes-total').textContent = likesCount;

  // Auto-assign Contributor rank if 200+ likes and no higher rank set
  if (likesCount >= 200 && !targetUser.userrank) {
    await supabase.from('users').update({ userrank: 'contributor' }).eq('id', targetUser.id);
    targetUser.userrank = 'contributor';
    // Re-apply branding after auto-rank
    const newRankClass = getRankClass(targetUser.userrank, targetUser.role);
    usernameEl.className = 'profile-username-big ' + newRankClass;
    const rankTextEl = document.getElementById('profile-role-text');
    rankTextEl.textContent = getRankDisplay(targetUser.userrank, targetUser.role);
    rankTextEl.className = 'profile-rank-text ' + newRankClass;
  }

  // Render dynamic group pills
  renderGroupPills(targetUser);

  // Render Threads
  const tList = document.getElementById('profile-threads-list');
  tList.innerHTML = '';
  if (!threads?.length) { tList.innerHTML = '<li class="meta">No threads created yet.</li>'; }
  else {
    threads.slice(0, 5).forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'thread-anim';
      li.style.animationDelay = `${i * 0.1}s`;
      li.innerHTML = `<a href="thread.html?id=${t.id}"><span class="badge-pill">${t.tag || 'Thread'}</span> ${t.title}</a><div class="meta">Posted on ${formatDate(t.created_at)}</div>`;
      tList.appendChild(li);
    });
  }

  // Render Replies
  const rList = document.getElementById('profile-replies-list');
  rList.innerHTML = '';
  if (!replies?.length) { rList.innerHTML = '<li class="meta">No recent replies.</li>'; }
  else {
    replies.slice(0, 5).forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'thread-anim';
      li.style.animationDelay = `${i * 0.1}s`;
      li.innerHTML = `<a href="thread.html?id=${r.thread_id}">Replied to thread #${r.thread_id}</a><div class="meta">${formatDate(r.created_at)}</div>`;
      rList.appendChild(li);
    });
  }

  // Render Likes (Given)
  const lList = document.getElementById('profile-likes-list');
  lList.innerHTML = '';
  if (!likesGiven?.length) { lList.innerHTML = '<li class="meta">No likes given yet.</li>'; }
  else {
    likesGiven.slice(0, 5).forEach((l, i) => {
      const li = document.createElement('li');
      li.className = 'thread-anim';
      li.style.animationDelay = `${i * 0.1}s`;
      li.innerHTML = `<a href="thread.html?id=${l.thread_id}">Liked thread #${l.thread_id}</a><div class="meta">${formatDate(l.created_at)}</div>`;
      lList.appendChild(li);
    });
  }
}

async function setupAvatarUpdate() {
  const saveBtn = document.getElementById('avatar-url-save');
  const input = document.getElementById('avatar-url-input');
  const status = document.getElementById('avatar-url-status');
  if (!saveBtn || !input) return;

  saveBtn.onclick = async () => {
    const url = input.value.trim();
    if (!url) return;
    status.textContent = 'Saving...';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
      if (error) { 
        status.textContent = 'Error saving.'; 
        alert('Avatar Save Error: ' + error.message);
      } else { 
        status.textContent = 'Saved!'; 
        setTimeout(() => window.location.reload(), 1000); 
      }
    } catch(err) {
      alert('Network error saving avatar: ' + err.message);
    }
  };
}

async function setupSocialUpdate() {
  const saveBtn = document.getElementById('btn-save-socials');
  if (!saveBtn) return;

  saveBtn.onclick = async () => {
    const dVal = document.getElementById('discord-input').value.trim();
    const tVal = document.getElementById('telegram-input').value.trim();
    const status = document.getElementById('socials-status');

    status.textContent = 'Updating...';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase.from('users').update({ discord: dVal, telegram: tVal }).eq('id', user.id);
      
      if (error) {
        status.textContent = 'Error saving handles.';
        status.style.color = '#ef4444';
        alert("Database Error: " + error.message);
      } else {
        status.textContent = 'Social handles updated!';
        status.style.color = '#10b981';
        setTimeout(() => status.textContent = '', 2000);
      }
    } catch (err) {
      status.textContent = 'Network Error.';
      alert("Error: " + err.message);
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  setupAvatarUpdate();
  setupSocialUpdate();
});