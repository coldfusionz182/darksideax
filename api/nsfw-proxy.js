import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ffmkkwskvjvytdddevmm.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWtrd3Nrdmp2eXRkZGRldm1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2NTg5NSwiZXhwIjoyMDkxMjQxODk1fQ.YtaWFdm-gyqpqzoVyZTCBTk8rS8Ckm5cOYsun8GwGlQ';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const USERNAME = 'gpanter22@aol.com';
const PASSWORD = '7911MAge21';

async function doLogin() {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

  // Step 1: GET /login to fetch CSRF token
  console.log('Fetching CSRF from https://nubilefilms.com/login');
  const csrfRes = await fetch('https://nubilefilms.com/login', {
    headers: {
      'host': 'nubilefilms.com',
      'connection': 'keep-alive',
      'cache-control': 'max-age=0',
      'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'origin': 'https://nubilefilms.com',
      'content-type': 'application/x-www-form-urlencoded',
      'upgrade-insecure-requests': '1',
      'user-agent': ua,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'sec-fetch-dest': 'document',
      'referer': 'https://nubilefilms.com/',
      'accept-language': 'en-GB,en;q=0.9',
      'accept-encoding': 'gzip, deflate',
    },
    redirect: 'follow',
  });

  const html = await csrfRes.text();

  // Check for ban/captcha
  if (html.includes('turnstile-card') || html.includes('Just a moment') || html.includes('Security Check')) {
    throw new Error('Cloudflare captcha triggered');
  }

  const csrfMatch = html.match(/name=["']csrf-token["']\s*type=["']hidden["']\s*value=["']([^"']+)["']/i);
  if (!csrfMatch) {
    console.log('Login page HTML preview:', html.substring(0, 1500));
    throw new Error('CSRF token not found');
  }
  const csrf = csrfMatch[1];
  console.log('CSRF found:', csrf.substring(0, 30) + '...');

  // Capture cookies from CSRF response
  const setCookie = csrfRes.headers.getSetCookie?.() || csrfRes.headers.get('set-cookie');
  const cookies = parseCookies(setCookie);

  // Step 2: POST /authentication/login
  const loginUrl = 'https://nubilefilms.com/authentication/login';
  const body = `username=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(PASSWORD)}&r=members.nubilefilms.com%2Fvideo%2Fgallery&csrf-token=${encodeURIComponent(csrf)}&sign-in=Sign+In`;

  console.log('POST login to', loginUrl);
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'host': 'nubilefilms.com',
      'connection': 'keep-alive',
      'cache-control': 'max-age=0',
      'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'origin': 'https://nubilefilms.com',
      'content-type': 'application/x-www-form-urlencoded',
      'upgrade-insecure-requests': '1',
      'user-agent': ua,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'sec-fetch-dest': 'document',
      'referer': 'https://nubilefilms.com/',
      'accept-language': 'en-GB,en;q=0.9',
      'accept-encoding': 'gzip, deflate',
      'cookie': cookies,
    },
    body: body,
    redirect: 'manual',
  });

  const loginHtml = await loginRes.text();

  // Check login result
  if (loginHtml.includes('The username or password you\'ve entered is incorrect or blocked')) {
    throw new Error('Invalid credentials');
  }
  if (loginHtml.includes('Your subscription has expired')) {
    throw new Error('Subscription expired');
  }

  const loginSetCookie = loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie');
  const loginCookies = parseCookies(loginSetCookie);
  const status = loginRes.status;
  const location = loginRes.headers.get('location') || '';

  console.log('Login status:', status, 'redirect:', location);

  // Merge cookies
  const allCookies = [cookies, loginCookies].filter(Boolean).join('; ');
  return allCookies;
}

function parseCookies(setCookieHeaders) {
  const cookies = [];
  if (!setCookieHeaders) return '';
  const raw = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const h of raw) {
    const c = h.split(';')[0];
    if (c) cookies.push(c);
  }
  return cookies.join('; ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Verify user is admin/owner
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token' });
      return;
    }

    const accessToken = authHeader.slice('Bearer '.length);

    // Decode JWT payload directly (avoids Supabase client conflicts)
    function decodeJwt(token) {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
        return JSON.parse(payload);
      } catch {
        return null;
      }
    }

    const jwtPayload = decodeJwt(accessToken);
    if (!jwtPayload || !jwtPayload.sub) {
      res.status(401).json({ success: false, error: 'Invalid token format' });
      return;
    }

    const userId = jwtPayload.sub;
    console.log('JWT userId:', userId);

    const { data: userRow, error: roleErr } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    console.log('DB lookup result:', { userRow, roleErr });

    if (roleErr || !userRow || (userRow.role !== 'owner' && userRow.role !== 'admin')) {
      res.status(403).json({ success: false, error: 'Admin/Owner access required', debug: { userId, userRow, roleErr } });
      return;
    }

    const { action, videoUrl } = req.body || {};

    // Login and get fresh session cookies
    let cookies;
    try {
      cookies = await doLogin();
    } catch (loginErr) {
      console.error('Login flow error:', loginErr);
      res.status(502).json({ success: false, error: 'Login failed: ' + loginErr.message });
      return;
    }

    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

    // Fetch video gallery page
    if (action === 'gallery') {
      try {
        const response = await fetch('https://members.nubilefilms.com/video/gallery', {
          headers: {
            'Cookie': cookies,
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Referer': 'https://members.nubilefilms.com/',
            'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'upgrade-insecure-requests': '1',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-dest': 'document',
            'cache-control': 'max-age=0',
          },
          redirect: 'follow',
        });

        console.log('Gallery response status:', response.status);

        if (!response.ok) {
          const errHtml = await response.text();
          res.status(502).json({
            success: false,
            error: `Upstream returned ${response.status}`,
            status: response.status,
            preview: errHtml.substring(0, 300),
          });
          return;
        }

        const html = await response.text();
        const videos = [];

        // Pattern 1: Video cards with data attributes
        const cardRegex = /<a[^>]*href="([^"]*video\/[^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>[\s\S]*?<\/a>/gi;
        let match;
        while ((match = cardRegex.exec(html)) !== null) {
          videos.push({
            url: match[1].startsWith('http') ? match[1] : 'https://members.nubilefilms.com' + match[1],
            thumbnail: match[2],
            title: match[3] || 'Untitled',
          });
        }

        // Pattern 2: Generic thumbnail + title extraction
        if (videos.length === 0) {
          const thumbRegex = /<img[^>]*(?:data-)?src="([^"]+(?:thumbnail|preview|cover)[^"]*)"[^>]*>/gi;
          const titleRegex = /<h[2-4][^>]*>([^<]+)<\/h[2-4]>/gi;
          const thumbs = [];
          const titles = [];
          while ((match = thumbRegex.exec(html)) !== null) thumbs.push(match[1]);
          while ((match = titleRegex.exec(html)) !== null) titles.push(match[1].trim());
          for (let i = 0; i < Math.min(thumbs.length, titles.length, 20); i++) {
            videos.push({ url: 'https://members.nubilefilms.com/video/gallery', thumbnail: thumbs[i], title: titles[i] });
          }
        }

        res.status(200).json({
          success: true,
          videos: videos.slice(0, 24),
          rawHtmlPreview: html.substring(0, 500) + '...',
          totalFound: videos.length
        });
      } catch (fetchErr) {
        console.error('Fetch error:', fetchErr);
        res.status(502).json({ success: false, error: 'Failed to fetch from upstream', details: fetchErr.message });
      }
    }

    // Fetch specific video page for embed
    else if (action === 'video' && videoUrl) {
      try {
        const response = await fetch(videoUrl, {
          headers: {
            'Cookie': cookies,
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://members.nubilefilms.com/video/gallery',
          },
        });

        if (!response.ok) {
          res.status(502).json({ success: false, error: 'Failed to fetch video page' });
          return;
        }

        const html = await response.text();
        const m3u8Match = html.match(/["']([^"']+\.m3u8[^"']*)["']/);
        const mp4Match = html.match(/["']([^"']+\.mp4[^"']*)["']/);
        const posterMatch = html.match(/poster=["']([^"']+)["']/);
        const iframeMatch = html.match(/<iframe[^>]*src=["']([^"']+)["']/);

        res.status(200).json({
          success: true,
          videoUrl: m3u8Match ? m3u8Match[1] : (mp4Match ? mp4Match[1] : null),
          poster: posterMatch ? posterMatch[1] : null,
          embedUrl: iframeMatch ? iframeMatch[1] : null,
          html: html.substring(0, 2000),
        });
      } catch (fetchErr) {
        res.status(502).json({ success: false, error: fetchErr.message });
      }
    }

    else {
      res.status(400).json({ success: false, error: 'Invalid action' });
    }

  } catch (err) {
    console.error('NSFW proxy error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
