import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token' });
      return;
    }

    const accessToken = authHeader.slice('Bearer '.length);

    // Verify the requester is the owner
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      res.status(401).json({ success: false, error: 'Invalid user' });
      return;
    }

    const requesterId = userData.user.id;

    const { data: requesterRow, error: requesterErr } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', requesterId)
      .maybeSingle();

    if (requesterErr || !requesterRow || requesterRow.role !== 'owner') {
      res.status(403).json({ success: false, error: 'Only owner can create users' });
      return;
    }

    const body = req.body || {};
    const { email, password, username } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ success: false, error: 'Missing email' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if email is banned
    const { data: bannedRow } = await supabaseAdmin
      .from('banned_users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (bannedRow) {
      res.status(403).json({ success: false, error: 'This email is banned' });
      return;
    }

    // Create auth user via admin API
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (createErr) {
      console.error('create auth user error', createErr);
      res.status(400).json({ success: false, error: createErr.message || 'Failed to create user' });
      return;
    }

    const newUserId = newUser.user.id;

    // Generate usertoken
    const usertoken = randomBytes(16).toString('hex').toUpperCase();

    // Insert into public.users table
    const insertData = {
      id: newUserId,
      email: email.trim().toLowerCase(),
      role: 'user',
      credits: 0,
      usertoken,
    };
    if (username && typeof username === 'string' && username.trim()) {
      insertData.username = username.trim();
    }

    const { error: insertErr } = await supabaseAdmin
      .from('users')
      .insert(insertData);

    if (insertErr) {
      console.error('insert public user error', insertErr);
      // Try to clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      res.status(500).json({ success: false, error: 'Failed to create user profile: ' + insertErr.message });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: newUserId,
        email: email.trim().toLowerCase(),
        username: insertData.username || null,
        usertoken,
      },
    });
  } catch (err) {
    console.error('create-user handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
