// shoutboxmanager.js
// Requires window.supabaseClient and window.getCurrentUserWithRole from scripts.js

const shoutInput  = document.getElementById('shout-input');
const shoutSendBtn = document.getElementById('shout-send');
const shoutBox    = document.getElementById('shoutbox-messages');
const shoutForm   = document.getElementById('shoutbox-form');
const shoutMeta   = document.getElementById('shoutbox-meta');
const shoutFooter = document.getElementById('shoutbox-footer');

let lastShoutTimestamp = null;

// --- small helper: render one shout line ---
async function renderShout(row, currentUser) {
  if (!shoutBox) return;

  const line = document.createElement('div');
  line.className = 'shout-line';

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
}

// --- load last 50 shouts ---
async function loadShouts(currentUser) {
  if (!shoutBox || !window.supabaseClient) return;
  const supabaseClient = window.supabaseClient;

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
  (data || []).slice().reverse().forEach((row) => renderShout(row, currentUser));
  shoutBox.scrollTop = shoutBox.scrollHeight;

  if (data && data.length > 0) {
    lastShoutTimestamp = data[0].created_at;
  }
}

// --- optional: cheap polling for new shouts ---
async function hasNewShouts() {
  if (!lastShoutTimestamp || !window.supabaseClient) return true;
  const supabaseClient = window.supabaseClient;

  const { data, error } = await supabaseClient
    .from('shouts')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('hasNewShouts error', error);
    return false;
  }
  if (!data || !data.length) return false;

  const latest = data[0].created_at;
  return new Date(latest) > new Date(lastShoutTimestamp);
}

// --- main setup function ---
async function setupShoutbox() {
  if (!shoutInput || !shoutSendBtn || !shoutBox || !shoutForm) return;
  if (!window.getCurrentUserWithRole || !window.supabaseClient) return;

  const supabaseClient = window.supabaseClient;
  const me = await window.getCurrentUserWithRole();

  if (!me) {
    // guest
    shoutInput.disabled = true;
    shoutSendBtn.disabled = true;
    if (shoutFooter) shoutFooter.textContent = 'Login to chat in the shoutbox.';
  } else {
    if (shoutMeta) {
      shoutMeta.textContent = `Logged in as ${me.username} · live chat`;
    }
  }

  await loadShouts(me);

  // poll every 10s for new shouts
  setInterval(async () => {
    try {
      const changed = await hasNewShouts();
      if (changed) await loadShouts(me);
    } catch (e) {
      console.error('shoutbox poll error', e);
    }
  }, 10000);

  // realtime optional (if you still want it)
  supabaseClient
    .channel('public:shouts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'shouts' },
      (payload) => {
        renderShout(payload.new, me);
        shoutBox.scrollTop = shoutBox.scrollHeight;
      }
    )
    .subscribe();

  // submit handler – always use users.username
  shoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const meNow = await window.getCurrentUserWithRole();
    if (!meNow) return;

    const text = shoutInput.value.trim();
    if (!text) return;
    if (text.length > 180) return;

    const msg = text;
    shoutInput.value = '';

    try {
      const { error } = await supabaseClient
        .from('shouts')
        .insert({
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupShoutbox);
} else {
  setupShoutbox();
}