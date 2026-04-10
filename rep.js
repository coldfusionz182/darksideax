// rep.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- shared helpers ----------

async function getCurrentUserWithRole() {
  const { data: userData, error } = await supabaseClient.auth.getUser();
  if (error || !userData?.user) return null;

  const user = userData.user;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const { data: userRow } = await supabaseClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    username: profile?.username || user.email,
    role: userRow?.role || 'user',
  };
}

// ---------- profile page rep display ----------

async function loadRepForCurrentUser() {
  const repEl = document.getElementById('profile-rep');
  if (!repEl) return; // not on profile page

  const current = await getCurrentUserWithRole();
  if (!current) {
    repEl.textContent = '0';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('rep')
      .select('amount')
      .eq('username', current.username)
      .maybeSingle();

    if (error) {
      console.error('rep(profile): load error', error);
      return;
    }

    const raw = data?.amount ?? '0';
    const parsed = parseInt(raw, 10);
    repEl.textContent = Number.isNaN(parsed) ? raw : String(parsed);
  } catch (e) {
    console.error('rep(profile): exception', e);
  }
}

// ---------- give rep (index page) ----------

// find users whose username starts with input
async function searchUsersByUsernamePrefix(prefix) {
  if (!prefix) return [];

  // simple prefix match: username ilike 'prefix%'
  const { data, error } = await supabaseClient
    .from('users')
    .select('username')
    .ilike('username', `${prefix}%`)
    .limit(5);

  if (error) {
    console.error('rep(give): user search error', error);
    return [];
  }
  return (data || []).filter(u => u.username);
}

// insert / increment rep for target username
async function addRepForUser(targetUsername, delta) {
  // try to fetch existing rep row
  const { data, error } = await supabaseClient
    .from('rep')
    .select('id, amount')
    .eq('username', targetUsername)
    .maybeSingle();

  if (error) {
    console.error('rep(give): fetch existing error', error);
    throw error;
  }

  let newAmount;

  if (!data) {
    newAmount = delta;
    const { error: insErr } = await supabaseClient
      .from('rep')
      .insert({
        username: targetUsername,
        amount: String(newAmount),
      });

    if (insErr) {
      console.error('rep(give): insert error', insErr);
      throw insErr;
    }
  } else {
    const currentAmount = parseInt(data.amount ?? '0', 10);
    newAmount = (Number.isNaN(currentAmount) ? 0 : currentAmount) + delta;

    const { error: updErr } = await supabaseClient
      .from('rep')
      .update({ amount: String(newAmount) })
      .eq('id', data.id);

    if (updErr) {
      console.error('rep(give): update error', updErr);
      throw updErr;
    }
  }

  return newAmount;
}

async function initRepGiveBox() {
  const box = document.getElementById('rep-give-box');
  const form = document.getElementById('rep-give-form');
  const userInput = document.getElementById('rep-username');
  const amountSelect = document.getElementById('rep-amount');
  const statusEl = document.getElementById('rep-give-status');

  if (!box || !form || !userInput || !amountSelect || !statusEl) return;

  const current = await getCurrentUserWithRole();
  if (!current) {
    box.style.display = 'none';
    return;
  }

  // only admins / owner can give rep (client side)
  if (current.role !== 'admin' && current.role !== 'owner') {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';

  // suggestion list
  const suggestions = document.createElement('div');
  suggestions.id = 'rep-username-suggestions';
  suggestions.style.position = 'absolute';
  suggestions.style.zIndex = '999';
  suggestions.style.background = '#020617';
  suggestions.style.border = '1px solid #111827';
  suggestions.style.borderRadius = '4px';
  suggestions.style.fontSize = '0.8rem';
  suggestions.style.display = 'none';
  document.body.appendChild(suggestions);

  function hideSuggestions() {
    suggestions.style.display = 'none';
    suggestions.innerHTML = '';
  }

  function positionSuggestions() {
    const rect = userInput.getBoundingClientRect();
    suggestions.style.left = `${rect.left + window.scrollX}px`;
    suggestions.style.top = `${rect.bottom + window.scrollY + 2}px`;
    suggestions.style.minWidth = `${rect.width}px`;
  }

  userInput.addEventListener('input', async () => {
    const value = userInput.value.trim();
    if (!value) {
      hideSuggestions();
      return;
    }

    positionSuggestions();

    const users = await searchUsersByUsernamePrefix(value);
    if (!users.length) {
      hideSuggestions();
      return;
    }

    suggestions.innerHTML = '';
    users.forEach(u => {
      const item = document.createElement('div');
      item.textContent = u.username;
      item.style.padding = '4px 8px';
      item.style.cursor = 'pointer';
      item.addEventListener('mouseenter', () => {
        item.style.background = '#111827';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
      item.addEventListener('click', () => {
        userInput.value = u.username;
        hideSuggestions();
      });
      suggestions.appendChild(item);
    });

    suggestions.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (e.target === userInput || suggestions.contains(e.target)) return;
    hideSuggestions();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';

    const target = userInput.value.trim();
    const amountStr = amountSelect.value;

    if (!target) {
      statusEl.textContent = 'Enter the exact username.';
      return;
    }
    if (!amountStr) {
      statusEl.textContent = 'Select a rep amount.';
      return;
    }

    // verify target exists in public.users
    const { data: userCheck, error: checkErr } = await supabaseClient
      .from('users')
      .select('username')
      .eq('username', target)
      .maybeSingle();

    if (checkErr) {
      console.error('rep(give): user check error', checkErr);
      statusEl.textContent = 'Error checking user.';
      return;
    }
    if (!userCheck) {
      statusEl.textContent = 'User not found.';
      return;
    }

    const delta = parseInt(amountStr, 10);
    if (!delta || delta < 1 || delta > 6) {
      statusEl.textContent = 'Invalid rep amount.';
      return;
    }

    statusEl.textContent = 'Updating reputation...';

    try {
      const newAmount = await addRepForUser(target, delta);
      statusEl.textContent = `Reputation updated. ${target} now has ${newAmount} rep.`;
      form.reset();
      hideSuggestions();
    } catch (err) {
      console.error('rep(give): failed', err);
      statusEl.textContent = 'Failed to update reputation.';
    }
  });
}

// ---------- entry ----------

function initRepModule() {
  loadRepForCurrentUser().catch((e) => console.error(e));
  initRepGiveBox().catch((e) => console.error(e));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRepModule);
} else {
  initRepModule();
}