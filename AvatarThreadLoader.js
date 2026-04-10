// AvatarThreadLoader.js
// Loads the thread author's avatar + rank so everyone (even guests) can see it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

// Supabase client using public anon key
const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Extract avatar URL from a BBCode tag like:
 *   [avatar=https://example.com/image.png]
 * Only first occurrence is used.
 */
function extractAvatarUrlFromText(text) {
  if (!text) return null;
  const match = text.match(/\[avatar=(https?:\/\/[^\]\s]+)\]/i);
  return match ? match[1] : null;
}

/**
 * Apply an avatar URL to an <img>.
 */
function applyAvatarToImage(imgEl, url) {
  if (!imgEl || !url) return;
  imgEl.src = url;
}

/**
 * Main entry: call this after you have the thread object.
 * - thread.author  : username string (e.g. "ColdFusionz")
 * - thread.content : raw BBCode text (may contain [avatar=...])
 *
 * It will:
 * 1) Look up users.avatar_url + users.userrank by username (public select)
 * 2) Fallback to [avatar=URL] in thread.content if no avatar_url
 * 3) Fallback rank to "Member" if none set
 */
export async function initAvatarForThread(thread) {
  if (!thread) return;

  const imgEl = document.getElementById('thread-avatar-img');
  const rankEl = document.getElementById('thread-author-rank');
  if (!imgEl) return;

  const authorUsername = thread.author || null;
  const content = thread.content || '';

  // 1) Try DB users.avatar_url + users.userrank by username
  if (authorUsername) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('avatar_url, userrank')
        .eq('username', authorUsername)
        .maybeSingle();

      if (!error && data) {
        if (data.avatar_url) {
          applyAvatarToImage(imgEl, data.avatar_url);
        }

        if (rankEl) {
          rankEl.textContent = data.userrank || 'Member';
        }

        // If we got an avatar URL from DB, we're done.
        if (data.avatar_url) return;
      }
    } catch (e) {
      console.error('avatar/userrank lookup error', e);
    }
  }

  // 2) Fallback avatar from [avatar=URL] BBCode in content
  const urlFromBbcode = extractAvatarUrlFromText(content);
  if (urlFromBbcode) {
    applyAvatarToImage(imgEl, urlFromBbcode);
  }

  // 3) Fallback rank if nothing set yet
  if (rankEl && !rankEl.textContent) {
    rankEl.textContent = 'Member';
  }
}