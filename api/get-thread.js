// api/get-thread.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res
        .status(405)
        .json({ success: false, error: 'Method not allowed' });
      return;
    }

    const { id } = req.query || {};
    if (!id) {
      res
        .status(400)
        .json({ success: false, error: 'Missing id' });
      return;
    }

    const { data, error } = await supabase
      .from('threads')
      .select('id, title, tag, author, content, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('get-thread error:', error);
      res
        .status(500)
        .json({ success: false, error: 'Failed to load thread' });
      return;
    }

    if (!data) {
      res
        .status(404)
        .json({ success: false, error: 'Thread not found' });
      return;
    }

    res.status(200).json({ success: true, thread: data });
  } catch (err) {
    console.error('get-thread handler error:', err);
    res
      .status(500)
      .json({ success: false, error: 'Server error' });
  }
}