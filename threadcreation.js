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

  const toolbar = document.querySelector('.editor-toolbar');
  const hideBtn = document.getElementById('btn-hide-text');

  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('.toolbar-btn');
      if (!btn) return;

      const format = btn.dataset.format;
      e.preventDefault();

      if (format === 'bold') {
        wrapSelectionInTag(contentEl, '[b]', '[/b]');
      } else if (format === 'italic') {
        wrapSelectionInTag(contentEl, '[i]', '[/i]');
      } else if (format === 'underline') {
        wrapSelectionInTag(contentEl, '[u]', '[/u]');
      } else if (format === 'link') {
        // create hyperlink
        const start = contentEl.selectionStart;
        const end   = contentEl.selectionEnd;
        if (start === end) {
          // no selection – nothing to link
          return;
        }

        const url = prompt('Enter URL (including https://):', 'https://');
        if (!url || !url.trim()) return;

        const value    = contentEl.value;
        const selected = value.substring(start, end);
        const before   = value.substring(0, start);
        const after    = value.substring(end);

        const wrapped = `[url=${url.trim()}]${selected}[/url]`;
        contentEl.value = before + wrapped + after;
        contentEl.focus();
        contentEl.setSelectionRange(start, start + wrapped.length);
      }
    });
  }

  if (hideBtn) {
    hideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      wrapSelectionInTag(contentEl, '[HIDDEN]', '[/HIDDEN]');
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