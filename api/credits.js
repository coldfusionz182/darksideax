// api/credits.js – Combined credits API (get / give / spend)
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

    // --- GIVE: owner gives credits to a user ---
    if (action === 'give') {
      const { data: profile, error: profError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profError || !profile || profile.role !== 'owner') {
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

    // Unknown action
    res.status(400).json({ success: false, error: 'Unknown action. Use: get, give, spend' });
  } catch (err) {
    console.error('credits handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
