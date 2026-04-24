// credits.js – Credits system for index.html

async function initCredits() {
  const user = await window.getCurrentUserWithRole?.();
  if (!user) return;

  // --- Show credit balance for all logged-in users ---
  const balanceSection = document.getElementById('credits-balance-section');
  const balanceValue = document.getElementById('credits-balance-value');
  if (balanceSection && balanceValue) {
    try {
      const { data: sessionData } = await window.supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const resp = await fetch('/api/get-credits', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const json = await resp.json();
        if (json.success) {
          balanceValue.textContent = json.credits;
          balanceSection.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Failed to load credits:', err);
    }
  }

  // --- Show give-credits panel for owner only ---
  if (user.role !== 'owner') return;

  const giveBox = document.getElementById('credits-give-box');
  if (!giveBox) return;
  giveBox.style.display = 'block';

  const form = document.getElementById('credits-give-form');
  const statusEl = document.getElementById('credits-give-status');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!statusEl) return;

    const usernameInput = document.getElementById('credits-username');
    const amountInput = document.getElementById('credits-amount');
    const username = usernameInput?.value?.trim();
    const amount = parseInt(amountInput?.value, 10);

    if (!username) {
      statusEl.textContent = 'Enter a username.';
      statusEl.style.color = '#f87171';
      return;
    }
    if (isNaN(amount) || amount === 0) {
      statusEl.textContent = 'Enter a non-zero amount (positive to give, negative to remove).';
      statusEl.style.color = '#f87171';
      return;
    }

    statusEl.textContent = 'Processing...';
    statusEl.style.color = '#fbbf24';

    try {
      const { data: sessionData } = await window.supabaseClient.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { alert('No token, please re-login.'); return; }

      const resp = await fetch('/api/give-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username, amount }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.error || 'Failed to give credits');
      }
      statusEl.textContent = `Gave ${amount > 0 ? '+' : ''}${amount} credits to ${username}. New balance: ${json.credits}`;
      statusEl.style.color = '#4ade80';
      usernameInput.value = '';
      amountInput.value = '';

      // Refresh own balance display
      if (balanceValue) {
        const balResp = await fetch('/api/get-credits', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const balJson = await balResp.json();
        if (balJson.success) balanceValue.textContent = balJson.credits;
      }
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.style.color = '#f87171';
    }
  });
}

initCredits();
