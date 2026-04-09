// threadcreation.js

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
      const btn = e.target.closest('.toolbar-btn[data-format]');
      if (!btn) return;

      const format = btn.dataset.format;
      e.preventDefault();

      if (format === 'bold') wrapSelectionInTag(contentEl, '[b]', '[/b]');
      if (format === 'italic') wrapSelectionInTag(contentEl, '[i]', '[/i]');
      if (format === 'underline') wrapSelectionInTag(contentEl, '[u]', '[/u]');
    });
  }

  if (hideBtn) {
    hideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      wrapSelectionInTag(contentEl, '[HIDDEN]', '[/HIDDEN]');
    });
  }
}

function initForm() {
  const form      = document.getElementById('new-thread-form');
  const statusEl  = document.getElementById('thread-status');
  const submitBtn = document.getElementById('thread-submit');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title   = document.getElementById('thread-title')?.value.trim()   || '';
    const tag     = document.getElementById('thread-tag')?.value            || '';
    const content = document.getElementById('thread-content')?.value.trim() || '';

    const author  = window.currentUser?.username || '';   // from Supabase / global

    if (!title || !tag || !author || !content) {
      if (statusEl) statusEl.textContent = 'Missing title, tag, content or user.';
      return;
    }

    if (statusEl) statusEl.textContent = 'Creating thread...';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-disabled');
    }

    const payload = {
      title,
      tag,
      author,
      content,
      section: 'accounts'
    };

    try {
      const res = await fetch('/api/create-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
      console.error('create-thread error:', err);
      if (statusEl) statusEl.textContent = 'Server error. Try again.';
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function initUserHeader() {
  if (!window.currentUser) return;

  const nameEl  = document.getElementById('user-name-display');
  const rankEl  = document.getElementById('user-rank-text');
  const badgeEl = document.getElementById('user-rank-badge');

  if (nameEl) nameEl.textContent = window.currentUser.username || 'User';
  if (rankEl) rankEl.textContent = window.currentUser.rank || 'Member';

  if (badgeEl) {
    badgeEl.classList.remove('rank-admin','rank-member');
    const rank = (window.currentUser.rank || 'member').toLowerCase();
    const icon = badgeEl.querySelector('i');

    if (rank === 'admin' || rank === 'owner' || rank === 'staff') {
      badgeEl.classList.add('rank-admin');
      if (icon) icon.className = 'fa fa-shield-halved';
    } else {
      badgeEl.classList.add('rank-member');
      if (icon) icon.className = 'fa fa-user';
    }
  }
}

function initCreateThreadPage() {
  initToolbar();
  initForm();
  initUserHeader();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCreateThreadPage);
} else {
  initCreateThreadPage();
}