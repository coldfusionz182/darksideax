// movies.js

const searchInput = document.getElementById('movie-search-input');
const searchBtn = document.getElementById('movie-search-btn');
const resultsContainer = document.getElementById('movies-results');
const resultsCount = document.getElementById('results-count');

let isSearching = false;

// Search on button click
searchBtn.addEventListener('click', performSearch);

// Search on Enter key
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch();
});

async function performSearch() {
  const query = searchInput.value.trim();
  if (!query || isSearching) return;

  isSearching = true;
  searchBtn.disabled = true;
  searchBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Searching...';

  // Clear previous results
  resultsContainer.innerHTML = `
    <div class="movies-loading">
      <i class="fa fa-spinner fa-spin"></i>
      Searching for "${escapeHtml(query)}"...
    </div>`;
  resultsCount.textContent = '';

  try {
    const resp = await fetch(`/api/movie-search?q=${encodeURIComponent(query)}`);
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || 'Search failed');
    }

    displayResults(data);
  } catch (err) {
    resultsContainer.innerHTML = `
      <div class="movies-empty">
        <i class="fa fa-exclamation-triangle"></i>
        <p>Search failed: ${escapeHtml(err.message)}</p>
      </div>`;
  } finally {
    isSearching = false;
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<i class="fa fa-search"></i> Search';
  }
}

function displayResults(data) {
  const countText = data.count_text || '';
  const results = data.results || [];

  if (countText) {
    resultsCount.textContent = countText;
  } else if (results.length > 0) {
    resultsCount.textContent = `Found ${results.length} results`;
  } else {
    resultsCount.textContent = '';
  }

  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="movies-empty">
        <i class="fa fa-search"></i>
        <p>${countText || 'No results found. Try a different search term.'}</p>
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'movies-grid';

  results.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'movie-card movie-card-anim';
    card.style.animationDelay = `${idx * 0.05}s`;

    // Determine badge class
    let badgeClass = 'badge-other';
    let badgeText = item.type || '';
    if (item.type.toLowerCase() === 'movie') badgeClass = 'badge-movie';
    else if (item.type.toLowerCase() === 'series') badgeClass = 'badge-series';

    // Build meta text
    const metaParts = [];
    if (item.year) metaParts.push(item.year);
    if (item.type) metaParts.push(item.type);
    const metaText = metaParts.join(' · ');

    card.innerHTML = `
      <div class="movie-card-poster">
        ${item.image_url
          ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
             <div class="poster-placeholder" style="display:none;"><i class="fa fa-film"></i></div>`
          : `<div class="poster-placeholder"><i class="fa fa-film"></i></div>`
        }
        ${badgeText ? `<span class="movie-card-badge ${badgeClass}">${escapeHtml(badgeText)}</span>` : ''}
        <div class="play-overlay"><i class="fa fa-play-circle"></i></div>
      </div>
      <div class="movie-card-info">
        <div class="movie-card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        ${metaText ? `<div class="movie-card-meta">${escapeHtml(metaText)}</div>` : ''}
      </div>
      <button class="movie-card-play" data-href="${escapeHtml(item.href)}" data-title="${escapeHtml(item.title)}">
        <i class="fa fa-play"></i> Play
      </button>
    `;

    // Click on card or play button opens stream
    const playBtn = card.querySelector('.movie-card-play');
    const openStream = () => {
      const href = playBtn.dataset.href;
      const title = playBtn.dataset.title;
      const url = `https://streamimdb.ru${href}`;
      window.open(url, '_blank');
    };

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openStream();
    });

    card.addEventListener('click', openStream);

    grid.appendChild(card);
  });

  resultsContainer.innerHTML = '';
  resultsContainer.appendChild(grid);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
