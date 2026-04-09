// avatars.js
// Simple helper to pull avatar URL from content or profile and set <img> srcs.

/**
 * Extract avatar URL from a BBCode tag like:
 *   [avatar=https://example.com/image.png]
 * Only first occurrence is used.
 */
export function extractAvatarUrlFromText(text) {
  if (!text) return null;
  const match = text.match(/\[avatar=(https?:\/\/[^\]\s]+)\]/i);
  return match ? match[1] : null;
}

/**
 * Apply an avatar URL to an <img> if present.
 */
export function applyAvatarToImage(imgEl, url) {
  if (!imgEl || !url) return;
  imgEl.src = url;
}

/**
 * Initialise avatar for single thread view.
 * - Looks for [avatar=URL] in thread content string
 * - If found, sets #thread-avatar-img src
 */
export function initThreadAvatar(threadContent) {
  const imgEl = document.getElementById('thread-avatar-img');
  if (!imgEl) return;

  const url = extractAvatarUrlFromText(threadContent);
  if (!url) return;

  applyAvatarToImage(imgEl, url);
}

/**
 * Initialise avatar on create-thread page.
 * - Looks for [avatar=URL] inside the editor textarea.
 * - Useful if you want live preview later (optional).
 */
export function initCreateThreadAvatar() {
  const imgEl = document.getElementById('create-thread-avatar-img');
  const textarea = document.getElementById('thread-content');
  if (!imgEl || !textarea) return;

  // initial scan
  let url = extractAvatarUrlFromText(textarea.value);
  if (url) applyAvatarToImage(imgEl, url);

  // optional: update when user types
  textarea.addEventListener('input', () => {
    const found = extractAvatarUrlFromText(textarea.value);
    if (found) applyAvatarToImage(imgEl, found);
  });
}