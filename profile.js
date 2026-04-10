import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// global current user for other scripts (threadcreation.js, thread page etc.)
window.currentUser = null;

// --- helper: current user + role + avatar_url from public.users ---
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

  const avatarSrc = current.avatar_url || 'images/default-avatar.png';

  authLinks.innerHTML = `
    <button class="user-pill" id="header-profile-link">
      <img src="${avatarSrc}" class="user-avatar-header" alt="Avatar">
      <span>${current.username}</span>
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

  const OWNER_ID = 'PUT_OWNER_USER_ID_HERE';

  function canCurrentUserDeleteShout(currentUser, row) {
    if (!currentUser) return false;

    if (currentUser.role === 'owner') return true;

    if (currentUser.role === 'admin') {
      if (row.user_id === OWNER_ID) return false;
      return true;
    }

    return row.user_id === currentUser.id;
  }

  const shoutAvatarCache = {};
  const DEFAULT_SHOUT_AVATAR = 'images/default-avatar.png';

  async function getAvatarForUser(userId) {
    if (!userId) return DEFAULT_SHOUT_AVATAR;

    if (shoutAvatarCache[userId] !== undefined) {
      return shoutAvatarCache[userId] || DEFAULT_SHOUT_AVATAR;
    }

    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('shout avatar lookup error', error);
        shoutAvatarCache[userId] = null;
        return DEFAULT_SHOUT_AVATAR;
      }

      const url = data?.avatar_url || null;
      shoutAvatarCache[userId] = url;
      return url || DEFAULT_SHOUT_AVATAR;
    } catch (e) {
      console.error('shout avatar fetch error', e);
      shoutAvatarCache[userId] = null;
      return DEFAULT_SHOUT_AVATAR;
    }
  }

  async function renderShout(row, currentUser) {
    const line = document.createElement('div');
    line.className = 'shout-line';

    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'shout-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = DEFAULT_SHOUT_AVATAR;
    avatarWrapper.appendChild(avatarImg);
    line.appendChild(avatarWrapper);

    const textContainer = document.createElement('div');

    const userSpan = document.createElement('span');
    userSpan.className = 'shout-user rank-member';

    const userLink = document.createElement('a');
    userLink.className = 'profile-username-link';
    userLink.href = 'profile.html?u=' + encodeURIComponent(row.username);
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

    getAvatarForUser(row.user_id).then((url) => {
      avatarImg.src = url || DEFAULT_SHOUT_AVATAR;
    });

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
    }, 1000);

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

  function formatDateShortLocal(iso) {
    const d = new Date(iso);
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${dd}/${mm} ${hh}:${min}`;
  }

  // ... keep your thread list + single thread code unchanged ...

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

  function getProfileQueryParam(name) {
    const url = new URL(window.location.href);
    const v = url.searchParams.get(name);
    return v ? v.trim() : null;
  }

  function mapProfileRoleToLabel(role, userrank) {
    if (userrank && userrank.trim()) return userrank;
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'admin':
        return 'Admin';
      default:
        return 'Member';
    }
  }

  if (profileUsernameEl && profileRoleTextEl) {
    (async () => {
      const paramUsername = getProfileQueryParam('u');

      const { data: authData } = await supabaseClient.auth.getUser();
      const authUser = authData?.user || null;

      let userRow = null;
      let viewingOwnProfile = false;

      try {
        if (paramUsername) {
          const { data, error } = await supabaseClient
            .from('users')
            .select('id, email, role, username, avatar_url, userrank, created_at')
            .eq('username', paramUsername)
            .maybeSingle();
          if (error) throw error;
          if (!data) {
            profileUsernameEl.textContent = 'Profile not found';
            return;
          }
          userRow = data;
          viewingOwnProfile = !!(authUser && authUser.id === userRow.id);
        } else {
          if (!authUser) {
            profileUsernameEl.textContent = 'Not logged in';
            return;
          }
          const { data, error } = await supabaseClient
            .from('users')
            .select('id, email, role, username, avatar_url, userrank, created_at')
            .eq('id', authUser.id)
            .maybeSingle();
          if (error) throw error;
          if (!data) {
            profileUsernameEl.textContent = 'Profile not found';
            return;
          }
          userRow = data;
          viewingOwnProfile = true;
        }
      } catch (e) {
        console.error('profile load error', e);
        profileUsernameEl.textContent = 'Error loading profile';
        return;
      }

      const username =
        (userRow.username && userRow.username.trim()) ||
        (userRow.email ? userRow.email.split('@')[0] : 'User');
      const roleLabel = mapProfileRoleToLabel(userRow.role, userRow.userrank);
      const avatarUrl = userRow.avatar_url || null;
      const joinedAt = userRow.created_at || null;

      profileUsernameEl.textContent = username;
      if (profileRoleTextEl) profileRoleTextEl.textContent = roleLabel;
      if (profileJoinedEl && joinedAt) profileJoinedEl.textContent = formatDateShortLocal(joinedAt);

      if (viewingOwnProfile) {
        if (profileEmailEl) profileEmailEl.textContent = userRow.email || '–';
      } else {
        if (profileEmailEl) profileEmailEl.textContent = 'Private';
      }

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
          .eq('user_id', userRow.id),
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
          li.textContent = viewingOwnProfile
            ? 'You have not created any threads yet.'
            : 'No threads yet.';
          profileThreadsList.appendChild(li);
        } else {
          threads.slice(0, 5).forEach((t) => {
            const li = document.createElement('li');
            li.innerHTML = `
              <a href="thread.html?id=${t.id}">
                <span class="badge-pill">${t.tag}</span>${t.title}
              </a>
              <div class="meta">Posted ${formatDateShortLocal(t.created_at)}</div>
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
              <div class="meta">${formatDateShortLocal(r.created_at)}</div>
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
              <div class="meta">${formatDateShortLocal(lk.created_at)}</div>
            `;
            profileLikesList.appendChild(li);
          });
        }
      }

      const avatarInput = document.getElementById('avatar-url-input');
      const avatarSave = document.getElementById('avatar-url-save');
      const avatarStatus = document.getElementById('avatar-url-status');

      if (!viewingOwnProfile) {
        if (avatarInput) {
          avatarInput.disabled = true;
          avatarInput.placeholder = 'Only the user can change their avatar.';
        }
        if (avatarSave) avatarSave.disabled = true;
        if (avatarStatus) avatarStatus.textContent = 'Read‑only profile.';
        return;
      }

      if (avatarInput && avatarSave && avatarEl) {
        if (avatarUrl) avatarInput.value = avatarUrl;

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
              .eq('id', userRow.id);
            if (upError) throw upError;

            avatarEl.innerHTML = '';
            const img = document.createElement('img');
            img.id = 'profile-avatar-img';
            img.src = url;
            avatarEl.appendChild(img);

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
        .select('email, role, username, avatar_url')
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
          u.role === 'owner'
            ? 'Owner'
            : u.role === 'admin'
            ? 'Admin'
            : u.role || 'Staff';

        const avatarSrc = u.avatar_url || 'images/default-avatar.png';

        line.innerHTML = `
          <span class="staff-avatar">
            <img src="${avatarSrc}" alt="${displayName}" class="user-avatar-header">
          </span>
          <span class="staff-name">
            <a
              href="profile.html?u=${encodeURIComponent(displayName)}"
              class="profile-username-link"
            >${displayName}</a>
          </span>
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
    if (!el) return;

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