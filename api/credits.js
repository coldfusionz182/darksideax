// api/credits.js – Combined credits API (get / give / spend / create-user / reset-password)
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import * as cheerio from 'cheerio';

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

    // movie_fetch_homepage does not require auth - fetches all categories from homepage
    if (body.action === 'movie_fetch_homepage') {
      try {
        const homeUrl = 'https://streamimdb.ru/';
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };

        const response = await fetch(homeUrl, { headers, signal: AbortSignal.timeout(20000) });

        if (!response.ok) {
          console.error('Failed to fetch homepage:', response.status);
          res.status(200).json({ success: true, categories: {} });
          return;
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const categories = {};

        // Extract hero slider items
        const heroItems = [];
        $('.cb-slide').each((_, el) => {
          const $slide = $(el);
          const $playBtn = $slide.find('.cb-slide-play');
          const $detailLink = $slide.find('.cb-btn-ghost-sm');
          const $logo = $slide.find('.cb-slide-title-logo');
          const $bg = $slide.find('.cb-slide-bg');

          const title = $playBtn.attr('data-title') || $logo.attr('alt') || '';
          const embed = $playBtn.attr('data-embed') || '';
          const href = $detailLink.attr('href') || '';
          const image_url = $logo.attr('src') || $bg.css('background-image')?.replace(/url\(['"]?|['"]?\)/g, '') || '';

          // Parse meta spans for year and type
          let year = '';
          let type = '';
          const metaSpans = $slide.find('.cb-slide-meta span').not('.cb-slide-dot').not('i').parent();
          $slide.find('.cb-slide-meta span').not('.cb-slide-dot').each((_, sp) => {
            const txt = $(sp).text().trim();
            if (/^\d{4}$/.test(txt)) year = txt;
          });

          if (embed || href) {
            heroItems.push({ title, href, embed, image_url, type: type || 'Movie', year });
          }
        });
        if (heroItems.length > 0) {
          categories.hero = heroItems;
        }

        // Extract category sections by h2 headings
        const categoryMap = {
          'Trending Today': 'trending',
          'Popular Now': 'popular',
          'Latest TV Shows': 'latest',
          'Top Rated': 'top_rated',
          'TOP 10': 'top10',
        };

        // Find all h2 elements and process the section after each
        $('h2').each((_, h2el) => {
          const h2Text = $(h2el).text().trim();
          const catKey = categoryMap[h2Text];
          if (!catKey) return;

          // Walk to the next sibling container that holds cards
          let $section = $(h2el).next();
          while ($section.length && !$section.find('.cb-card, .cb-flx-item, a[href*="/movie/"], a[href*="/tv/"]').length) {
            $section = $section.next();
          }

          const items = [];
          // Try .cb-card elements first
          $section.find('.cb-card').each((_, card) => {
            const $card = $(card);
            const $link = $card.find('a[href]').first();
            const $img = $card.find('img').first();
            const $badge = $card.find('.cb-card-badge');
            const $title = $card.find('.cb-card-title');
            const $meta = $card.find('.cb-card-meta');

            const href = $link.attr('href') || '';
            const image_url = $img.attr('src') || '';
            const title = $title.attr('title') || $title.text().trim() || '';
            const badge = $badge.text().trim();
            const metaText = $meta.text().trim();

            let year = '';
            let type = badge;
            const yearM = metaText.match(/\b(19|20)\d{2}\b/);
            if (yearM) year = yearM[0];

            if (href && title) {
              items.push({ href, image_url, title, type, year });
            }
          });

          // Fallback: try .cb-flx-item (flex list items)
          if (items.length === 0) {
            $section.find('.cb-flx-item').each((_, item) => {
              const $item = $(item);
              const $link = $item.find('a[href]').first();
              const $img = $item.find('img').first();
              const $title = $item.find('.cb-flx-title, h3, [class*="title"]').first();
              const $badge = $item.find('[class*="badge"], [class*="type"]');

              const href = $link.attr('href') || '';
              const image_url = $img.attr('src') || '';
              const title = $title.text().trim() || $link.attr('title') || $img.attr('alt') || '';
              const type = $badge.text().trim();

              let year = '';
              const yearM = $item.text().match(/\b(19|20)\d{2}\b/);
              if (yearM) year = yearM[0];

              if (href && title) {
                items.push({ href, image_url, title, type, year });
              }
            });
          }

          // Fallback: try direct links with movie/tv hrefs
          if (items.length === 0) {
            $section.find('a[href*="/movie/"], a[href*="/tv/"]').each((_, link) => {
              const $link = $(link);
              const $img = $link.find('img').first();
              const href = $link.attr('href') || '';
              const image_url = $img.attr('src') || '';
              const title = $img.attr('alt') || $link.attr('title') || $link.text().trim().split('\n')[0].trim();

              let year = '';
              const yearM = $link.text().match(/\b(19|20)\d{2}\b/);
              if (yearM) year = yearM[0];

              if (href && title) {
                items.push({ href, image_url, title, type: '', year });
              }
            });
          }

          if (items.length > 0) {
            categories[catKey] = items;
            console.log(`Found ${items.length} items in ${catKey} (${h2Text})`);
          }
        });

        // If no categories found via h2, try extracting all cards from the page
        if (Object.keys(categories).length === 0) {
          console.log('No categories found via h2, trying all cards');
          const allItems = [];
          $('.cb-card').each((_, card) => {
            const $card = $(card);
            const $link = $card.find('a[href]').first();
            const $img = $card.find('img').first();
            const $badge = $card.find('.cb-card-badge');
            const $title = $card.find('.cb-card-title');
            const $meta = $card.find('.cb-card-meta');

            const href = $link.attr('href') || '';
            const image_url = $img.attr('src') || '';
            const title = $title.attr('title') || $title.text().trim() || '';
            const badge = $badge.text().trim();
            const metaText = $meta.text().trim();

            let year = '';
            let type = badge;
            const yearM = metaText.match(/\b(19|20)\d{2}\b/);
            if (yearM) year = yearM[0];

            if (href && title) {
              allItems.push({ href, image_url, title, type, year });
            }
          });

          // Also try hero slides
          if (allItems.length === 0) {
            $('.cb-slide').each((_, el) => {
              const $slide = $(el);
              const $playBtn = $slide.find('.cb-slide-play');
              const $detailLink = $slide.find('.cb-btn-ghost-sm');
              const $logo = $slide.find('.cb-slide-title-logo');

              const title = $playBtn.attr('data-title') || $logo.attr('alt') || '';
              const href = $detailLink.attr('href') || '';
              const image_url = $logo.attr('src') || '';

              let year = '';
              $slide.find('.cb-slide-meta span').not('.cb-slide-dot').each((_, sp) => {
                const txt = $(sp).text().trim();
                if (/^\d{4}$/.test(txt)) year = txt;
              });

              if (href && title) {
                allItems.push({ href, image_url, title, type: 'Movie', year });
              }
            });
          }

          if (allItems.length > 0) {
            categories.all = allItems.slice(0, 20);
            console.log(`Found ${allItems.length} total items`);
          }
        }

        res.status(200).json({ success: true, categories });
        return;
      } catch (err) {
        console.error('movie_fetch_homepage error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch homepage' });
        return;
      }
    }

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
        const $ = cheerio.load(html);

        if ($('h3').text().includes('No Results Found')) {
          res.status(200).json({ success: true, count_text: 'No Results Found', results: [] });
          return;
        }

        let countText = '';
        const $countEl = $('.cb-search-results-title');
        if ($countEl.length) {
          countText = $countEl.text().trim();
        }

        const results = [];
        $('.cb-card').each((_, card) => {
          const $card = $(card);
          const $link = $card.find('a[href]').first();
          const $img = $card.find('img').first();
          const $badge = $card.find('.cb-card-badge');
          const $title = $card.find('.cb-card-title');
          const $meta = $card.find('.cb-card-meta');

          const href = $link.attr('href') || '';
          const image_url = $img.attr('src') || '';
          const title = $title.attr('title') || $title.text().trim() || '';
          const badge = $badge.text().trim();
          const metaText = $meta.text().trim();

          let year = '';
          let type = badge;
          const yearM = metaText.match(/\b(19|20)\d{2}\b/);
          if (yearM) year = yearM[0];

          if (href && title) {
            results.push({ href, image_url, title, type, year });
          }
        });

        // Fallback: try links with movie/tv hrefs if no cards found
        if (results.length === 0) {
          $('a[href*="/movie/"], a[href*="/tv/"]').each((_, link) => {
            const $link = $(link);
            const $img = $link.find('img').first();
            const href = $link.attr('href') || '';
            const image_url = $img.attr('src') || '';
            const title = $img.attr('alt') || $link.attr('title') || $link.text().trim().split('\n')[0].trim();

            let year = '';
            const yearM = $link.text().match(/\b(19|20)\d{2}\b/);
            if (yearM) year = yearM[0];

            if (href && title) {
              results.push({ href, image_url, title, type: '', year });
            }
          });
        }

        res.status(200).json({ success: true, count_text: countText, results });
        return;
      } catch (err) {
        console.error('movie_search error:', err);
        res.status(500).json({ success: false, error: 'Search failed', count_text: '', results: [] });
        return;
      }
    }

    // movie_fetch_episodes does not require auth
    if (body.action === 'movie_fetch_episodes') {
      const href = (body.href || '').trim();
      if (!href) {
        res.status(400).json({ success: false, error: 'Missing href' });
        return;
      }

      try {
        const seriesUrl = `https://streamimdb.ru${href}`;
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };

        const response = await fetch(seriesUrl, { headers, signal: AbortSignal.timeout(15000) });

        if (!response.ok) {
          res.status(200).json({ success: false, error: 'Could not load series page' });
          return;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const episodes = [];
        const seen = new Set();

        $('a[href*="/season/"][href*="/episode/"]').each((_, el) => {
          const $link = $(el);
          const epHref = $link.attr('href') || '';
          const title = $link.text().trim();

          if (seen.has(epHref)) return;
          seen.add(epHref);

          const parts = epHref.match(/\/season\/(\d+)\/episode\/(\d+)/);
          if (parts) {
            episodes.push({
              href: epHref,
              season: parseInt(parts[1]),
              episode: parseInt(parts[2]),
              title,
            });
          }
        });

        // Sort by season then episode
        episodes.sort((a, b) => {
          if (a.season !== b.season) return a.season - b.season;
          return a.episode - b.episode;
        });

        res.status(200).json({ success: true, episodes });
        return;
      } catch (err) {
        console.error('movie_fetch_episodes error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch episodes' });
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
        const $ = cheerio.load(html);

        // Try to find embed URL via cheerio selectors
        let embedPath = '';

        // Check data-src on iframes/elements
        const $dataSrc = $('[data-src*="embed"]');
        if ($dataSrc.length) {
          embedPath = $dataSrc.attr('data-src') || '';
        }

        // Check iframe src with embed
        if (!embedPath) {
          const $iframe = $('iframe[src*="embed"]');
          if ($iframe.length) {
            embedPath = $iframe.attr('src') || '';
          }
        }

        // Check any iframe src
        if (!embedPath) {
          const $iframe = $('iframe[src]');
          if ($iframe.length) {
            embedPath = $iframe.attr('src') || '';
          }
        }

        // Check for play button with data-embed (like on homepage)
        if (!embedPath) {
          const $playBtn = $('.cb-slide-play, [data-embed]');
          if ($playBtn.length) {
            embedPath = $playBtn.attr('data-embed') || '';
          }
        }

        // For TV series, the main page may not have the player - need to fetch first episode
        if (!embedPath && href.startsWith('/tv/')) {
          const $firstEp = $('a[href*="/season/1/episode/1"]').first();
          if ($firstEp.length) {
            const episodeUrl = `https://streamimdb.ru${$firstEp.attr('href')}`;
            const episodeResp = await fetch(episodeUrl, { headers, signal: AbortSignal.timeout(15000) });
            if (episodeResp.ok) {
              const episodeHtml = await episodeResp.text();
              const $$ = cheerio.load(episodeHtml);

              const $dataSrc2 = $$('[data-src*="embed"]');
              if ($dataSrc2.length) {
                embedPath = $dataSrc2.attr('data-src') || '';
              }
              if (!embedPath) {
                const $iframe2 = $$('iframe[src*="embed"]');
                if ($iframe2.length) {
                  embedPath = $iframe2.attr('src') || '';
                }
              }
              if (!embedPath) {
                const $iframe2 = $$('iframe[src]');
                if ($iframe2.length) {
                  embedPath = $iframe2.attr('src') || '';
                }
              }
            }
          }
        }

        if (!embedPath) {
          res.status(200).json({ success: false, error: 'No embed URL found' });
          return;
        }

        // If the path includes the full URL, extract just the path
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
    res.status(400).json({ success: false, error: 'Unknown action. Use: get, give, spend, create_user, reset_password, approve_thread, decline_thread, list_pending_threads, update_config_request_status, movie_search, movie_play, movie_fetch_episodes, movie_fetch_homepage' });
  } catch (err) {
    console.error('credits handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
