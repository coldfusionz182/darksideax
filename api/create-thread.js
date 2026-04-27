import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { access_token, title, tag, author, content, section, embed_url, marketplace_status, price } = req.body || {};

    if (!access_token) {
      res.status(401).json({ success: false, error: 'Missing access token' });
      return;
    }

    if (!title || !tag || !author || !content || !section) {
      res.status(400).json({ success: false, error: 'Missing fields' });
      return;
    }

    // Check if author is owner for auto-approval
    let isOwner = false;
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('role')
        .eq('username', author)
        .maybeSingle();
      if (userRow && userRow.role === 'owner') {
        isOwner = true;
      }
    } catch (err) {
      console.error('Error checking user role:', err);
    }

    // Rate limit for config requests: 10 per hour per user
    if (section === 'configrequests') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: countErr } = await supabase
        .from('threads')
        .select('id', { count: 'exact', head: true })
        .eq('author', author)
        .eq('section', 'configrequests')
        .gte('created_at', oneHourAgo);

      if (countErr) {
        console.error('Rate limit check error:', countErr);
        res.status(500).json({ success: false, error: 'Rate limit check failed' });
        return;
      }

      if (count >= 10) {
        res.status(429).json({ success: false, error: 'Rate limit: max 10 config requests per hour' });
        return;
      }
    }

    const insertData = { title, tag, author, content, section, approved: section === 'configrequests' || (section === 'configs' && isOwner) };
    
    if (embed_url) insertData.embed_url = embed_url;
    if (marketplace_status) insertData.marketplace_status = marketplace_status;
    if (price !== undefined) insertData.price = price;
    if (section === 'configrequests') insertData.config_request_status = 'in_queue';

    const { data, error } = await supabase
      .from('threads')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(200).json({ success: true, thread: data });
  } catch (err) {
    console.error('create-thread handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}