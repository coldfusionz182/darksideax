// api/list-threads.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    // optional ?section=configs / accounts / combo / software (case-insensitive)
    const rawSection = (req.query.section || '').toString().toLowerCase();

    let query = supabase
      .from('threads')
      .select(
        'id, title, tag, author, content, created_at, replies, views, last_post_user, last_post_time, section, marketplace_status'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    // include combo + software here
    if (
      rawSection === 'configs' ||
      rawSection === 'accounts' ||
      rawSection === 'combo' ||
      rawSection === 'software'
    ) {
      query = query.eq('section', rawSection);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase select error:', error);
      res.status(500).json({ error: 'Failed to load threads' });
      return;
    }

    res.status(200).json(data || []);
  } catch (err) {
    console.error('list-threads handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}