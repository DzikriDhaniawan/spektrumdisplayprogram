/**
 * DIGITAL SIGNAGE INTERACTIVE KIOSK
 * Clean, lightweight, zero-dependency engine.
 */

// State Management
let currentCategory = 'all';
let searchQuery = '';
let focusedCardIndex = 0;
let isPlayerActive = false;
let idleTimer = null;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 menit idle (screensaver/auto-loop)

// Loop Modes: 'single' (1 video) | 'folder' (semua video di folder ini) | 'none' (sekali putar)
let currentLoopMode = 'single';
let currentPlayingVideo = null;

// Elements
const clockTimeEl = document.getElementById('clock-time');
const clockDateEl = document.getElementById('clock-date');
const categoryChipsEl = document.getElementById('category-chips');
const videoGridEl = document.getElementById('video-grid');
const videoCountBadgeEl = document.getElementById('video-count-badge');
const searchInputEl = document.getElementById('search-input');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const refreshBtn = document.getElementById('refresh-btn');
const loopFolderActionBtn = document.getElementById('loop-folder-action-btn');
const loopFolderBtnText = document.getElementById('loop-folder-btn-text');

// Player Modal Elements
const playerModalEl = document.getElementById('player-modal');
const mainVideoEl = document.getElementById('main-video');
const mainIframeEl = document.getElementById('main-iframe');
const playerBackBtn = document.getElementById('player-back-btn');
const playerTitleEl = document.getElementById('player-title');
const playerCategoryEl = document.getElementById('player-category');
const playerLoopBtn = document.getElementById('player-loop-btn');
const playerLoopIcon = document.getElementById('player-loop-icon');
const playerLoopLabel = document.getElementById('player-loop-label');
const playerPrevBtn = document.getElementById('player-prev-btn');
const playerNextBtn = document.getElementById('player-next-btn');

/* Helper: Deteksi dan Ambil File ID Google Drive jika ada */
function getGoogleDriveId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  return null;
}

/* ==========================================================================
   1. REAL-TIME CLOCK & DATE (Indonesian Format)
   ========================================================================== */
function updateClock() {
  const now = new Date();
  
  // Format Waktu: HH:MM:SS
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  if (clockTimeEl) {
    clockTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
  }

  // Format Tanggal
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  if (clockDateEl) {
    clockDateEl.textContent = now.toLocaleDateString('id-ID', options);
  }
}
setInterval(updateClock, 1000);
updateClock();

/* ==========================================================================
   2. CATEGORIES & FILTERING
   ========================================================================== */
function getUniqueCategories(videos) {
  const cats = new Set();
  videos.forEach(v => {
    if (v.category && v.category.trim() !== '') {
      cats.add(v.category.trim());
    }
  });
  return Array.from(cats);
}

function renderCategories() {
  if (!categoryChipsEl) return;
  const videos = (typeof LOCAL_VIDEOS !== 'undefined') ? LOCAL_VIDEOS : [];
  const categories = getUniqueCategories(videos);

  categoryChipsEl.innerHTML = '';

  // "Semua Video" Button
  const allBtn = document.createElement('button');
  allBtn.className = `chip-btn ${currentCategory === 'all' ? 'active' : ''}`;
  allBtn.innerHTML = `<span>Semua Video</span><span class="chip-count">${videos.length}</span>`;
  allBtn.onclick = () => selectCategory('all');
  categoryChipsEl.appendChild(allBtn);

  // Each Category / Folder
  categories.forEach(cat => {
    const count = videos.filter(v => v.category === cat).length;
    const btn = document.createElement('button');
    btn.className = `chip-btn ${currentCategory === cat ? 'active' : ''}`;
    btn.innerHTML = `<span>${cat}</span><span class="chip-count">${count}</span>`;
    btn.onclick = () => selectCategory(cat);
    categoryChipsEl.appendChild(btn);
  });
}

function selectCategory(cat) {
  currentCategory = cat;
  renderCategories();
  renderVideoGrid();

  // Tombol "Putar Berurutan (Loop Folder Ini)" HANYA aktif pada folder spesifik, bukan 'all'
  if (loopFolderActionBtn) {
    if (cat !== 'all') {
      loopFolderActionBtn.style.display = 'inline-flex';
      if (loopFolderBtnText) {
        loopFolderBtnText.textContent = `Putar Berurutan (Loop Folder ${cat})`;
      }
    } else {
      loopFolderActionBtn.style.display = 'none';
    }
  }
}

if (loopFolderActionBtn) {
  loopFolderActionBtn.onclick = () => {
    const videos = (typeof LOCAL_VIDEOS !== 'undefined') ? LOCAL_VIDEOS : [];
    const folderVideos = videos.filter(v => v.category === currentCategory);
    if (folderVideos.length > 0) {
      currentLoopMode = 'folder';
      playVideo(folderVideos[0]);
    }
  };
}

/* ==========================================================================
   3. VIDEO GRID RENDERING (With Native Video Frame Thumbnails)
   ========================================================================== */
function getFilteredVideos() {
  const videos = (typeof LOCAL_VIDEOS !== 'undefined') ? LOCAL_VIDEOS : [];
  return videos.filter(v => {
    const matchesCat = (currentCategory === 'all' || v.category === currentCategory);
    const matchesSearch = !searchQuery || 
      (v.title && v.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.category && v.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });
}

function renderVideoGrid() {
  if (!videoGridEl) return;
  const filtered = getFilteredVideos();

  // Update badge counter
  if (videoCountBadgeEl) {
    videoCountBadgeEl.textContent = `${filtered.length} file`;
  }

  videoGridEl.innerHTML = '';

  if (filtered.length === 0) {
    videoGridEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <div class="empty-title">Belum Ada Video Tersedia</div>
        <div class="empty-desc">
          Pastikan file video (.mp4) sudah ditaruh di dalam folder <b>"videos"</b>, 
          lalu klik 2x file <b>"UPDATE-VIDEOS.bat"</b> untuk memuat daftar materi.
        </div>
      </div>
    `;
    return;
  }

  filtered.forEach((video, index) => {
    const card = document.createElement('div');
    card.className = `video-card ${index === focusedCardIndex ? 'remote-focused' : ''}`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Putar video ${video.title}`);

    // Create thumbnail container
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'thumbnail-container';

    // Fallback icon behind
    const fallbackEl = document.createElement('div');
    fallbackEl.className = 'thumbnail-fallback';
    fallbackEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-8v-6h8v6z"/>
      </svg>
    `;
    thumbContainer.appendChild(fallbackEl);

    const driveId = getGoogleDriveId(video.file);
    if (driveId) {
      // 1. Google Drive Thumbnail Otomatis
      const driveThumb = document.createElement('img');
      driveThumb.className = 'thumbnail-img';
      driveThumb.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w640`;
      driveThumb.alt = video.title;
      driveThumb.onload = () => {
        driveThumb.style.display = 'block';
        fallbackEl.style.display = 'none';
      };
      thumbContainer.appendChild(driveThumb);
    } else if (video.poster) {
      // 2. Custom Poster Image jika ada
      const img = document.createElement('img');
      img.className = 'thumbnail-img';
      img.src = video.poster;
      img.alt = video.title;
      img.onload = () => {
        img.style.display = 'block';
        fallbackEl.style.display = 'none';
      };
      thumbContainer.appendChild(img);
    } else if (video.file) {
      // 3. Native Video Frame Snapshot untuk File Lokal Offline
      const previewVideo = document.createElement('video');
      previewVideo.className = 'thumbnail-preview-video';
      previewVideo.src = `${video.file}#t=2.0`;
      previewVideo.preload = 'metadata';
      previewVideo.muted = true;
      previewVideo.playsInline = true;
      previewVideo.setAttribute('playsinline', '');
      previewVideo.setAttribute('muted', '');
      previewVideo.tabIndex = -1;

      previewVideo.addEventListener('loadeddata', () => {
        previewVideo.style.opacity = '1';
        fallbackEl.style.display = 'none';
      });

      previewVideo.addEventListener('loadedmetadata', () => {
        const seekTarget = Math.min(2.0, (previewVideo.duration || 5) * 0.2);
        previewVideo.currentTime = seekTarget;
      });

      previewVideo.addEventListener('seeked', () => {
        previewVideo.style.opacity = '1';
        fallbackEl.style.display = 'none';
      });

      thumbContainer.appendChild(previewVideo);
    }

    // Play icon badge
    const playBadge = document.createElement('div');
    playBadge.className = 'play-badge';
    playBadge.innerHTML = '▶';
    thumbContainer.appendChild(playBadge);

    // Card Body
    const body = document.createElement('div');
    body.className = 'card-body';

    const catBadge = document.createElement('span');
    catBadge.className = 'card-category-tag';
    catBadge.textContent = video.category || 'Materi';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = video.title;

    body.appendChild(catBadge);
    body.appendChild(title);

    // Deskripsi bersih: Hanya nama file saja
    if (video.description) {
      const desc = document.createElement('p');
      desc.className = 'card-desc';
      desc.textContent = video.description;
      body.appendChild(desc);
    }

    card.appendChild(thumbContainer);
    card.appendChild(body);

    // Click handler to open player
    card.onclick = () => {
      // Jika diklik langsung, default loop ke 1 video
      playVideo(video);
    };

    // Focus handler for remote / keyboard navigation
    card.onfocus = () => {
      focusedCardIndex = index;
      updateRemoteFocus();
    };

    videoGridEl.appendChild(card);
  });
}

/* ==========================================================================
   4. VIDEO PLAYER MODAL & LOOP CONTROLS
   ========================================================================== */
function playVideo(video) {
  if (!playerModalEl) return;

  currentPlayingVideo = video;
  // Hanya tampilkan nama file saja (misal: "Branding Employer.1.mp4") tanpa teks detail lainnya
  const fileName = video.description || (video.file ? video.file.split('/').pop() : video.title);
  playerTitleEl.textContent = fileName;
  if (playerCategoryEl) {
    playerCategoryEl.textContent = '';
    playerCategoryEl.style.display = 'none';
  }
  
  const driveId = getGoogleDriveId(video.file);
  if (driveId) {
    // Mode Google Drive Iframe Embed
    if (mainVideoEl) {
      mainVideoEl.pause();
      mainVideoEl.style.display = 'none';
      mainVideoEl.src = '';
    }
    if (mainIframeEl) {
      mainIframeEl.style.display = 'block';
      mainIframeEl.src = `https://drive.google.com/file/d/${driveId}/preview`;
    }
  } else {
    // Mode Video HTML5 Biasa (Lokal atau Direct Link)
    if (mainIframeEl) {
      mainIframeEl.style.display = 'none';
      mainIframeEl.src = '';
    }
    if (mainVideoEl) {
      mainVideoEl.style.display = 'block';
      mainVideoEl.src = video.file;
      mainVideoEl.play().catch(err => {
        console.warn("Autoplay dicegah browser, butuh interaksi pengguna:", err);
      });
    }
  }

  playerModalEl.classList.add('active');
  isPlayerActive = true;

  updateLoopUI();

  // Focus the prominent back button so user/remote can quickly exit
  setTimeout(() => {
    playerBackBtn.focus();
  }, 100);
}

function closeVideoPlayer() {
  if (!playerModalEl) return;
  if (mainVideoEl) {
    mainVideoEl.pause();
    mainVideoEl.currentTime = 0;
    mainVideoEl.src = '';
  }
  if (mainIframeEl) {
    mainIframeEl.src = '';
    mainIframeEl.style.display = 'none';
  }
  playerModalEl.classList.remove('active');
  isPlayerActive = false;
  currentPlayingVideo = null;

  // Refocus last focused card in grid
  focusCardByIndex(focusedCardIndex);
}

function updateLoopUI() {
  if (!playerLoopBtn) return;
  playerLoopBtn.classList.remove('active-single', 'active-folder', 'active-none');

  if (currentLoopMode === 'single') {
    playerLoopBtn.classList.add('active-single');
    playerLoopIcon.textContent = '🔂';
    playerLoopLabel.textContent = 'Loop: 1 Video Saja';
    playerLoopBtn.title = 'Mode: Mengulang 1 Video Ini Terus Menerus (Klik untuk Ganti)';
  } else if (currentLoopMode === 'folder') {
    playerLoopBtn.classList.add('active-folder');
    playerLoopIcon.textContent = '🔁';
    const catName = currentPlayingVideo ? currentPlayingVideo.category : 'Folder Ini';
    playerLoopLabel.textContent = `Loop: Folder ${catName}`;
    playerLoopBtn.title = `Mode: Memutar Berurutan Semua Video di Folder ${catName} (Klik untuk Ganti)`;
  } else {
    playerLoopBtn.classList.add('active-none');
    playerLoopIcon.textContent = '⏹️';
    playerLoopLabel.textContent = 'Loop: Mati (Sekali Putar)';
    playerLoopBtn.title = 'Mode: Selesai Video Kembali ke Menu (Klik untuk Ganti)';
  }
}

function cycleLoopMode() {
  if (currentLoopMode === 'single') {
    currentLoopMode = 'folder';
  } else if (currentLoopMode === 'folder') {
    currentLoopMode = 'none';
  } else {
    currentLoopMode = 'single';
  }
  updateLoopUI();
}

function playNextVideoInFolder() {
  if (!currentPlayingVideo) return;
  const folderName = currentPlayingVideo.category;
  const allVideos = (typeof LOCAL_VIDEOS !== 'undefined') ? LOCAL_VIDEOS : [];
  const folderVideos = allVideos.filter(v => v.category === folderName);

  if (folderVideos.length > 0) {
    const currentIndex = folderVideos.findIndex(v => v.file === currentPlayingVideo.file);
    const nextIndex = (currentIndex + 1) % folderVideos.length; // Loop kembali ke video pertama jika sampai akhir
    playVideo(folderVideos[nextIndex]);
  }
}

function playPrevVideoInFolder() {
  if (!currentPlayingVideo) return;
  const folderName = currentPlayingVideo.category;
  const allVideos = (typeof LOCAL_VIDEOS !== 'undefined') ? LOCAL_VIDEOS : [];
  const folderVideos = allVideos.filter(v => v.category === folderName);

  if (folderVideos.length > 0) {
    const currentIndex = folderVideos.findIndex(v => v.file === currentPlayingVideo.file);
    const prevIndex = (currentIndex - 1 + folderVideos.length) % folderVideos.length;
    playVideo(folderVideos[prevIndex]);
  }
}

if (playerBackBtn) {
  playerBackBtn.onclick = closeVideoPlayer;
}

if (playerLoopBtn) {
  playerLoopBtn.onclick = cycleLoopMode;
}

if (playerNextBtn) {
  playerNextBtn.onclick = playNextVideoInFolder;
}

if (playerPrevBtn) {
  playerPrevBtn.onclick = playPrevVideoInFolder;
}

// Event saat video selesai diputar
if (mainVideoEl) {
  mainVideoEl.onended = () => {
    if (!currentPlayingVideo) {
      closeVideoPlayer();
      return;
    }

    if (currentLoopMode === 'single') {
      // 1. Loop 1 Video saja
      mainVideoEl.currentTime = 0;
      mainVideoEl.play().catch(e => console.warn(e));
    } else if (currentLoopMode === 'folder') {
      // 2. Loop Berurutan Semua Video dalam Folder Ini Saja
      playNextVideoInFolder();
    } else {
      // 3. Tanpa Loop -> Selesai dan kembali ke menu
      closeVideoPlayer();
    }
  };
}

/* ==========================================================================
   5. REMOTE TV / KEYBOARD D-PAD NAVIGATION
   ========================================================================== */
function updateRemoteFocus() {
  const cards = document.querySelectorAll('.video-card');
  cards.forEach((c, idx) => {
    if (idx === focusedCardIndex) {
      c.classList.add('remote-focused');
      c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      c.classList.remove('remote-focused');
    }
  });
}

function focusCardByIndex(idx) {
  const cards = document.querySelectorAll('.video-card');
  if (cards.length === 0) return;
  focusedCardIndex = Math.max(0, Math.min(idx, cards.length - 1));
  cards[focusedCardIndex].focus();
  updateRemoteFocus();
}

// Global Key Listeners for TV Remote D-Pad, OK, and Back buttons
window.addEventListener('keydown', (e) => {
  resetIdleTimer();

  // If Video Player is Active
  if (isPlayerActive) {
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack' || e.key === 'GoBack') {
      e.preventDefault();
      closeVideoPlayer();
      return;
    }
    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault();
      cycleLoopMode();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      playNextVideoInFolder();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      playPrevVideoInFolder();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      if (document.activeElement !== playerBackBtn && 
          document.activeElement !== playerLoopBtn && 
          document.activeElement !== playerNextBtn && 
          document.activeElement !== playerPrevBtn) {
        e.preventDefault();
        if (mainVideoEl.paused) {
          mainVideoEl.play();
        } else {
          mainVideoEl.pause();
        }
      }
    }
    return;
  }

  // If in Menu View
  const cards = document.querySelectorAll('.video-card');
  if (cards.length === 0) return;

  const cols = calculateGridColumns();

  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault();
      focusCardByIndex(focusedCardIndex + 1);
      break;
    case 'ArrowLeft':
      e.preventDefault();
      focusCardByIndex(focusedCardIndex - 1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      focusCardByIndex(focusedCardIndex + cols);
      break;
    case 'ArrowUp':
      e.preventDefault();
      focusCardByIndex(focusedCardIndex - cols);
      break;
    case 'Enter':
      if (document.activeElement.classList.contains('video-card')) {
        document.activeElement.click();
      }
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      break;
  }
});

function calculateGridColumns() {
  if (!videoGridEl) return 3;
  const cards = document.querySelectorAll('.video-card');
  if (cards.length > 1) {
    const firstTop = cards[0].offsetTop;
    let cols = 0;
    for (let i = 0; i < cards.length; i++) {
      if (Math.abs(cards[i].offsetTop - firstTop) < 5) {
        cols++;
      } else {
        break;
      }
    }
    return Math.max(1, cols);
  }
  return 1;
}

/* ==========================================================================
   6. FULLSCREEN & ACTIONS
   ========================================================================== */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn("Fullscreen request error:", err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

if (fullscreenBtn) {
  fullscreenBtn.onclick = toggleFullscreen;
}

if (refreshBtn) {
  refreshBtn.onclick = () => {
    window.location.reload();
  };
}

if (searchInputEl) {
  searchInputEl.oninput = (e) => {
    searchQuery = e.target.value;
    renderVideoGrid();
  };
}

/* ==========================================================================
   7. STANDBY IDLE TIMER (Returns to First Video or Idle View after 5 Mins)
   ========================================================================== */
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const videos = getFilteredVideos();
    if (!isPlayerActive && videos.length > 0) {
      console.log("Idle timeout reached, auto-playing default video...");
      currentLoopMode = 'single';
      playVideo(videos[0]);
    }
  }, IDLE_TIMEOUT_MS);
}

['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
  window.addEventListener(evt, resetIdleTimer, { passive: true });
});

window.addEventListener('resize', () => {
  updateRemoteFocus();
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    updateRemoteFocus();
  }, 150);
});

// Initial boot
document.addEventListener('DOMContentLoaded', () => {
  renderCategories();
  renderVideoGrid();
  resetIdleTimer();
});
