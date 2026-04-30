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
    const body = req.body || {};

    // movie_search does not require auth
    if (body.action === 'movie_search') {
      const query = (body.query || '').trim();
      if (!query) {
        res.status(400).json({ success: false, error: 'Missing search query' });
        return;
      }

      try {
        const queryParam = query.replace(/\s+/g, '+');
        const searchUrl = `https://streamimdb.ru/search?q=${queryParam}`;
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };

        const response = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(15000) });

        if (!response.ok) {
          res.status(200).json({ success: true, count_text: '', results: [] });
          return;
        }

        const html = await response.text();

        if (html.includes('<h3>No Results Found</h3>')) {
          res.status(200).json({ success: true, count_text: 'No Results Found', results: [] });
          return;
        }

        let countText = '';
        const countMatch = html.match(/<p class="cb-search-results-title">\s*([\s\S]*?)\s*<\/p>/);
        if (countMatch) {
          const raw = countMatch[1];
          const mainText = raw.replace(/<[^>]+>/g, '').trim();
          const spanMatch = raw.match(/<span[^>]*>([\s\S]*?)<\/span>/);
          if (spanMatch) {
            const spanText = spanMatch[1].replace(/<[^>]+>/g, '').trim();
            countText = `${mainText} ${spanText}`;
          } else {
            countText = mainText;
          }
        }

        const decodeEntities = (s) => s
          .replace(/&#039;/g, "'")
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&#x2F;/g, '/');

        const cardChunks = html.split('<div class="cb-card">');
        const results = [];

        for (let i = 1; i < cardChunks.length; i++) {
          const chunk = cardChunks[i];
          const hrefMatch = chunk.match(/<a href="([^"]+)"/);
          const imgMatch = chunk.match(/<img\s+src="([^"]+)"/);
          const badgeMatch = chunk.match(/<span class="cb-card-badge\s+\w+">(\w+)<\/span>/);
          const titleMatch = chunk.match(/<h3 class="cb-card-title"[^>]*title="([^"]+)"/);
          const yearMatch = chunk.match(/<p class="cb-card-meta">([^<]*)<\/p>/);

          if (hrefMatch && titleMatch) {
            results.push({
              href: hrefMatch[1],
              image_url: imgMatch ? imgMatch[1] : '',
              title: decodeEntities(titleMatch[1]),
              type: badgeMatch ? badgeMatch[1] : '',
              year: yearMatch ? decodeEntities(yearMatch[1].trim()) : '',
            });
          }
        }

        res.status(200).json({ success: true, count_text: countText, results });
        return;
      } catch (err) {
        console.error('movie_search error:', err);
        res.status(500).json({ success: false, error: 'Search failed', count_text: '', results: [] });
        return;
      }
    }

    // movie_play does not require auth
    if (body.action === 'movie_play') {
      const href = (body.href || '').trim();
      if (!href) {
        res.status(400).json({ success: false, error: 'Missing movie href' });
        return;
      }

      try {
        const movieUrl = `https://streamimdb.ru${href}`;
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };

        const response = await fetch(movieUrl, { headers, signal: AbortSignal.timeout(15000) });

        if (!response.ok) {
          res.status(200).json({ success: false, error: 'Could not load movie page' });
          return;
        }

        const html = await response.text();

        // Try multiple patterns to extract embed URL (works for both movies and TV series)
        let dataSrcMatch = html.match(/data-src="([^"]*embed[^"]*)"/);  // Standard pattern
        if (!dataSrcMatch) {
          dataSrcMatch = html.match(/src="([^"]*embed\/[^"]*)"/);  // Direct src pattern
        }
        if (!dataSrcMatch) {
          dataSrcMatch = html.match(/iframe[^>]*src="([^"]+)"/);  // Any iframe src
        }
        if (!dataSrcMatch) {
          dataSrcMatch = html.match(/\/embed\/(tv|movie)\/[^"'\s]+/);  // URL pattern in HTML
        }

        // For TV series, the main page doesn't have the player - need to fetch first episode
        if (!dataSrcMatch && href.startsWith('/tv/')) {
          const firstEpisodeMatch = html.match(/href="([^"]*\/season\/1\/episode\/1)"/);
          if (firstEpisodeMatch) {
            const episodeUrl = `https://streamimdb.ru${firstEpisodeMatch[1]}`;
            const episodeResp = await fetch(episodeUrl, { headers, signal: AbortSignal.timeout(15000) });
            if (episodeResp.ok) {
              const episodeHtml = await episodeResp.text();
              dataSrcMatch = episodeHtml.match(/data-src="([^"]*embed[^"]*)"/);
              if (!dataSrcMatch) {
                dataSrcMatch = episodeHtml.match(/src="([^"]*embed\/[^"]*)"/);
              }
              if (!dataSrcMatch) {
                dataSrcMatch = episodeHtml.match(/iframe[^>]*src="([^"]+)"/);
              }
              if (!dataSrcMatch) {
                dataSrcMatch = episodeHtml.match(/\/embed\/(tv|movie)\/[^"'\s]+/);
              }
            }
          }
        }

        if (!dataSrcMatch) {
          res.status(200).json({ success: false, error: 'No embed URL found' });
          return;
        }

        let embedPath = dataSrcMatch[1];
        // If the match includes the full URL, extract just the path
        if (embedPath.startsWith('http')) {
          try {
            const urlObj = new URL(embedPath);
            embedPath = urlObj.pathname;
          } catch (e) {}
        }

        const embedUrl = `https://streamimdb.ru${embedPath}`;

        // Extract __cbCwMeta for title/poster info
        let meta = {};
        const metaMatch = html.match(/window\.__cbCwMeta\s*=\s*(\{[^}]+\})/);
        if (metaMatch) {
          try { meta = JSON.parse(metaMatch[1]); } catch (e) {}
        }

        res.status(200).json({ success: true, embed_url: embedUrl, meta });
        return;
      } catch (err) {
        console.error('movie_play error:', err);
        res.status(500).json({ success: false, error: 'Failed to load movie' });
        return;
      }
    }

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

      if (requesterErr || !requesterRow) {
        res.status(403).json({ success: false, error: 'User not found' });
        return;
      }

      const { email, password, username, role } = body;

      if (!email || typeof email !== 'string' || !email.trim()) {
        res.status(400).json({ success: false, error: 'Missing email' });
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        return;
      }

      // Validate role based on requester's role
      const requesterRole = requesterRow.role;
      let targetRole = role || 'member';

      if (requesterRole === 'admin') {
        // Admins can only create members
        if (targetRole !== 'member') {
          res.status(403).json({ success: false, error: 'Admins can only create member accounts' });
          return;
        }
      } else if (requesterRole !== 'owner') {
        // Only owner and admin can create users
        res.status(403).json({ success: false, error: 'Only owner and admin can create users' });
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
        role: targetRole,
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
          role: targetRole,
        },
      });
      return;
    }

    
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

    // --- APPROVE_THREAD: approve a pending thread (owner/admin only) ---
    if (action === 'approve_thread') {
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || (requesterRow.role !== 'owner' && requesterRow.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Only owner and admin can approve threads' });
        return;
      }

      const { threadId } = body;

      if (!threadId) {
        res.status(400).json({ success: false, error: 'Missing thread ID' });
        return;
      }

      const { error: updateErr } = await supabaseAdmin
        .from('threads')
        .update({ approved: true })
        .eq('id', threadId);

      if (updateErr) {
        console.error('approve thread error', updateErr);
        res.status(500).json({ success: false, error: 'Failed to approve thread' });
        return;
      }

      res.status(200).json({ success: true, threadId });
      return;
    }

    // --- DECLINE_THREAD: decline/delete a pending thread (owner/admin only) ---
    if (action === 'decline_thread') {
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || (requesterRow.role !== 'owner' && requesterRow.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Only owner and admin can decline threads' });
        return;
      }

      const { threadId } = body;

      if (!threadId) {
        res.status(400).json({ success: false, error: 'Missing thread ID' });
        return;
      }

      const { error: deleteErr } = await supabaseAdmin
        .from('threads')
        .delete()
        .eq('id', threadId);

      if (deleteErr) {
        console.error('decline thread error', deleteErr);
        res.status(500).json({ success: false, error: 'Failed to decline thread' });
        return;
      }

      res.status(200).json({ success: true, threadId });
      return;
    }

    // --- LIST_PENDING_THREADS: get pending threads (owner/admin only) ---
    if (action === 'list_pending_threads') {
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || (requesterRow.role !== 'owner' && requesterRow.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Only owner and admin can view pending threads' });
        return;
      }

      const { data: threads, error: listErr } = await supabaseAdmin
        .from('threads')
        .select('id, title, tag, author, content, created_at, section')
        .eq('approved', false)
        .order('created_at', { ascending: false });

      if (listErr) {
        console.error('list pending threads error', listErr);
        res.status(500).json({ success: false, error: 'Failed to load pending threads' });
        return;
      }

      res.status(200).json({ success: true, threads: threads || [] });
      return;
    }

    // --- UPDATE_CONFIG_REQUEST_STATUS: change status of a config request thread (owner/admin only) ---
    if (action === 'update_config_request_status') {
      const { data: requesterRow, error: requesterErr } = await supabaseAdmin
        .from('users')
        .select('role, username')
        .eq('id', userId)
        .maybeSingle();

      if (requesterErr || !requesterRow || (requesterRow.role !== 'owner' && requesterRow.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Only owner and admin can update config request status' });
        return;
      }

      const { threadId, status, download_url } = body;

      if (!threadId) {
        res.status(400).json({ success: false, error: 'Missing thread ID' });
        return;
      }

      const validStatuses = ['in_queue', 'in_progress', 'completed', 'cannot_fulfill'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid status. Use: in_queue, in_progress, completed, cannot_fulfill' });
        return;
      }

      const updateData = { config_request_status: status };
      if (status === 'completed' && download_url) {
        updateData.download_url = download_url;
        updateData.completed_by = requesterRow.username || requesterRow.role;
      }

      const { error: updateErr } = await supabaseAdmin
        .from('threads')
        .update(updateData)
        .eq('id', threadId);

      if (updateErr) {
        console.error('update config request status error', updateErr);
        res.status(500).json({ success: false, error: 'Failed to update status' });
        return;
      }

      res.status(200).json({ success: true, threadId, status });
      return;
    }

    // Unknown action
    res.status(400).json({ success: false, error: 'Unknown action. Use: get, give, spend, create_user, reset_password, approve_thread, decline_thread, list_pending_threads, update_config_request_status, movie_search, movie_play' });
  } catch (err) {
    console.error('credits handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
