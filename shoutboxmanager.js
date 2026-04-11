// shoutboxmanager.js - PREMIUM REBUILD
// Integrated with window.supabaseClient and window.getCurrentUserWithRole

const shoutInput  = document.getElementById('shout-input');
const shoutSendBtn = document.getElementById('shout-send');
const shoutBox    = document.getElementById('shoutbox-messages');
const shoutForm   = document.getElementById('shoutbox-form');
const shoutMeta   = document.getElementById('shoutbox-meta');
const shoutFooter = document.getElementById('shoutbox-footer');

let lastShoutTimestamp = null;
let currentUserCached = null;

// Palette for avatars and BBCode
const DS_PALETTE = {
  emerald: '#10b981',
  purple: '#818cf8',
  blue: '#0ea5e9',
  gold: '#f59e0b',
  red: '#ef4444',
  silver: '#adbac7'
};

/**
 * Clean & Safe BBCode Parser
 */
function parseBBCode(text) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Formatting [b], [i]
  escaped = escaped.replace(/\[b\](.*?)\[\/b\]/gis, '<b>$1</b>');
  escaped = escaped.replace(/\[i\](.*?)\[\/i\]/gis, '<i>$1</i>');
  
  // Custom colors
  escaped = escaped.replace(/\[color=([a-z]+)\](.*?)\[\/color\]/gis, (m, c, content) => {
    const hex = DS_PALETTE[c.toLowerCase()] || DS_PALETTE.silver;
    return `<span style="color: ${hex}">${content}</span>`;
  });

  // Highlighted Mentions
  escaped = escaped.replace(/@([a-zA-Z0-9_-]+)/g, '<span style="color:#818cf8; font-weight:700; text-shadow:0 0 5px rgba(129,140,248,0.3)">@$1</span>');

  return escaped;
}

function getAvatarColor(username) {
  const colors = ['#818cf8', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function createShoutContextMenu() {
  let menu = document.getElementById('ds-context-menu');
  if (menu) return menu;
  menu = document.createElement('div');
  menu.id = 'ds-context-menu';
  menu.className = 'ds-context-menu';
  document.body.appendChild(menu);
  document.addEventListener('click', () => menu.style.display = 'none');
  return menu;
}

async function renderShout(row, currentUser) {
  if (!shoutBox) return;

  const me = currentUserCached || currentUser;
  const isMentioned = me && row.message.toLowerCase().includes(`@${me.username.toLowerCase()}`);

  // Base Item
  const item = document.createElement('div');
  item.className = 'ds-shout-item' + (isMentioned ? ' mention' : '');

  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'ds-shout-avatar';
  avatar.textContent = (row.username || '?')[0].toUpperCase();
  avatar.style.borderColor = getAvatarColor(row.username || 'guest');
  avatar.style.color = getAvatarColor(row.username || 'guest');

  // Content Wrap
  const content = document.createElement('div');
  content.className = 'ds-shout-content';

  // Top Bar (User + Time)
  const topBar = document.createElement('div');
  topBar.className = 'ds-line-top';

  const userLink = document.createElement('a');
  userLink.className = 'ds-shout-user';
  userLink.href = 'profile.html?u=' + encodeURIComponent(row.username);
  userLink.textContent = row.username;
  userLink.style.cursor = 'contextmenu';

  // Special Owner Glow
  if (row.username === 'ColdFusionz') {
     userLink.style.color = '#818cf8';
     userLink.style.textShadow = '0 0 8px rgba(129, 140, 248, 0.5)';
  }

  const time = document.createElement('span');
  time.className = 'ds-shout-time';
  const d = new Date(row.created_at);
  time.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  topBar.appendChild(userLink);
  topBar.appendChild(time);

  // Message Text
  const text = document.createElement('div');
  text.className = 'ds-shout-text';
  text.innerHTML = parseBBCode(row.message);

  content.appendChild(topBar);
  content.appendChild(text);

  item.appendChild(avatar);
  item.appendChild(content);

  shoutBox.appendChild(item);

  // --- Context Menu (Right Click Username) ---
  userLink.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const menu = createShoutContextMenu();
    menu.innerHTML = '';

    const mentionAction = document.createElement('div');
    mentionAction.className = 'ds-context-item';
    mentionAction.innerHTML = `<i class="fa fa-at"></i> Mention @${row.username}`;
    mentionAction.onclick = () => {
      shoutInput.value = `@${row.username} ` + shoutInput.value;
      shoutInput.focus();
    };
    menu.appendChild(mentionAction);

    if (me && (me.role === 'admin' || me.role === 'owner' || me.id === row.user_id)) {
      const del = document.createElement('div');
      del.className = 'ds-context-item delete';
      del.innerHTML = `<i class="fa fa-trash"></i> Delete message`;
      del.onclick = async () => {
        if (!confirm('Delete this message?')) return;
        const { error } = await window.supabaseClient.from('shouts').delete().eq('id', row.id);
        if (!error) item.remove();
      };
      menu.appendChild(del);
    }

    menu.style.display = 'block';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
  });

  // Scroll to bottom
  shoutBox.scrollTop = shoutBox.scrollHeight;
}

async function loadShouts(currentUser) {
  if (!shoutBox || !window.supabaseClient) return;
  const { data, error } = await window.supabaseClient.from('shouts').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return;
  shoutBox.innerHTML = '';
  (data || []).slice().reverse().forEach(row => renderShout(row, currentUser));
  if (data && data.length) lastShoutTimestamp = data[0].created_at;
}

async function hasNewShouts() {
  if (!lastShoutTimestamp || !window.supabaseClient) return true;
  const { data, error } = await window.supabaseClient.from('shouts').select('created_at').order('created_at', { ascending: false }).limit(1);
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
    if (shoutFooter) shoutFooter.textContent = 'Login to participate in community chat.';
  } else {
    if (shoutMeta) shoutMeta.textContent = `Live Chat · Logged in as ${me.username}`;
    if (shoutFooter) shoutFooter.textContent = 'Keep it chill. No spam or advertising.';
  }

  await loadShouts(me);

  // Poll for safety
  setInterval(async () => {
    if (await hasNewShouts()) await loadShouts(me);
  }, 20000);

  // Realtime
  window.supabaseClient.channel('public:shouts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shouts' }, (p) => {
    renderShout(p.new, me);
  }).subscribe();

  shoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const meNow = await window.getCurrentUserWithRole();
    if (!meNow) return;
    const t = shoutInput.value.trim();
    if (!t || t.length > 180) return;
    shoutInput.value = '';
    const { error } = await window.supabaseClient.from('shouts').insert({ user_id: meNow.id, username: meNow.username, message: t });
    if (error) console.error(error);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupShoutbox);
else setupShoutbox();