// /api/combothreadcreation.js

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// get this from Supabase dashboard → Project settings → API → JWT secret
const SUPABASE_JWT_SECRET = 'YOUR_SUPABASE_JWT_SECRET_HERE';

export default async function combothreadcreation(req, res) {
  // allow only POST
  if (req.method !== 'POST') {
    res
      .status(405)
      .json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // body is expected to contain token + thread fields
    const { access_token, title, tag, author, content } = req.body || {};

    // 1) require access token
    if (!access_token) {
      res
        .status(401)
        .json({ success: false, error: 'Missing access token' });
      return;
    }

    // 2) verify token
    try {
      jwt.verify(access_token, SUPABASE_JWT_SECRET);
    } catch (e) {
      console.error('JWT verify failed:', e);
      res
        .status(401)
        .json({ success: false, error: 'Invalid or expired access token' });
      return;
    }

    // 3) validate thread fields
    if (!title || !tag || !author || !content) {
      res
        .status(400)
        .json({ success: false, error: 'Missing fields' });
      return;
    }

    // 4) insert into Supabase
    const { data, error } = await supabase
      .from('threads')
      .insert([
        {
          title,
          tag,
          author,
          content,
          section: 'combo',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error (combo):', error);
      res
        .status(500)
        .json({ success: false, error: error.message });
      return;
    }

    // 5) success
    res.status(200).json({ success: true, thread: data });
  } catch (err) {
    console.error('combothreadcreation handler error:', err);
    res
      .status(500)
      .json({ success: false, error: 'Server error' });
  }
}