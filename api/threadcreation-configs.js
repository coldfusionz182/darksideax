// threadcreation-configs.js
const form = document.getElementById('new-thread-form');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('thread-title').value.trim();
    const tag = document.getElementById('thread-tag').value.trim();
    const content = document.getElementById('thread-content').value.trim();
    const statusEl = document.getElementById('thread-status');

    const author = window.currentUser?.username || 'Anonymous';

    statusEl.textContent = 'Creating config thread...';

    try {
      const resp = await fetch('/api/create-config-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, tag, author, content }),
      });

      const json = await resp.json();

      if (!resp.ok || !json.success) {
        statusEl.textContent = json.error || 'Failed to create config thread.';
        return;
      }

      window.location.href = 'configs.html';
    } catch (err) {
      console.error('create-config-thread error', err);
      statusEl.textContent = 'Network error creating config thread.';
    }
  });
}