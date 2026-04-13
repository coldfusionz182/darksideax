// api/create-thread.js
import { createSupabaseServerClient } from './supabaseServerClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const supabase = createSupabaseServerClient(token);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Supabase auth error (accounts):', userError);
      res
        .status(401)
        .json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    const { title, tag, author, content } = req.body || {};

    if (!title || !tag || !author || !content) {
      res.status(400).json({ success: false, error: 'Missing fields' });
      return;
    }

    const { data, error } = await supabase
      .from('threads')
      .insert([
        {
          title,
          tag,
          author,
          content,
          section: 'accounts',
          user_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error (accounts):', error);
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(200).json({ success: true, thread: data });
  } catch (err) {
    console.error('create-thread handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}