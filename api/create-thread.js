// api/create-thread.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res
      .status(405)
      .json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // note: section is now accepted from the body
    const { title, tag, author, content, section } = req.body || {};

    if (!title || !tag || !author || !content) {
      res
        .status(400)
        .json({ success: false, error: 'Missing fields' });
      return;
    }

    // decide safe section: 'configs' or 'accounts' (default)
    let safeSection = 'accounts';
    if (section === 'configs') {
      safeSection = 'configs';
    }

    const { data, error } = await supabase
      .from('threads')
      .insert([
        {
          title,
          tag,
          author,
          content,
          section: safeSection, // <‑‑ gets written as 'accounts' or 'configs'
          // replies/views default in DB
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      res
        .status(500)
        .json({ success: false, error: error.message });
      return;
    }

    res.status(200).json({ success: true, thread: data });
  } catch (err) {
    console.error('create-thread handler error:', err);
    res
      .status(500)
      .json({ success: false, error: 'Server error' });
  }
}