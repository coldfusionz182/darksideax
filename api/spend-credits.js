// api/spend-credits.js
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
    const { amount } = body;

    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, error: 'Amount must be a positive number' });
      return;
    }

    const { data: profile, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();

    if (profError || !profile) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    const currentCredits = profile.credits || 0;
    if (currentCredits < amount) {
      res.status(400).json({ success: false, error: 'Insufficient credits' });
      return;
    }

    const newCredits = currentCredits - amount;

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', userId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      res.status(500).json({ success: false, error: updateError.message });
      return;
    }

    res.status(200).json({ success: true, credits: newCredits });
  } catch (err) {
    console.error('spend-credits handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
