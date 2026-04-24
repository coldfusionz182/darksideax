import { createClient } from '@supabase/supabase-js';

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
      res.status(403).json({ success: false, error: 'Only owner can reset passwords' });
      return;
    }

    const body = req.body || {};
    const { email, newPassword } = body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ success: false, error: 'Missing email' });
      return;
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
      return;
    }

    // Find user by email
    const { data: userRow, error: findErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (findErr || !userRow) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Update password via admin API
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      userRow.id,
      { password: newPassword }
    );

    if (updateErr) {
      console.error('reset password error', updateErr);
      res.status(400).json({ success: false, error: updateErr.message || 'Failed to reset password' });
      return;
    }

    res.status(200).json({ success: true, email: email.trim().toLowerCase() });
  } catch (err) {
    console.error('reset-password handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
