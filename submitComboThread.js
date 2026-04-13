// submitComboThread.js
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './keys.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function submitComboThread({ title, tag, author, content }) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error('Not logged in');

  const res = await fetch('/api/combothreadcreation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ title, tag, author, content }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to create combo thread');
  return json.thread;
}