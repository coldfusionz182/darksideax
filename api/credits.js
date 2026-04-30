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
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };

        const fetchPage = async (url) => {
          const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
          if (!r.ok) return '';
          return r.text();
        };

        // Helper: extract cards from a cheerio doc
        const extractCards = ($, container) => {
          const items = [];
          container.find('.cb-card').each((_, card) => {
            const $card = $(card);
            const $link = $card.find('a[href]').first();
            const $posterImg = $card.find('.cb-card-poster img').first();
            const $title = $card.find('.cb-card-title');
            const $meta = $card.find('.cb-card-meta');
            const $mcMeta = $card.find('.cb-card-mc-meta');
            const $plot = $card.find('.cb-card-mc-plot');

            const href = $link.attr('href') || '';
            const image_url = $posterImg.attr('src') || $card.find('img').first().attr('src') || '';
            const title = $title.text().trim() || $posterImg.attr('alt') || '';
            const metaText = $meta.text().trim();

            let year = '';
            const yearM = metaText.match(/\b(19|20)\d{2}\b/);
            if (yearM) year = yearM[0];

            let type = '';
            if ($mcMeta.length) {
              const mcText = $mcMeta.text();
              if (/movie/i.test(mcText)) type = 'Movie';
              else if (/tv|series/i.test(mcText)) type = 'Series';
            }

            const description = $plot.text().trim() || '';

            if (href && title) {
              items.push({ href, image_url, title, type, year, description });
            }
          });
          return items;
        };

        // Fetch homepage
        const homeHtml = await fetchPage('https://streamimdb.ru/');
        if (!homeHtml) {
          res.status(200).json({ success: true, categories: {} });
          return;
        }

        const $ = cheerio.load(homeHtml);
        const categories = {};

        // Extract hero slider items with bg_url
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
          const image_url = $logo.attr('src') || '';

          // Extract background image URL from style attribute
          let bg_url = '';
          const bgStyle = $bg.attr('style') || '';
          const bgMatch = bgStyle.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/);
          if (bgMatch) bg_url = bgMatch[1];

          let year = '';
          let genres = [];
          $slide.find('.cb-slide-meta span').not('.cb-slide-dot').each((_, sp) => {
            const txt = $(sp).text().trim();
            if (/^\d{4}$/.test(txt)) year = txt;
            else if (txt && txt !== '·') genres.push(txt);
          });

          if (embed || href) {
            heroItems.push({ title, href, embed, image_url, bg_url, type: 'Movie', year, genres });
          }
        });
        if (heroItems.length > 0) {
          categories.hero = heroItems;
        }

        // Extract category sections by h2 headings
        const categoryMap = {
          'TOP 10': 'top10',
          'Trending Today': 'trending',
          'Popular Now': 'popular',
          'Latest Episodes': 'latest_episodes',
          'Latest TV Shows': 'latest',
          'Top Rated': 'top_rated',
        };

        $('h2').each((_, h2el) => {
          const h2Text = $(h2el).text().trim();
          const catKey = categoryMap[h2Text];
          if (!catKey) return;

          // Walk to the next sibling container that holds cards
          let $section = $(h2el).next();
          let attempts = 0;
          while ($section.length && attempts < 5 && !$section.find('.cb-card, a[href*="/movie/"], a[href*="/tv/"]').length) {
            $section = $section.next();
            attempts++;
          }

          const items = extractCards($, $section);

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
                items.push({ href, image_url, title, type: '', year, description: '' });
              }
            });
          }

          if (items.length > 0) {
            categories[catKey] = items;
            console.log(`Found ${items.length} items in ${catKey} (${h2Text})`);
          }
        });

        // Also extract all cards on homepage not yet captured
        const existingHrefs = new Set();
        Object.values(categories).forEach(cat => cat.forEach(item => existingHrefs.add(item.href)));

        const homeAllCards = extractCards($, $('body'));
        const uncategorized = homeAllCards.filter(item => !existingHrefs.has(item.href));
        if (uncategorized.length > 0) {
          categories.more = uncategorized.slice(0, 20);
        }

        // Fetch /movies page for more popular movies
        let totalMovieCount = '';
        try {
          const moviesHtml = await fetchPage('https://streamimdb.ru/movies');
          if (moviesHtml) {
            const $m = cheerio.load(moviesHtml);
            const movieCards = extractCards($m, $m('body'));
            const newMovies = movieCards.filter(item => !existingHrefs.has(item.href));
            if (newMovies.length > 0) {
              categories.popular_movies = newMovies.slice(0, 30);
              newMovies.forEach(item => existingHrefs.add(item.href));
            }
            // Extract total count
            const $subtitle = $m('.cb-list-subtitle');
            if ($subtitle.length) {
              totalMovieCount = $subtitle.text().trim();
            }
          }
        } catch (e) { console.error('Failed to fetch /movies:', e.message); }

        // Fetch /tv-shows page for more series
        try {
          const tvHtml = await fetchPage('https://streamimdb.ru/tv-shows');
          if (tvHtml) {
            const $t = cheerio.load(tvHtml);
            const tvCards = extractCards($t, $t('body'));
            const newTv = tvCards.filter(item => !existingHrefs.has(item.href));
            if (newTv.length > 0) {
              categories.popular_series = newTv.slice(0, 30);
            }
          }
        } catch (e) { console.error('Failed to fetch /tv-shows:', e.message); }

        res.status(200).json({ success: true, categories, total_movie_count: totalMovieCount });
        return;
      } catch (err) {
        console.error('movie_fetch_homepage error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch homepage' });
        return;
      }
    }

    // movie_fetch_movies_page does not require auth - paginated movie listing
    if (body.action === 'movie_fetch_movies_page') {
      const page = parseInt(body.page) || 1;
      const genre = (body.genre || '').trim();

      try {
        let moviesUrl = 'https://streamimdb.ru/movies';
        const params = [];
        if (genre) params.push(`genre=${encodeURIComponent(genre)}`);
        params.push(`page=${page}`);
        moviesUrl += '?' + params.join('&');

        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        };

        const response = await fetch(moviesUrl, { headers, signal: AbortSignal.timeout(20000) });
        if (!response.ok) {
          res.status(200).json({ success: true, movies: [], total_count: '', page });
          return;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract total count
        let totalCount = '';
        const $subtitle = $('.cb-list-subtitle');
        if ($subtitle.length) {
          totalCount = $subtitle.text().trim();
        }

        // Extract movies
        const movies = [];
        $('.cb-card').each((_, card) => {
          const $card = $(card);
          const $link = $card.find('a[href]').first();
          const $posterImg = $card.find('.cb-card-poster img').first();
          const $title = $card.find('.cb-card-title');
          const $meta = $card.find('.cb-card-meta');
          const $mcMeta = $card.find('.cb-card-mc-meta');
          const $plot = $card.find('.cb-card-mc-plot');

          const href = $link.attr('href') || '';
          const image_url = $posterImg.attr('src') || $card.find('img').first().attr('src') || '';
          const title = $title.text().trim() || $posterImg.attr('alt') || '';
          const metaText = $meta.text().trim();

          let year = '';
          const yearM = metaText.match(/\b(19|20)\d{2}\b/);
          if (yearM) year = yearM[0];

          let type = '';
          if ($mcMeta.length) {
            const mcText = $mcMeta.text();
            if (/movie/i.test(mcText)) type = 'Movie';
            else if (/tv|series/i.test(mcText)) type = 'Series';
          }

          const description = $plot.text().trim() || '';

          if (href && title) {
            movies.push({ href, image_url, title, type, year, description });
          }
        });

        // Fallback: try direct links
        if (movies.length === 0) {
          $('a[href*="/movie/"]').each((_, link) => {
            const $link = $(link);
            const $img = $link.find('img').first();
            const href = $link.attr('href') || '';
            const image_url = $img.attr('src') || '';
            const title = $img.attr('alt') || $link.attr('title') || $link.text().trim().split('\n')[0].trim();

            let year = '';
            const yearM = $link.text().match(/\b(19|20)\d{2}\b/);
            if (yearM) year = yearM[0];

            if (href && title) {
              movies.push({ href, image_url, title, type: 'Movie', year, description: '' });
            }
          });
        }

        // Check if there's a next page
        const hasNextPage = $('.cb-pagination a[href*="page=' + (page + 1) + '"]').length > 0 ||
                            $('.cb-pagination-next, .next, [rel="next"]').length > 0;

        res.status(200).json({ success: true, movies, total_count: totalCount, page, has_next: hasNextPage || movies.length >= 30 });
        return;
      } catch (err) {
        console.error('movie_fetch_movies_page error:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch movies page' });
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
          const $posterImg = $card.find('.cb-card-poster img').first();
          const $title = $card.find('.cb-card-title');
          const $meta = $card.find('.cb-card-meta');
          const $mcMeta = $card.find('.cb-card-mc-meta');
          const $plot = $card.find('.cb-card-mc-plot');

          const href = $link.attr('href') || '';
          const image_url = $posterImg.attr('src') || $card.find('img').first().attr('src') || '';
          const title = $title.text().trim() || $posterImg.attr('alt') || '';
          const metaText = $meta.text().trim();

          let year = '';
          const yearM = metaText.match(/\b(19|20)\d{2}\b/);
          if (yearM) year = yearM[0];

          let type = '';
          if ($mcMeta.length) {
            const mcText = $mcMeta.text();
            if (/movie/i.test(mcText)) type = 'Movie';
            else if (/tv|series/i.test(mcText)) type = 'Series';
          }

          const description = $plot.text().trim() || '';

          if (href && title) {
            results.push({ href, image_url, title, type, year, description });
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
              results.push({ href, image_url, title, type: '', year, description: '' });
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

        // ── Strategy 1: Extract data-src from #cbMoviePlayer iframe ──
        // VidAPI sites use a lazy-loaded iframe: <iframe id="cbMoviePlayer" data-src="/embed/movie/20043">
        // The embed URL is: https://streamimdb.ru/embed/movie/{id} or /embed/tv/{id}/{season}/{episode}
        let embedPath = '';
        const $player = $('#cbMoviePlayer');
        if ($player.length) {
          embedPath = $player.attr('data-src') || '';
          console.log(`Found cbMoviePlayer data-src: ${embedPath}`);
        }

        // ── Strategy 2: Extract from __cbCwMeta JS variable ──
        // window.__cbCwMeta = {"type":"movie","id":"20043","title":"...","poster":"...","href":"..."}
        // The id is a TMDB ID used to construct: /embed/movie/{id} or /embed/tv/{id}
        if (!embedPath) {
          const metaMatch = html.match(/window\.__cbCwMeta\s*=\s*(\{[\s\S]*?\})\s*;/);
          if (metaMatch) {
            try {
              const meta = JSON.parse(metaMatch[1]);
              if (meta.id) {
                const isTv = meta.type === 'tv' || meta.type === 'series' || href.startsWith('/tv/');
                if (isTv) {
                  // Extract season/episode from href
                  const epMatch = href.match(/\/season\/(\d+)\/episode\/(\d+)/);
                  const season = epMatch ? parseInt(epMatch[1]) : 1;
                  const episode = epMatch ? parseInt(epMatch[2]) : 1;
                  embedPath = `/embed/tv/${meta.id}/${season}/${episode}`;
                } else {
                  embedPath = `/embed/movie/${meta.id}`;
                }
                console.log(`Constructed embed path from __cbCwMeta: ${embedPath} (type=${meta.type}, id=${meta.id})`);
              }
            } catch (e) {}
          }
        }

        // ── Strategy 3: Try data-src on any iframe with embed in path ──
        if (!embedPath) {
          const $dataSrc = $('[data-src*="embed"]');
          if ($dataSrc.length) {
            embedPath = $dataSrc.attr('data-src') || '';
          }
        }

        // ── Strategy 4: Try iframe src attributes ──
        if (!embedPath) {
          const $iframe = $('iframe[src*="embed"]');
          if ($iframe.length) {
            embedPath = $iframe.attr('src') || '';
          }
        }

        if (!embedPath) {
          const $iframe = $('iframe[src]');
          if ($iframe.length) {
            const src = $iframe.attr('src') || '';
            // Skip YouTube trailer iframes
            if (!src.includes('youtube')) {
              embedPath = src;
            }
          }
        }

        // ── Strategy 5: Check for data-embed on play buttons (homepage hero) ──
        if (!embedPath) {
          const $playBtn = $('.cb-slide-play, [data-embed]');
          if ($playBtn.length) {
            embedPath = $playBtn.attr('data-embed') || '';
          }
        }

        // ── Strategy 6: For TV series, try fetching episode page ──
        if (!embedPath && href.startsWith('/tv/')) {
          const $firstEp = $('a[href*="/season/1/episode/1"]').first();
          if ($firstEp.length) {
            const episodeUrl = `https://streamimdb.ru${$firstEp.attr('href')}`;
            const episodeResp = await fetch(episodeUrl, { headers, signal: AbortSignal.timeout(15000) });
            if (episodeResp.ok) {
              const episodeHtml = await episodeResp.text();

              // Try cbMoviePlayer data-src on episode page
              const $$ = cheerio.load(episodeHtml);
              const $epPlayer = $$('#cbMoviePlayer');
              if ($epPlayer.length) {
                embedPath = $epPlayer.attr('data-src') || '';
              }

              // Try __cbCwMeta on episode page
              if (!embedPath) {
                const epMetaMatch = episodeHtml.match(/window\.__cbCwMeta\s*=\s*(\{[\s\S]*?\})\s*;/);
                if (epMetaMatch) {
                  try {
                    const meta = JSON.parse(epMetaMatch[1]);
                    if (meta.id) {
                      const epMatch = href.match(/\/season\/(\d+)\/episode\/(\d+)/);
                      const season = epMatch ? parseInt(epMatch[1]) : 1;
                      const episode = epMatch ? parseInt(epMatch[2]) : 1;
                      embedPath = `/embed/tv/${meta.id}/${season}/${episode}`;
                    }
                  } catch (e) {}
                }
              }

              // Fallback: data-src on any element
              if (!embedPath) {
                const $dataSrc2 = $$('[data-src*="embed"]');
                if ($dataSrc2.length) {
                  embedPath = $dataSrc2.attr('data-src') || '';
                }
              }
            }
          }
        }

        if (embedPath) {
          // Normalize: if it starts with http, extract just the path
          if (embedPath.startsWith('http')) {
            try {
              const urlObj = new URL(embedPath);
              embedPath = urlObj.pathname;
            } catch (e) {}
          }

          // Ensure path starts with /
          if (!embedPath.startsWith('/')) {
            embedPath = '/' + embedPath;
          }

          const embedUrl = `https://streamimdb.ru${embedPath}`;
          console.log(`Final embed URL: ${embedUrl}`);

          // Extract __cbCwMeta for extra info
          let meta = {};
          const metaMatch2 = html.match(/window\.__cbCwMeta\s*=\s*(\{[\s\S]*?\})\s*;/);
          if (metaMatch2) {
            try { meta = JSON.parse(metaMatch2[1]); } catch (e) {}
          }

          res.status(200).json({ success: true, embed_url: embedUrl, meta });
          return;
        }

        // ── Final fallback: Return the movie page URL itself ──
        console.warn(`No embed found for ${href}, returning direct page URL`);
        res.status(200).json({ success: true, embed_url: movieUrl, direct_page: true, meta: {} });
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
    res.status(400).json({ success: false, error: 'Unknown action. Use: get, give, spend, create_user, reset_password, approve_thread, decline_thread, list_pending_threads, update_config_request_status, movie_search, movie_play, movie_fetch_episodes, movie_fetch_homepage, movie_fetch_movies_page' });
  } catch (err) {
    console.error('credits handler error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}
