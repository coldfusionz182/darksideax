// api/create-user.js
//
// POST /api/create-user
// Body: { email, password, role, token }
//
// Uses Supabase service role key to:
//  1) Create auth user
//  2) Insert into public.users with initial role

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ffmkkwskvjvytdddevmm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('api/create-user: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
}

// service client (server-side only)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// helper: verify that the caller token belongs to an OWNER
async function ensureOwner(token) {
  if (!token || !SUPABASE_ANON_KEY) return false;

  const supabaseWithToken = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData, error } = await supabaseWithToken.auth.getUser();
  if (error || !userData?.user) return false;

  const user = userData.user;

  const { data: row, error: roleErr } = await supabaseWithToken
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (roleErr || !row) return false;
  return row.role === 'owner';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, password, role, token } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const isOwner = await ensureOwner(token);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can create users' });
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      console.error('create-user: createUser error', createErr);
      return res.status(500).json({ success: false, error: createErr.message });
    }

    const newUser = created?.user;
    if (!newUser) {
      return res.status(500).json({ success: false, error: 'User not returned from createUser' });
    }

    const initialRole = role === 'admin' ? 'admin' : 'user';

    const { error: usersErr } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUser.id,
        email: newUser.email,
        role: initialRole,
      })
      .single();

    if (usersErr && usersErr.code !== '23505') {
      console.error('create-user: insert into public.users error', usersErr);
      return res.status(500).json({ success: false, error: usersErr.message });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: initialRole,
      },
    });
  } catch (err) {
    console.error('create-user: unhandled error', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}