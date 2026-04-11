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

async function loadProfile() {
  const targetUsername = getParam('u');
  const usernameEl = document.getElementById('profile-username');
  if (!usernameEl) return;

  // 1. Get Logged In User
  const { data: { user: authUser } } = await supabase.auth.getUser();
  let viewerData = null;
  if (authUser) {
    const { data: vRow } = await supabase.from('users').select('role, username').eq('id', authUser.id).maybeSingle();
    viewerData = { ...authUser, ...vRow };
  }

  // 2. Resolve Target User
  let targetUser = null;
  try {
    if (targetUsername) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, username, avatar_url, userrank, created_at')
        .eq('username', targetUsername)
        .maybeSingle();
      if (error || !data) throw new Error('User not found');
      targetUser = data;
    } else {
      // No param? Show own profile
      if (!viewerData) {
        usernameEl.textContent = 'Please Login';
        return;
      }
      targetUser = { ...viewerData, ...authUser };
    }
  } catch (err) {
    usernameEl.textContent = 'User Not Found';
    return;
  }

  const isOwner = authUser && authUser.id === targetUser.id;
  const isStaff = viewerData && (viewerData.role === 'admin' || viewerData.role === 'owner');

  // 3. Populate Basic Info
  usernameEl.textContent = targetUser.username;
  document.getElementById('profile-role-text').textContent = targetUser.userrank || targetUser.role.toUpperCase();
  document.getElementById('profile-joined').textContent = formatDate(targetUser.created_at);
  if (document.getElementById('info-uid')) document.getElementById('info-uid').textContent = targetUser.id.substring(0, 8);

  // Avatar
  const avatarContainer = document.getElementById('profile-avatar');
  if (targetUser.avatar_url) {
    avatarContainer.innerHTML = `<img src="${targetUser.avatar_url}" id="profile-avatar-img" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
  }

  // 4. Privacy Control
  if (isOwner) {
    document.getElementById('profile-email-row').style.display = 'flex';
    document.getElementById('profile-email').textContent = targetUser.email;
    document.getElementById('profile-uid-row').style.display = 'flex';
    document.getElementById('avatar-edit-row').style.display = 'flex';
    if (document.getElementById('avatar-url-input')) document.getElementById('avatar-url-input').value = targetUser.avatar_url || '';
  }

  // 5. Staff Actions
  if (isStaff && !isOwner) {
    document.getElementById('staff-profile-actions').style.display = 'block';
  }

  // 6. Fetch Stats & Activity
  const [{ data: threads }, { data: replies }, { data: likesReceived }] = await Promise.all([
    supabase.from('threads').select('id, title, tag, created_at').eq('author', targetUser.username).order('created_at', { ascending: false }),
    supabase.from('thread_replies').select('id, thread_id, content, created_at').eq('author', targetUser.username).order('created_at', { ascending: false }),
    supabase.from('thread_likes').select('id').eq('author_username', targetUser.username) // Assuming author_username exists or mapping from thread_id
  ]);

  // Stat Cards
  document.getElementById('stat-threads').textContent = threads?.length || 0;
  document.getElementById('stat-replies').textContent = replies?.length || 0;
  document.getElementById('stat-likes').textContent = likesReceived?.length || 0;
  document.getElementById('profile-likes-total').textContent = likesReceived?.length || 0;

  // Threads List
  const tList = document.getElementById('profile-threads-list');
  tList.innerHTML = '';
  if (!threads?.length) {
    tList.innerHTML = '<li class="meta">No threads created yet.</li>';
  } else {
    threads.slice(0, 5).forEach((t, i) => {
      const li = document.createElement('li');
      li.className = 'thread-anim';
      li.style.animationDelay = `${i * 0.1}s`;
      li.innerHTML = `
        <a href="thread.html?id=${t.id}"><span class="badge-pill">${t.tag || 'Thread'}</span> ${t.title}</a>
        <div class="meta">Posted on ${formatDate(t.created_at)}</div>
      `;
      tList.appendChild(li);
    });
  }

  // Activity: Same for replies...
  const rList = document.getElementById('profile-replies-list');
  rList.innerHTML = '';
  if (!replies?.length) {
    rList.innerHTML = '<li class="meta">No recent replies.</li>';
  } else {
    replies.slice(0, 5).forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'thread-anim';
      li.style.animationDelay = `${i * 0.1}s`;
      li.innerHTML = `
        <a href="thread.html?id=${r.thread_id}">Replied to thread #${r.thread_id}</a>
        <div class="meta">${formatDate(r.created_at)}</div>
      `;
      rList.appendChild(li);
    });
  }
}

// 7. Avatar Update Logic
async function setupAvatarUpdate() {
  const saveBtn = document.getElementById('avatar-url-save');
  const input = document.getElementById('avatar-url-input');
  const status = document.getElementById('avatar-url-status');
  if (!saveBtn || !input) return;

  saveBtn.onclick = async () => {
    const url = input.value.trim();
    if (!url) return;
    status.textContent = 'Saving...';
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
    if (error) {
       status.textContent = 'Error saving.';
    } else {
       status.textContent = 'Saved! Refreshing...';
       setTimeout(() => window.location.reload(), 1000);
    }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  setupAvatarUpdate();
});