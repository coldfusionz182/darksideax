// api/credits.js – Combined credits API (get / give / spend / create-user / reset-password)
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

    // --- GET: fetch own credits ---
    if (action === 'get') {
      const { data: userRow, error: userErr } = await supabaseAdmin
        .from('users')
        .select('credits')
        .eq('id', userId)
        .maybeSingle();

      if (userErr || !userRow) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.status(200).json({ success: true, credits: userRow.credits || 0 });
      return;
    }

    // --- GET_USER_CREDITS: fetch any user's credits by username (owner only) ---
    if (action === 'get_user_credits') {
      const { username } = body;

      if (!username || typeof username !== 'string' || !username.trim()) {
        res.status(400).json({ success: false, error: 'Missing username' });
        return;
      }

      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || requesterRow.role !== 'owner') {
        res.status(403).json({ success: false, error: 'Only owner can view other users credits' });
        return;
      }

      const { data: targetUser, error: targetError } = await supabaseAdmin
        .from('users')
        .select('credits')
        .eq('username', username.trim())
        .maybeSingle();

      if (targetError || !targetUser) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.status(200).json({ success: true, credits: targetUser.credits || 0 });
      return;
    }

    // --- GIVE: owner gives credits to a user ---
    if (action === 'give') {
      const { data: userRow, error: userErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (userErr || !userRow || userRow.role !== 'owner') {
        res.status(403).json({ success: false, error: 'Only owner can give credits' });
        return;
      }

      const { username, amount } = body;

      if (!username || typeof username !== 'string' || !username.trim()) {
        res.status(400).json({ success: false, error: 'Missing username' });
        return;
      }
      if (typeof amount !== 'number' || amount === 0) {
        res.status(400).json({ success: false, error: 'Amount must be a non-zero number' });
        return;
      }

      const { data: targetUser, error: targetError } = await supabaseAdmin
        .from('users')
        .select('id, credits')
        .eq('username', username.trim())
        .maybeSingle();

      if (targetError || !targetUser) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const currentCredits = targetUser.credits || 0;
      const newCredits = currentCredits + amount;

      if (newCredits < 0) {
        res.status(400).json({ success: false, error: 'User would have negative credits' });
        return;
      }

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ credits: newCredits })
        .eq('id', targetUser.id);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        res.status(500).json({ success: false, error: updateError.message });
        return;
      }

      res.status(200).json({ success: true, credits: newCredits });
      return;
    }

    // --- SPEND: user spends their own credits ---
    if (action === 'spend') {
      const { amount } = body;

      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({ success: false, error: 'Amount must be a positive number' });
        return;
      }

      const { data: userRow, error: userErr } = await supabaseAdmin
        .from('users')
        .select('credits')
        .eq('id', userId)
        .maybeSingle();

      if (userErr || !userRow) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const currentCredits = userRow.credits || 0;
      if (currentCredits < amount) {
        res.status(400).json({ success: false, error: 'Insufficient credits' });
        return;
      }

      const newCredits = currentCredits - amount;

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ credits: newCredits })
        .eq('id', userId);

      if (updateError) {
        console.error('Supabase update error:', updateError);
        res.status(500).json({ success: false, error: updateError.message });
        return;
      }

      res.status(200).json({ success: true, credits: newCredits });
      return;
    }

    // --- CREATE_USER: owner creates a new user ---
    if (action === 'create_user') {
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || requesterRow.role !== 'owner') {
        res.status(403).json({ success: false, error: 'Only owner can create users' });
        return;
      }

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
          password,
        },
      });
      return;
    }

    // --- RESET_PASSWORD: owner resets a user's password ---
    if (action === 'reset_password') {
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || requesterRow.role !== 'owner') {
        res.status(403).json({ success: false, error: 'Only owner can reset passwords' });
        return;
      }

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
      return;
    }

    // Unknown action
    res.status(400).json({ success: false, error: 'Unknown action. Use: get, give, spend, create_user, reset_password' });
  } catch (err) {
    console.error('credits handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
