// threadcreation.js
// Wrap selection with [HIDDEN] tags + simple BBCode tools + POST /api/create-thread.

function wrapSelectionInTag(textarea, openTag, closeTag) {
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  if (start === undefined || end === undefined || start === end) return;

  const value    = textarea.value;
  const selected = value.substring(start, end);
  const before   = value.substring(0, start);
  const after    = value.substring(end);

  const wrapped = `${openTag}${selected}${closeTag}`;
  textarea.value = before + wrapped + after;

  textarea.focus();
  textarea.setSelectionRange(start, start + wrapped.length);
}

function initToolbar() {
  const contentEl = document.getElementById('thread-content');
  if (!contentEl) return;

  const toolbar      = document.querySelector('.editor-toolbar');
  const hideBtn      = document.getElementById('btn-hide-text');
  const colorBtn     = document.getElementById('btn-color');
  const colorPalette = document.getElementById('color-palette');

  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.toolbar-btn');
      if (!btn) return;

      const format = btn.dataset.format;
      if (!format) return;
      e.preventDefault();

      if (format === 'bold') {
        wrapSelectionInTag(contentEl, '[b]', '[/b]');
      } else if (format === 'italic') {
        wrapSelectionInTag(contentEl, '[i]', '[/i]');
      } else if (format === 'underline') {
        wrapSelectionInTag(contentEl, '[u]', '[/u]');
      } else if (format === 'link') {
        // existing link logic if you added it
      } else if (format === 'color') {
        // toggle palette just under the button
        if (!colorPalette) return;
        if (colorPalette.style.display === 'block') {
          colorPalette.style.display = 'none';
          return;
        }

        const rect = btn.getBoundingClientRect();
        colorPalette.style.left = rect.left + 'px';
        colorPalette.style.top  = rect.bottom + 4 + 'px';
        colorPalette.style.display = 'block';

        // remember selection so we can apply colour after click
        contentEl.focus();
      }
    });
  }

  if (hideBtn) {
    hideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      wrapSelectionInTag(contentEl, '[HIDDEN]', '[/HIDDEN]');
    });
  }

  if (colorPalette) {
    colorPalette.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-color]');
      if (!btn) return;
      e.preventDefault();

      const color = btn.getAttribute('data-color');
      if (!color) return;

      const start = contentEl.selectionStart;
      const end   = contentEl.selectionEnd;
      if (start === undefined || end === undefined || start === end) {
        // no selection – nothing to colour
        colorPalette.style.display = 'none';
        return;
      }

      const value    = contentEl.value;
      const selected = value.substring(start, end);
      const before   = value.substring(0, start);
      const after    = value.substring(end);

      const openTag  = `[color=${color}]`;
      const closeTag = '[/color]';
      const wrapped  = `${openTag}${selected}${closeTag}`;

      contentEl.value = before + wrapped + after;
      contentEl.focus();
      contentEl.setSelectionRange(start, start + wrapped.length);

      colorPalette.style.display = 'none';
    });

    // click outside to close
    document.addEventListener('click', (e) => {
      if (!colorPalette.contains(e.target) && e.target !== colorBtn) {
        colorPalette.style.display = 'none';
      }
    });
  }
}

function initUserHeader() {
  const user = window.currentUser;
  if (!user) return; // set by scripts.js / getCurrentUserWithRole

  const nameEl  = document.getElementById('user-name-display');
  const rankEl  = document.getElementById('user-rank-text');
  const badgeEl = document.getElementById('user-rank-badge');

  if (nameEl) nameEl.textContent = user.username || 'User';
  if (rankEl) rankEl.textContent = user.role || 'member';

  if (badgeEl) {
    badgeEl.classList.remove('rank-admin','rank-member');
    const role = (user.role || 'user').toLowerCase();
    const icon = badgeEl.querySelector('i');

    if (role === 'admin' || role === 'owner' || role === 'staff') {
      badgeEl.classList.add('rank-admin');
      if (icon) icon.className = 'fa fa-shield-halved';
    } else {
      badgeEl.classList.add('rank-member');
      if (icon) icon.className = 'fa fa-user';
    }
  }
}

function initForm() {
  const form      = document.getElementById('new-thread-form');
  const statusEl  = document.getElementById('thread-status');
  const submitBtn = document.getElementById('thread-submit');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user   = window.currentUser;
    const author = user?.username || '';
    const title   = document.getElementById('thread-title')?.value.trim()   || '';
    const tag     = document.getElementById('thread-tag')?.value            || '';
    const content = document.getElementById('thread-content')?.value.trim() || '';

    if (!author) {
      if (statusEl) statusEl.textContent = 'You must be logged in to post.';
      return;
    }

    if (!title || !tag || !content) {
      if (statusEl) statusEl.textContent = 'Please fill in title, tag and message.';
      return;
    }

    if (statusEl) statusEl.textContent = 'Creating thread...';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-disabled');
    }

    const payload = { title, tag, author, content, section: 'accounts' };

    try {
      const res = await fetch('/api/create-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (statusEl) statusEl.textContent = json.error || 'Error creating thread.';
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      if (statusEl) statusEl.textContent = 'Thread created. Redirecting...';

      const threadId = json.thread?.id;
      setTimeout(() => {
        if (threadId) {
          window.location.href = `thread.html?id=${encodeURIComponent(threadId)}`;
        } else {
          window.location.href = 'accounts.html';
        }
      }, 800);
    } catch (err) {
      console.error('create-thread error', err);
      if (statusEl) statusEl.textContent = 'Server error. Try again.';
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function initCreateThreadPage() {
  initToolbar();

  // give scripts.js a moment to populate window.currentUser
  setTimeout(() => {
    initUserHeader();
    initForm();
  }, 200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCreateThreadPage);
} else {
  initCreateThreadPage();
}