// credits.js - Client-side credit balance display
async function initCredits() {
  const user = await window.getCurrentUserWithRole?.();
  if (!user) return;

  const balanceSection = document.getElementById('credits-balance-section');
  const balanceValue = document.getElementById('credits-balance-value');

  if (balanceSection && balanceValue) {
    balanceSection.style.display = 'block';
    balanceValue.textContent = '0';

    try {
      const session = await window.supabaseClient.auth.getSession();
      const token = session?.data?.session?.access_token;

      if (token) {
        const res = await fetch('/api/credits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'get' })
        });
        const data = await res.json();
        if (data.success) {
          balanceValue.textContent = data.credits;
        }
      }
    } catch (e) {
      console.error('Failed to load credits', e);
    }
  }
}

initCredits();
