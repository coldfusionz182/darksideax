// AvatarThreadLoader.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

// --- Supabase client (same project as rest of site) ---
const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- BBCode extractor for [avatar=...] ---
function extractAvatarUrlFromText(text) {
  if (!text) return null;
  const match = text.match(/\[avatar=(https?:\/\/[^\]\s]+)\]/i);
  return match ? match[1] : null;
}

// --- Apply URL to <img> ---
function applyAvatarToImage(imgEl, url) {
  if (!imgEl || !url) return;
  imgEl.src = url;
}

/**
 * Main entry: call this from thread.html after you have the thread object.
 * - thread.author is the username (e.g. "ColdFusionz")
 * - thread.content is raw BBCode (may contain [avatar=...])
 */
export async function initAvatarForThread(thread) {
  if (!thread) return;

  const imgEl = document.getElementById('thread-avatar-img');
  if (!imgEl) return;

  const authorUsername = thread.author || null;
  const content = thread.content || '';

  // 1) Try DB users.avatar_url by username
  if (authorUsername) {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('avatar_url')
        .eq('username', authorUsername)
        .maybeSingle();

      if (!error && data?.avatar_url) {
        applyAvatarToImage(imgEl, data.avatar_url);
        return; // done
      }
    } catch (e) {
      console.error('avatar lookup error', e);
    }
  }

  // 2) Fallback: [avatar=URL] inside post content
  const urlFromBbcode = extractAvatarUrlFromText(content);
  if (urlFromBbcode) {
    applyAvatarToImage(imgEl, urlFromBbcode);
  }
}