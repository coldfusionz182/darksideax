// api/delete-thread.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res
      .status(405)
      .json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ success: false, error: 'No token' });
      return;
    }

    const accessToken = authHeader.slice('Bearer '.length);

    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      res
        .status(401)
        .json({ success: false, error: 'Invalid user' });
      return;
    }

    const userId = userData.user.id;

    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (profError || !profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
      res
        .status(403)
        .json({ success: false, error: 'Not allowed' });
      return;
    }

    const body = req.body || {};
    const { id } = body;

    if (!id) {
      res
        .status(400)
        .json({ success: false, error: 'Missing id' });
      return;
    }

    const { error: delError } = await supabaseAdmin
      .from('threads')
      .delete()
      .eq('id', id);

    if (delError) {
      console.error('Supabase delete error:', delError);
      res
        .status(500)
        .json({ success: false, error: delError.message });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('delete-thread handler error:', err);
    res
      .status(500)
      .json({ success: false, error: 'Server error' });
  }
}