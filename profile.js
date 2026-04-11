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
  const targetParam = getParam('u');
  const usernameEl = document.getElementById('profile-username');
  if (!usernameEl) return;

  // 1. Resolve Identity
  let targetUser = null;
  const { data: { user: authUser } } = await supabase.auth.getUser();

  try {
    let profileId = null;
    let usernameString = null;

    if (targetParam) {
      // Lookup by username in profiles
      const { data: profileRow, error: pErr } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', targetParam)
        .maybeSingle();

      if (pErr || !profileRow) throw new Error('User not found');
      profileId = profileRow.id;
      usernameString = profileRow.username;
    } else {
      // Default to own profile
      if (!authUser) {
        usernameEl.textContent = 'Please Login';
        return;
      }
      profileId = authUser.id;
      const { data: profileRow } = await supabase.from('profiles').select('username').eq('id', authUser.id).maybeSingle();
      usernameString = profileRow?.username || authUser.email;
    }

    // Now get the actual user data (email, role, avatar)
    const { data: userData, error: uErr } = await supabase
      .from('users')
      .select('id, email, role, avatar_url, userrank, created_at')
      .eq('id', profileId)
      .maybeSingle();

    if (uErr || !userData) throw new Error('Data not found');
    targetUser = { ...userData, username: usernameString };

  } catch (err) {
    console.error('Profile Load Error:', err);
    usernameEl.textContent = 'User Not Found';
    return;
  }

  const isOwner = authUser && authUser.id === targetUser.id;
  const { data: viewerRow } = authUser ? await supabase.from('users').select('role').eq('id', authUser.id).maybeSingle() : { data: null };
  const isStaff = viewerRow && (viewerRow.role === 'admin' || viewerRow.role === 'owner');

  // 2. Populate UI
  usernameEl.textContent = targetUser.username;
  document.getElementById('profile-role-text').textContent = targetUser.userrank || targetUser.role.toUpperCase();
  document.getElementById('profile-joined').textContent = formatDate(targetUser.created_at);
  if (document.getElementById('info-uid')) document.getElementById('info-uid').textContent = targetUser.id.substring(0, 8);

  const avatarContainer = document.getElementById('profile-avatar');
  if (targetUser.avatar_url) {
    avatarContainer.innerHTML = `<img src="${targetUser.avatar_url}" id="profile-avatar-img" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
  }

  // Branding Integration
  if (targetUser.role === 'owner') usernameEl.className = 'profile-username-big ds-user-owner';
  else if (targetUser.role === 'admin') usernameEl.className = 'profile-username-big ds-user-admin';
  else usernameEl.className = 'profile-username-big ds-user-member';

  // Privacy
  if (isOwner) {
    document.getElementById('profile-email-row').style.display = 'flex';
    document.getElementById('profile-email').textContent = targetUser.email;
    document.getElementById('profile-uid-row').style.display = 'flex';
    document.getElementById('avatar-edit-row').style.display = 'flex';
    if (document.getElementById('avatar-url-input')) document.getElementById('avatar-url-input').value = targetUser.avatar_url || '';
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

  document.getElementById('stat-threads').textContent = threads?.length || 0;
  document.getElementById('stat-replies').textContent = replies?.length || 0;
  document.getElementById('stat-likes').textContent = likesGiven?.length || 0;
  document.getElementById('profile-likes-total').textContent = likesGiven?.length || 0;

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
    if (error) { status.textContent = 'Error saving.'; }
    else { status.textContent = 'Saved!'; setTimeout(() => window.location.reload(), 1000); }
  };
}

document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
  setupAvatarUpdate();
});