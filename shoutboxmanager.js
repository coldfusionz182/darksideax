// shoutboxmanager.js
// Requires window.supabaseClient and window.getCurrentUserWithRole from scripts.js

const shoutInput  = document.getElementById('shout-input');
const shoutSendBtn = document.getElementById('shout-send');
const shoutBox    = document.getElementById('shoutbox-messages');
const shoutForm   = document.getElementById('shoutbox-form');
const shoutMeta   = document.getElementById('shoutbox-meta');
const shoutFooter = document.getElementById('shoutbox-footer');

let lastShoutTimestamp = null;
let currentUserCached = null;

const OWNER_ID = 'PUT_OWNER_USER_ID_HERE';

// DARKSIDE COLOR PALETTE
const DARKSIDE_PALETTE = {
  emerald: '#10b981',
  purple: '#6366f1',
  blue: '#0ea5e9',
  gold: '#f59e0b',
  red: '#ef4444',
  silver: '#adbac7'
};

/**
 * Parses BBCode into clean, safe HTML
 * Specifically designed for the Darkside palette
 */
function parseBBCode(text) {
  if (!text) return '';
  
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // [b]...[/b]
  escaped = escaped.replace(/\[b\](.*?)\[\/b\]/gis, '<b>$1</b>');
  // [i]...[/i]
  escaped = escaped.replace(/\[i\](.*?)\[\/i\]/gis, '<i>$1</i>');
  
  // [color=name]...[/color]
  escaped = escaped.replace(/\[color=([a-z]+)\](.*?)\[\/color\]/gis, (match, color, content) => {
    const hex = DARKSIDE_PALETTE[color.toLowerCase()] || DARKSIDE_PALETTE.silver;
    return `<span style="color: ${hex}; text-shadow: 0 0 5px ${hex}44;">${content}</span>`;
  });

  // Mentions (@user)
  escaped = escaped.replace(/@([a-zA-Z0-9_-]+)/g, '<span style="color:#818cf8; font-weight:700; text-shadow: 0 0 8px rgba(129, 140, 248, 0.4);">@$1</span>');

  return escaped;
}

function canCurrentUserDeleteShout(currentUser, row) {
  if (!currentUser) return false;
  if (currentUser.role === 'owner') return true;
  if (currentUser.role === 'admin') {
    if (row.user_id === OWNER_ID) return false;
    return true;
  }
  return row.user_id === currentUser.id;
}

function createShoutContextMenu() {
  let menu = document.getElementById('shout-context-menu');
  if (menu) return menu;

  menu = document.createElement('div');
  menu.id = 'shout-context-menu';
  menu.className = 'shout-context-menu';
  document.body.appendChild(menu);

  document.addEventListener('click', () => {
    menu.style.display = 'none';
  });

  return menu;
}

// --- small helper: render one shout line ---
async function renderShout(row, currentUser) {
  if (!shoutBox) return;

  const me = currentUserCached || currentUser;
  const isMentioned = me && row.message.toLowerCase().includes(`@${me.username.toLowerCase()}`);

  const line = document.createElement('div');
  line.className = 'shout-line' + (isMentioned ? ' mention' : '');

  const header = document.createElement('div');
  header.className = 'shout-header';

  const userSpan = document.createElement('span');
  userSpan.className = 'shout-user';
  userSpan.style.cursor = 'contextmenu';
  
  const userLink = document.createElement('a');
  userLink.className = 'profile-username-link';
  userLink.href = 'profile.html?u=' + encodeURIComponent(row.username);
  userLink.textContent = row.username;
  
  // Staff coloring
  if (row.username === 'ColdFusionz') {
     userLink.style.color = '#818cf8';
     userLink.style.textShadow = `0 0 10px rgba(129, 140, 248, 0.6)`;
  }

  const timeSpan = document.createElement('span');
  timeSpan.className = 'shout-time';
  const d = new Date(row.created_at);
  timeSpan.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  header.appendChild(userSpan);
  userSpan.appendChild(userLink);
  header.appendChild(timeSpan);

  const textDiv = document.createElement('div');
  textDiv.className = 'shout-text';
  textDiv.innerHTML = parseBBCode(row.message);

  line.appendChild(header);
  line.appendChild(textDiv);
  shoutBox.appendChild(line);

  // --- Context Menu Logic ---
  userSpan.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const menu = createShoutContextMenu();
    menu.innerHTML = '';

    // Mention Action
    const mentionItem = document.createElement('div');
    mentionItem.className = 'shout-context-item';
    mentionItem.innerHTML = `<i class="fa fa-at"></i> Mention @${row.username}`;
    mentionItem.onclick = () => {
      shoutInput.value = `@${row.username} ` + shoutInput.value;
      shoutInput.focus();
    };
    menu.appendChild(mentionItem);

    // Delete Action
    if (me && canCurrentUserDeleteShout(me, row)) {
      const deleteItem = document.createElement('div');
      deleteItem.className = 'shout-context-item delete';
      deleteItem.innerHTML = `<i class="fa fa-trash"></i> Delete message`;
      deleteItem.onclick = async () => {
        if (!confirm('Delete this message?')) return;
        const { error } = await window.supabaseClient.from('shouts').delete().eq('id', row.id);
        if (!error) line.remove();
      };
      menu.appendChild(deleteItem);
    }

    menu.style.display = 'block';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
  });
}

// --- load last 50 shouts ---
async function loadShouts(currentUser) {
  if (!shoutBox || !window.supabaseClient) return;
  const { data, error } = await window.supabaseClient
    .from('shouts')
    .select('id, user_id, username, message, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return;
  shoutBox.innerHTML = '';
  (data || []).slice().reverse().forEach((row) => renderShout(row, currentUser));
  shoutBox.scrollTop = shoutBox.scrollHeight;
  if (data && data.length > 0) lastShoutTimestamp = data[0].created_at;
}

async function hasNewShouts() {
  if (!lastShoutTimestamp || !window.supabaseClient) return true;
  const { data, error } = await window.supabaseClient
    .from('shouts')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || !data.length) return false;
  return new Date(data[0].created_at) > new Date(lastShoutTimestamp);
}

async function setupShoutbox() {
  if (!shoutInput || !shoutSendBtn || !shoutBox || !shoutForm) return;
  const me = await window.getCurrentUserWithRole();
  currentUserCached = me;

  if (!me) {
    shoutInput.disabled = true;
    shoutSendBtn.disabled = true;
    if (shoutFooter) shoutFooter.textContent = 'Login to chat in the shoutbox.';
  } else {
    if (shoutMeta) shoutMeta.textContent = `Community Chat · Logged in as ${me.username}`;
  }

  await loadShouts(me);

  setInterval(async () => {
    if (await hasNewShouts()) await loadShouts(me);
  }, 15000);

  window.supabaseClient
    .channel('public:shouts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shouts' }, (payload) => {
        renderShout(payload.new, me);
        shoutBox.scrollTop = shoutBox.scrollHeight;
    })
    .subscribe();

  shoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const meNow = await window.getCurrentUserWithRole();
    if (!meNow) return;

    const text = shoutInput.value.trim();
    if (!text || text.length > 180) return;
    shoutInput.value = '';

    try {
      const { data, error } = await window.supabaseClient
        .from('shouts')
        .insert({ user_id: meNow.id, username: meNow.username, message: text })
        .select().single();
      if (!error) {
        // payload comes via realtime broadcase too, but immediate UI is nicer
      }
    } catch (err) { console.error(err); }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupShoutbox);
} else {
  setupShoutbox();
}