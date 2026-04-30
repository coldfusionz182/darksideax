// api/movie-search.js
// Server-side proxy to search streamimdb.ru and return parsed results as JSON

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      res.status(400).json({ error: 'Missing search query (?q=...)' });
      return;
    }

    const queryParam = query.replace(/\s+/g, '+');
    const searchUrl = `https://streamimdb.ru/search?q=${queryParam}`;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    const response = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(15000) });

    if (!response.ok) {
      res.status(502).json({ error: 'Upstream search failed', count_text: '', results: [] });
      return;
    }

    const html = await response.text();

    // Check for no results
    if (html.includes('<h3>No Results Found</h3>')) {
      res.status(200).json({ count_text: 'No Results Found', results: [] });
      return;
    }

    // Extract results count text
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

    // Extract cards by splitting on card markers
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
          title: titleMatch[1],
          type: badgeMatch ? badgeMatch[1] : '',
          year: yearMatch ? yearMatch[1].trim() : '',
        });
      }
    }

    res.status(200).json({ count_text: countText, results });
  } catch (err) {
    console.error('movie-search error:', err);
    res.status(500).json({ error: 'Search failed', count_text: '', results: [] });
  }
}
