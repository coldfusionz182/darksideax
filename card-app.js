import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY } from './keys.js';

const supabase = createClient('https://ffmkkwskvjvytdddevmm.supabase.co', SUPABASE_ANON_KEY);

function normalizeUrl(url) {
  if (!url) return url;
  url = url.trim();
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return 'https://' + url;
}

async function loadCard() {
  const container = document.getElementById('cardContainer');
  const username = window.location.pathname.replace('/', '').toLowerCase();

  if (!username) {
    container.innerHTML = '<div class="error-message" style="color:#fff;"><h1>No username specified</h1><p><a href="/">Return to Darkside</a></p></div>';
    return;
  }

  try {
    const { data: card, error } = await supabase
      .from('profile_cards')
      .select('*')
      .ilike('username', username)
      .maybeSingle();

    if (error) throw error;

    if (!card || !card.enabled) {
      container.innerHTML = '<div class="error-message" style="color:#fff;"><h1>Profile card not found</h1><p><a href="/">Return to Darkside</a></p></div>';
      return;
    }

    let avatarUrl = card.card_avatar_url || null;
    if (!avatarUrl && card.user_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', card.user_id)
        .maybeSingle();
      avatarUrl = userData?.avatar_url || null;
    }

    renderCard(card, avatarUrl);
  } catch (err) {
    console.error('Load error:', err);
    container.innerHTML = '<div class="error-message" style="color:#fff;"><h1>Error loading profile card</h1><p><a href="/">Return to Darkside</a></p></div>';
  }
}

function renderCard(card, avatarUrl) {
  const container = document.getElementById('cardContainer');
  let videoHtml = '';
  let audioHtml = '';
  const layout = card.profile_layout || 'default';

  if (card.video_url) {
    videoHtml += '<video class="video-background" autoplay muted loop playsinline>';
    videoHtml += '<source src="' + card.video_url + '" type="video/mp4">';
    videoHtml += '</video><div class="overlay"></div>';
  }

  if (card.enable_audio_player && (card.video_url || card.audio_url)) {
    audioHtml = buildAudioPlayer(card);
  }

  const overlayColor = '<div class="overlay" style="background: ' + card.background_color + (card.video_url ? 'aa' : '') + '"></div>';

  const animatedSocial = card.animated_social_buttons || false;
  const socialHtml = card.social_links && card.social_links.length > 0
    ? card.social_links.map(link => {
        const icon = getSocialIcon(link.platform);
        const normalizedUrl = normalizeUrl(link.url);
        return '<a href="' + normalizedUrl + '" class="social-link ' + (animatedSocial ? 'animated' : '') + '" style="background: ' + card.accent_color + '33; color: ' + card.text_color + ';" target="_blank" rel="noopener"><i class="' + icon + '"></i></a>';
      }).join('')
    : '';

  const bioHtml = card.bio
    ? '<p class="bio" id="bioText" style="color: ' + card.text_color + ';' + (card.enable_glitch ? ' animation:glitch 2s infinite;' : '') + '">' + card.bio + '</p>'
    : '';

  const badgeHtml = card.badge
    ? '<div class="badge" style="background: ' + card.accent_color + '; color: #fff;">' + card.badge + '</div>'
    : '';

  const avatarHtml = avatarUrl
    ? '<img src="' + avatarUrl + '" class="card-avatar" alt="Avatar" style="border-color: ' + (card.accent_color || '#7c3aed') + ';">'
    : '';

  const usernameEffect = card.username_effect || 'none';
  const usernameFont = card.username_font || 'default';
  const badgeEffect = card.badge_effect || 'none';
  const badgeFont = card.badge_font || 'default';
  const bioEffect = card.bio_effect || 'none';
  const bioFont = card.bio_font || 'default';

  let particlesHtml = '';
  if (card.enable_particles) {
    particlesHtml = '<div id="particles" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;"></div>';
  }

  let layoutClass = '';
  if (layout === 'left') layoutClass = 'layout-left ';
  else if (layout === 'right') layoutClass = 'layout-right ';
  else if (layout === 'compact') layoutClass = 'layout-compact ';

  container.innerHTML = videoHtml + audioHtml + overlayColor + particlesHtml
    + '<div class="card-content ' + layoutClass + '">'
    + avatarHtml
    + '<h1 class="username ' + usernameEffect + ' ' + usernameFont + '" style="color: ' + card.text_color + ';' + (card.enable_glitch ? ' animation:glitch 2s infinite;' : '') + '">' + card.username + '</h1>'
    + (badgeHtml ? '<div class="badge ' + badgeEffect + ' ' + badgeFont + '" style="background: ' + card.accent_color + '; color: #fff;">' + card.badge + '</div>' : '')
    + (bioHtml ? '<p class="bio ' + bioEffect + ' ' + bioFont + '" style="color: ' + card.text_color + ';" id="typewriterBio">' + card.bio + '</p>' : '')
    + '<div class="social-links">' + socialHtml + '</div>'
    + '</div>';

  if (card.enable_audio_player && (card.video_url || card.audio_url)) {
    setupAudioPlayer(card);
    createEnterOverlay(avatarUrl, card.video_url);
  }

  if (card.enable_typewriter && card.bio) {
    typewriterEffect(card.bio);
  }

  if (card.enable_particles) {
    createParticles();
  }
}

function buildAudioPlayer(card) {
  const audioSource = card.audio_url || card.video_url;
  const audioTitle = card.audio_title || 'Background Music';
  const coverUrl = card.audio_cover || '';
  const position = card.audio_player_position || 'bottom-right';
  const style = card.audio_player_style || 'full';
  const theme = card.audio_player_theme || 'accent';
  const visualizer = card.audio_visualizer || 'none';
  const showCover = card.audio_show_cover !== false;
  const autohide = card.audio_autohide || false;

  let audioType = 'audio/mp4';
  if (audioSource.includes('.mp3')) audioType = 'audio/mpeg';
  else if (audioSource.includes('.wav')) audioType = 'audio/wav';
  else if (audioSource.includes('.ogg')) audioType = 'audio/ogg';

  let coverHtml = '';
  if (showCover && coverUrl) {
    coverHtml = '<div class="audio-cover"><img src="' + coverUrl + '" alt="Cover" style="width:44px;height:44px;border-radius:8px;object-fit:cover;"></div>';
  }

  let vizHtml = '';
  if (visualizer === 'bars') {
    vizHtml = '<div class="audio-visualizer"><div class="viz-bar"></div><div class="viz-bar"></div><div class="viz-bar"></div><div class="viz-bar"></div><div class="viz-bar"></div></div>';
  } else if (visualizer === 'pulse') {
    vizHtml = '<div class="viz-pulse"></div>';
  } else if (visualizer === 'wave') {
    vizHtml = '<div class="viz-wave"><span></span><span></span><span></span><span></span><span></span></div>';
  }

  const classes = 'audio-player pos-' + position + ' theme-' + theme + ' style-' + style + (autohide ? ' autohide' : '');

  let html = '<div class="' + classes + '" id="audioPlayer">';
  html += '<audio id="bgAudio" loop>';
  html += '<source src="' + audioSource + '" type="' + audioType + '">';
  html += '<source src="' + audioSource + '" type="audio/mpeg">';
  html += '</audio>';
  html += '<div class="audio-controls">';
  html += coverHtml;
  html += '<button id="playPauseBtn" class="audio-btn"><i class="fa fa-play"></i></button>';
  html += '<div class="audio-info"><span class="audio-title">' + audioTitle + '</span></div>';
  html += vizHtml;
  html += '<input type="range" id="volumeSlider" class="volume-slider" min="0" max="100" value="50">';
  html += '</div></div>';

  return html;
}

function setupAudioPlayer(card) {
  const audio = document.getElementById('bgAudio');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const player = document.getElementById('audioPlayer');
  if (!audio || !playPauseBtn || !volumeSlider) return;

  audio.volume = 0.5;

  playPauseBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        playPauseBtn.innerHTML = '<i class="fa fa-pause"></i>';
        if (player) player.classList.add('playing');
      }).catch(err => {
        console.error('Audio play failed:', err);
      });
    } else {
      audio.pause();
      playPauseBtn.innerHTML = '<i class="fa fa-play"></i>';
      if (player) player.classList.remove('playing');
    }
  });

  volumeSlider.addEventListener('input', (e) => {
    audio.volume = e.target.value / 100;
  });

  audio.addEventListener('ended', () => {
    playPauseBtn.innerHTML = '<i class="fa fa-play"></i>';
    if (player) player.classList.remove('playing');
  });
}

function createEnterOverlay(avatarUrl, videoUrl) {
  const audio = document.getElementById('bgAudio');
  if (!audio) return;

  const overlay = document.createElement('div');
  overlay.id = 'enterOverlay';

  let bgStyle = '';
  if (avatarUrl) {
    bgStyle = 'background-image:url(' + avatarUrl + ');background-size:cover;background-position:center;';
  } else if (videoUrl) {
    bgStyle = 'background-image:url(' + videoUrl + ');background-size:cover;background-position:center;';
  }

  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;cursor:pointer;transition:opacity 0.6s ease;' + bgStyle;
  overlay.innerHTML = '<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;"><div style="text-align:center;pointer-events:none;"><h1 class="rainbow-text" style="font-size:56px;font-weight:900;font-family:\'Orbitron\',sans-serif;text-transform:uppercase;letter-spacing:8px;margin:0;">Click to Enter</h1></div></div>';
  document.body.appendChild(overlay);

  const handleClick = () => {
    const el = document.getElementById('enterOverlay');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 600);
    }
    try {
      audio.play().then(() => {
        const btn = document.getElementById('playPauseBtn');
        const player = document.getElementById('audioPlayer');
        if (btn) btn.innerHTML = '<i class="fa fa-pause"></i>';
        if (player) player.classList.add('playing');
      }).catch(err => {
        console.error('Audio play failed:', err);
      });
    } catch (err) {
      console.error('Audio error:', err);
    }
  };

  overlay.addEventListener('click', handleClick);
  overlay.addEventListener('touchstart', handleClick);
}

function typewriterEffect(text) {
  const bio = document.getElementById('typewriterBio');
  if (!bio) return;
  bio.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      bio.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(interval);
    }
  }, 50);
}

function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.style.cssText = 'position:absolute;width:4px;height:4px;background:rgba(255,255,255,0.5);border-radius:50%;animation:float ' + (3 + Math.random() * 5) + 's ease-in-out infinite;left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 100) + '%;';
    container.appendChild(p);
  }
  const style = document.createElement('style');
  style.textContent = '@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-100px) translateX(' + (Math.random() * 20 - 10) + 'px)}}';
  document.head.appendChild(style);
}

function getSocialIcon(platform) {
  const icons = {
    discord: 'fab fa-discord',
    telegram: 'fab fa-telegram',
    twitter: 'fab fa-twitter',
    github: 'fab fa-github',
    youtube: 'fab fa-youtube',
    instagram: 'fab fa-instagram',
    tiktok: 'fab fa-tiktok',
    website: 'fa fa-globe'
  };
  return icons[platform] || 'fa fa-link';
}

loadCard();
