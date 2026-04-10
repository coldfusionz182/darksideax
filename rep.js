// rep.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- shared helpers ----

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

// ---- profile page: show current user's rep ----

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

// ---- index page: give reputation box ----

// upsert / increment rep for target username
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
    // no row yet, create
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
    // not logged in -> keep hidden
    box.style.display = 'none';
    return;
  }

  // only allow admin / owner to see + use the box
  if (current.role !== 'admin' && current.role !== 'owner') {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'block';

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
    } catch (err) {
      console.error('rep(give): failed', err);
      statusEl.textContent = 'Failed to update reputation.';
    }
  });
}

// ---- entry ----

function initRepModule() {
  loadRepForCurrentUser().catch((e) => console.error(e));
  initRepGiveBox().catch((e) => console.error(e));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRepModule);
} else {
  initRepModule();
}