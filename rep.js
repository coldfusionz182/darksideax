import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const SUPABASE_URL = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Loads the reputation score for the profile being viewed
 */
async function loadTargetReputation() {
  const repEl = document.getElementById('profile-rep');
  if (!repEl) return;

  // Resolve target username from URL or the Loaded Profile name
  let target = getParam('u');
  if (!target) {
     const { data: { user } } = await supabase.auth.getUser();
     if (user) {
        const { data: profile } = await supabase.from('users').select('username').eq('id', user.id).maybeSingle();
        target = profile?.username;
     }
  }

  if (!target) return;

  const { data, error } = await supabase
    .from('rep')
    .select('amount')
    .ilike('username', target);
    
  if (error) {
    console.error('Error fetching rep', error);
    return;
  }

  // Calculate sum of all rows for this user
  const total = data.reduce((acc, row) => acc + (parseInt(row.amount) || 0), 0);
  repEl.textContent = total;
}

/**
 * Handles the "Give Reputation" modal for staff
 */
async function setupGiveRepModal() {
  const giveBtn = document.getElementById('btn-give-rep');
  if (!giveBtn) return;

  const targetUsername = getParam('u');
  if (!targetUsername) return;

  giveBtn.onclick = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: viewer } = await supabase.from('users').select('username').eq('id', authUser.id).maybeSingle();
    const giverName = viewer?.username || 'System';

    const amount = prompt(`Give reputation to ${targetUsername} (-5 to +5):`, "1");
    if (amount === null) return;

    const val = parseInt(amount);
    if (isNaN(val) || val < -5 || val > 5 || val === 0) {
      alert("Invalid amount. Use -5 to +5.");
      return;
    }

    const { error } = await supabase.from('rep').insert({
      username: targetUsername,
      amount: String(val),
      given_by: giverName,
      timegiven: new Date().toISOString()
    });

    if (error) {
      alert("Failed to give reputation.");
    } else {
      alert(`Success! Gave ${val} reputation to ${targetUsername}.`);
      window.location.reload();
    }
  };
}

/**
 * Opens the reputation details list
 */
async function setupRepDetails() {
  const repEl = document.getElementById('profile-rep');
  const modal = document.getElementById('rep-modal-backdrop');
  if (!repEl || !modal) return;

  repEl.style.cursor = 'pointer';
  repEl.onclick = async () => {
    const target = getParam('u') || document.getElementById('profile-username').textContent;
    const body = document.getElementById('rep-modal-body');
    const title = document.getElementById('rep-modal-title');
    
    title.textContent = `Reputation History for ${target}`;
    body.innerHTML = 'Loading...';
    modal.style.display = 'flex';

    const { data, error } = await supabase
      .from('rep')
      .select('*')
      .ilike('username', target)
      .order('timegiven', { ascending: false });

    if (error || !data.length) {
      body.innerHTML = '<p class="meta">No reputation logs found.</p>';
      return;
    }

    body.innerHTML = '';
    data.forEach(row => {
      const entry = document.createElement('div');
      entry.className = 'rep-entry';
      entry.style.display = 'flex';
      entry.style.justifyContent = 'space-between';
      entry.style.padding = '10px';
      entry.style.borderBottom = '1px solid #30363d';
      
      const val = parseInt(row.amount);
      const color = val > 0 ? '#10b981' : '#ef4444';
      const sign = val > 0 ? '+' : '';

      entry.innerHTML = `
        <div>
          <strong style="color: ${color}">${sign}${val}</strong>
          <span class="meta" style="font-size: 0.8rem; margin-left: 10px;">from ${row.given_by}</span>
        </div>
        <div class="meta" style="font-size: 0.8rem;">${new Date(row.timegiven).toLocaleDateString()}</div>
      `;
      body.appendChild(entry);
    });
  };

  // Close logic
  document.getElementById('rep-modal-close').onclick = () => modal.style.display = 'none';
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

document.addEventListener('DOMContentLoaded', () => {
  loadTargetReputation();
  setupGiveRepModal();
  setupRepDetails();
});