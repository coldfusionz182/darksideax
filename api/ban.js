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

    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      res.status(401).json({ success: false, error: 'Invalid user' });
      return;
    }

    const userId = userData.user.id;
    const body = req.body || {};
    const { action } = body;

    // --- CHECK: is current user banned? ---
    if (action === 'check') {
      const email = userData.user.email;

      const { data: bannedRow, error: banErr } = await supabaseAdmin
        .from('banned_users')
        .select('id, reason')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (banErr) {
        console.error('ban check error', banErr);
        res.status(200).json({ success: true, banned: false });
        return;
      }

      if (bannedRow) {
        res.status(200).json({ success: true, banned: true, reason: bannedRow.reason || 'No reason specified' });
        return;
      }

      res.status(200).json({ success: true, banned: false });
      return;
    }

    // --- BAN: ban a user by username (owner only) ---
    if (action === 'ban') {
      const { username } = body;

      if (!username || typeof username !== 'string' || !username.trim()) {
        res.status(400).json({ success: false, error: 'Missing username' });
        return;
      }

      // Verify requester is owner
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || requesterRow.role !== 'owner') {
        res.status(403).json({ success: false, error: 'Only owner can ban users' });
        return;
      }

      // Find target user
      const { data: targetUser, error: targetError } = await supabaseAdmin
        .from('users')
        .select('id, email, role, username')
        .eq('username', username.trim())
        .maybeSingle();

      if (targetError || !targetUser) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      if (targetUser.role === 'owner') {
        res.status(403).json({ success: false, error: 'Cannot ban the owner' });
        return;
      }

      const targetEmail = targetUser.email.toLowerCase();

      // Add to banned_users table
      const { error: banInsertErr } = await supabaseAdmin
        .from('banned_users')
        .upsert({ email: targetEmail, username: targetUser.username }, { onConflict: 'email' });

      if (banInsertErr) {
        console.error('ban insert error', banInsertErr);
        res.status(500).json({ success: false, error: 'Failed to add to banned list' });
        return;
      }

      // Delete from auth.users using admin API
      const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(targetUser.id);
      if (deleteAuthErr) {
        console.error('delete auth user error', deleteAuthErr);
        // Continue anyway - they're banned even if auth delete fails
      }

      // Delete from public.users
      const { error: deletePublicErr } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', targetUser.id);

      if (deletePublicErr) {
        console.error('delete public user error', deletePublicErr);
      }

      res.status(200).json({ success: true, banned: targetUser.username, email: targetEmail });
      return;
    }

    // --- UNBAN: remove from banned list (owner only) ---
    if (action === 'unban') {
      const { email } = body;

      if (!email || typeof email !== 'string' || !email.trim()) {
        res.status(400).json({ success: false, error: 'Missing email' });
        return;
      }

      // Verify requester is owner
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || requesterRow.role !== 'owner') {
        res.status(403).json({ success: false, error: 'Only owner can unban users' });
        return;
      }

      const { error: unbanErr } = await supabaseAdmin
        .from('banned_users')
        .delete()
        .eq('email', email.toLowerCase());

      if (unbanErr) {
        console.error('unban error', unbanErr);
        res.status(500).json({ success: false, error: 'Failed to unban' });
        return;
      }

      res.status(200).json({ success: true, unbanned: email });
      return;
    }

    // --- LIST: get all banned users (owner/admin) ---
    if (action === 'list') {
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || (requesterRow.role !== 'owner' && requesterRow.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Only owner/admin can list banned users' });
        return;
      }

      const { data: bannedList, error: listErr } = await supabaseAdmin
        .from('banned_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (listErr) {
        console.error('list banned error', listErr);
        res.status(500).json({ success: false, error: 'Failed to list banned users' });
        return;
      }

      res.status(200).json({ success: true, banned: bannedList || [] });
      return;
    }

    // Unknown action
    res.status(400).json({ success: false, error: 'Unknown action. Use: check, ban, unban, list' });
  } catch (err) {
    console.error('ban handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
