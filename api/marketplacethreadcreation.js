// api/marketplacethreadcreation.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function marketplacethreadcreation(req, res) {
  if (req.method !== 'POST') {
    res
      .status(405)
      .json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { access_token, title, tag, author, content, price, embed_url } = req.body || {};

    // require token
    if (!access_token) {
      res
        .status(401)
        .json({ success: false, error: 'Missing access token' });
      return;
    }

    // verify user role is admin or owner
    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData?.user) {
      res
        .status(401)
        .json({ success: false, error: 'Invalid access token' });
      return;
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();

    const role = (userRow?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'owner') {
      res
        .status(403)
        .json({ success: false, error: 'Only admins and owners can create marketplace threads' });
      return;
    }

    // validate fields
    if (!title || !author || !content || !price) {
      res
        .status(400)
        .json({ success: false, error: 'Missing fields (title, author, content, price required)' });
      return;
    }

    const { data, error } = await supabase
      .from('threads')
      .insert([
        {
          title,
          tag: tag || 'Marketplace',
          author,
          content,
          section: 'marketplace',
          price,
          embed_url: embed_url || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error (marketplace):', error);
      res
        .status(500)
        .json({ success: false, error: error.message });
      return;
    }

    res.status(200).json({ success: true, thread: data });
  } catch (err) {
    console.error('marketplacethreadcreation handler error:', err);
    res
      .status(500)
      .json({ success: false, error: 'Server error' });
  }
}
