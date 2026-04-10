// AvatarThreadLoader.js

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function extractAvatarUrlFromText(text) {
  if (!text) return null;
  const match = text.match(/\[avatar=(https?:\/\/[^\]\s]+)\]/i);
  return match ? match[1] : null;
}

function applyAvatarToImage(imgEl, url) {
  if (!imgEl || !url) return;
  imgEl.src = url;
}

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

        // we still allow BBCode avatar override below if avatar_url is null
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

  // Fallback rank if nothing from DB
  if (rankEl && !rankEl.textContent) {
    rankEl.textContent = 'Member';
  }
}