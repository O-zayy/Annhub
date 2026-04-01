// --- Setup Sound Synthesis (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol=0.1) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    hover: () => playTone(800, 'sine', 0.1, 0.05),
    click: () => playTone(1200, 'square', 0.1, 0.1),
    hit: () => playTone(600, 'triangle', 0.2, 0.2),
    miss: () => {
        playTone(150, 'sawtooth', 0.3, 0.2);
        setTimeout(() => playTone(100, 'sawtooth', 0.4, 0.2), 100);
    },
    start: () => {
        playTone(400, 'square', 0.1, 0.1);
        setTimeout(() => playTone(600, 'square', 0.1, 0.1), 100);
        setTimeout(() => playTone(800, 'square', 0.3, 0.1), 200);
    }
};

// UI Sound Attachments
document.addEventListener('mouseover', (e) => {
    if(e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('.anime-card') || e.target.closest('.episode-item') || e.target.closest('.api-card') || e.target.closest('#quote-container')) {
        sounds.hover();
    }
});

// --- GSAP Animations (Cred Style) ---
gsap.registerPlugin(ScrollTrigger);

// Hero Init Animation
const tl = gsap.timeline();
tl.to(".hero-text-anim", {y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.2})
    .to(".hero-main-text", {y: 0, duration: 1, stagger: 0.15, ease: "power4.out"}, "-=0.4")
    .to(".hero-btn", {opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)"}, "-=0.2");

// Navbar blur effect on scroll
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if(window.scrollY > 50) {
        nav.classList.add('bg-black/90', 'shadow-lg');
        nav.classList.remove('bg-black/80', 'border-white/10');
    } else {
        nav.classList.add('bg-black/80', 'border-white/10');
        nav.classList.remove('bg-black/90', 'shadow-lg');
    }
});

// --- Data Fetching (Jikan API) & UI Generation ---
const animeGrid = document.getElementById('anime-grid');
const loadingGrid = document.getElementById('loading-grid');
const loadMoreBtn = document.getElementById('load-more-btn');
const loadMoreContainer = document.getElementById('load-more-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

let currentPage = 1;
let isFetching = false;

async function fetchTopAnime(page = 1, append = false) {
    if(isFetching) return;
    isFetching = true;

    // Handle disabled states for pagination buttons safely
    if (prevBtn) prevBtn.disabled = page === 1;

    if (!append) {
        // Prevent aggressive UI jumping when replacing content
        const currentHeight = animeGrid.offsetHeight;
        if (currentHeight > 0) {
            animeGrid.style.minHeight = currentHeight + 'px';
        }
        animeGrid.innerHTML = '';
        loadingGrid.classList.remove('hidden');
    } else {
        if(loadMoreBtn) {
            loadMoreBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> LOADING...';
            loadMoreBtn.disabled = true;
        }
    }

    try {
        // Fetching top airing anime
        let res = await fetch(`https://api.jikan.moe/v4/top/anime?filter=airing&limit=8&page=${page}`);
        
        // Automatic retry with backoff for Jikan Rate Limits (429)
        if (res.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds
            res = await fetch(`https://api.jikan.moe/v4/top/anime?filter=airing&limit=8&page=${page}`);
        }
        
        if (!res.ok) throw new Error(`Jikan API Error: ${res.status}`);
        
        const data = await res.json();
        
        if (!data || !data.data) throw new Error("Invalid API Data");

        loadingGrid.classList.add('hidden');
        renderAnimeCards(data.data, append);

        // Show/hide load more button based on pagination
        if (data.pagination && data.pagination.has_next_page) {
            if (loadMoreContainer) loadMoreContainer.classList.remove('hidden');
            if (nextBtn) nextBtn.disabled = false;
        } else {
            if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
            if (nextBtn) nextBtn.disabled = true;
        }

    } catch (error) {
        console.warn("Primary API (Jikan) Failed:", error);
        console.info("Switching to Backup API Chain...");

        try {
            // Attempt Master Fallback Controller (AniList -> Kitsu -> Shikimori -> Hardcoded)
            if (typeof fetchTopAnimeBackup === 'function') {
                await fetchTopAnimeBackup(page, append);
                console.log("[Primary] Fallback chain succeeded!");
                return; // Success! Exit function.
            } else {
                console.error("Backup function not found!");
                throw new Error("Backup function missing");
            }
        } catch (fallbackError) {
            console.error("All API Fallbacks Exhausted:", fallbackError);
            // Fall through to display error UI below
            // Ensure loading state is visible for error message
        }

        if(!append) {
            loadingGrid.classList.remove('hidden');
            // Robust error fallback for the dreaded Jikan 429 Too Many Requests
            loadingGrid.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-8 border border-red-500/30 rounded-xl bg-red-500/10">
                    <i class="fa-solid fa-triangle-exclamation text-3xl text-red-500 mb-4"></i>
                    <p class="text-red-400 font-display text-2xl uppercase">CONNECTION FAILED</p>
                    <p class="text-gray-400 font-tech text-xs mt-2 mb-6">ALL API SERVICES ARE CURRENTLY UNREACHABLE.</p>
                    <button onclick="fetchTopAnime(${page}, false)" class="border-2 border-credacc text-credacc px-6 py-3 text-xs font-tech tracking-widest hover:bg-credacc hover:text-black transition-colors rounded-full uppercase">REBOOT CONNECTION</button>
                    <p class="text-[10px] text-gray-500 mt-2">FALLBACK ATTEMPT FAILED</p>
                </div>
            `;
        } else {
            if(loadMoreBtn) loadMoreBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> RETRY LOAD';
        }
    } finally {
        isFetching = false;
        if(loadMoreBtn && !loadMoreBtn.innerHTML.includes('RETRY')) {
            loadMoreBtn.innerHTML = 'LOAD MORE ANIME <i class="fa-solid fa-arrow-down"></i>';
            loadMoreBtn.disabled = false;
        }
    }
}

// Export to window so our inline onclick handlers (reboot connection) work flawlessly
window.fetchTopAnime = fetchTopAnime;

function renderAnimeCards(animeList, append) {
    animeGrid.classList.remove('hidden');

    if (!append) {
        animeGrid.innerHTML = '';
        animeGrid.style.minHeight = 'auto'; // Release height lock
    }

    const validAnime = animeList; // Removed filter to allow all anime to show, even without trailer. Fallback handles missing vid.
    const newCards = [];

    validAnime.forEach((anime, index) => {
        const card = document.createElement('div');
        card.className = 'anime-card bg-credcard rounded-xl overflow-hidden border border-white/5 relative cursor-pointer group h-[400px] flex flex-col';
        
        // Store accurate data required for Modal & API queries
        card.dataset.id = anime.mal_id;
        card.dataset.title = anime.title;
        card.dataset.synopsis = anime.synopsis || "No synopsis available.";
        card.dataset.score = anime.score || "N/A";
        card.dataset.status = anime.status;
        card.dataset.trailer = anime.trailer?.embed_url || '';

        card.innerHTML = `
            <div class="h-[70%] relative overflow-hidden">
                <img src="${anime.images.webp.large_image_url}" alt="${anime.title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                <div class="absolute inset-0 card-img-overlay"></div>
                <div class="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                    <i class="fa-solid fa-star text-credacc text-xs"></i>
                    <span class="font-tech text-xs text-white">${anime.score || 'N/A'}</span>
                </div>
            </div>
            <div class="p-6 h-[30%] flex flex-col justify-between relative bg-credcard z-10 transition-transform duration-300 group-hover:-translate-y-4">
                <h3 class="font-display text-xl uppercase leading-tight truncate text-white group-hover:text-credacc transition-colors">${anime.title}</h3>
                <div class="flex items-center justify-between mt-2">
                    <span class="font-sans text-xs text-gray-400 border border-white/20 px-2 py-1 rounded">${anime.genres[0]?.name || 'Anime'}</span>
                    <span class="font-tech text-[10px] tracking-wider text-credacc uppercase group-hover:animate-pulse">WATCH NOW</span>
                </div>
                
                <!-- Hover Synopsis Reveal -->
                <div class="absolute top-full left-0 w-full p-6 bg-credcard border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-full">
                    <p class="text-xs text-gray-400 synopsis">${anime.synopsis || 'No details available.'}</p>
                </div>
            </div>
        `;

        card.addEventListener('click', () => {
            sounds.click();
            openModal(card.dataset);
        });

        animeGrid.appendChild(card);
        newCards.push(card);
    });

    // Trigger scroll animations for newly added cards
    gsap.from(newCards, {
        scrollTrigger: {
            trigger: newCards[0] || "#discover",
            start: "top 80%",
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out"
    });
    
    ScrollTrigger.refresh();
}

if(loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
        sounds.click();
        currentPage++;
        fetchTopAnime(currentPage, true);
    });
}

if(prevBtn) {
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            sounds.click();
            currentPage--;
            fetchTopAnime(currentPage, false);
            document.getElementById('discover').scrollIntoView({ behavior: 'smooth' });
        }
    });
}

if(nextBtn) {
    nextBtn.addEventListener('click', () => {
        sounds.click();
        currentPage++;
        fetchTopAnime(currentPage, false);
        document.getElementById('discover').scrollIntoView({ behavior: 'smooth' });
    });
}

// --- Player Modal & Real Episode Logic ---
const modal = document.getElementById('player-modal');
const closeModalBtn = document.getElementById('close-modal');
const videoContainer = document.getElementById('video-container');
const epListContainer = document.getElementById('episode-list');

// 🔥 FINAL FIX FOR YOUTUBE ERROR 153 (ROBUST)
// --- YouTube Player Logic (Robust & Interactive) ---
let player = null;
let progressInterval = null;
let isYouTubeApiReady = false;
let iframePlaybackState = {
    isPlaying: true,
    isMuted: false,
    lastVolume: 50
};
let currentVideoState = {
    trailerUrl: '',
    videoTitle: '',
    videoId: '',
    restoreTime: 0,
    fullscreenNative: false
};

// 1. Inject YouTube API safely
if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// 2. API Ready Callback
window.onYouTubeIframeAPIReady = function() {
    isYouTubeApiReady = true;
};

// 3. Time Formatter
function formatTime(seconds) {
    if(!seconds) return "00:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;
}

function extractYouTubeVideoId(trailerUrl) {
    if (!trailerUrl) return null;

    const patterns = [
        /embed\/([^?&]+)/,
        /v=([^?&]+)/,
        /youtu\.be\/([^?&]+)/,
        /youtube\.com\/watch\?v=([^?&]+)/
    ];

    for (const pattern of patterns) {
        const match = trailerUrl.match(pattern);
        if (match) return match[1];
    }

    return null;
}

function updateMuteButtonIcon() {
    const muteBtn = document.getElementById('player-mute-btn');
    if (!muteBtn) return;

    const muted = player && typeof player.isMuted === 'function'
        ? player.isMuted()
        : iframePlaybackState.isMuted;

    if (muted) {
        muteBtn.className = 'fa-solid fa-volume-xmark hover:text-credacc cursor-pointer transition-colors';
    } else {
        muteBtn.className = 'fa-solid fa-volume-high hover:text-credacc cursor-pointer transition-colors';
    }
}

function sendYouTubeIframeCommand(func, args = []) {
    const iframe = document.querySelector('#video-container iframe');
    if (!iframe || !iframe.contentWindow || !iframe.src.includes('youtube')) return false;

    iframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func,
        args
    }), '*');

    return true;
}

function renderNativeFullscreenIframe(videoId, startTime = 0) {
    const container = document.getElementById('video-container');
    if (!container || !videoId) return;

    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    const startParam = Math.max(0, Math.floor(startTime));
    const startQuery = startParam > 0 ? `&start=${startParam}` : '';
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1&controls=1${startQuery}`;
    iframe.className = 'w-full h-full';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
    iframe.allowFullscreen = true;
    container.appendChild(iframe);
}

function renderCustomYouTubePlayer(videoId, startTime = 0) {
    const container = document.getElementById('video-container');
    if (!container || !videoId) return;

    container.innerHTML = '';

    const cropContainer = document.createElement('div');
    cropContainer.className = 'yt-crop-container';

    const playerDiv = document.createElement('div');
    playerDiv.id = 'yt-player-target';

    const clickOverlay = document.createElement('div');
    clickOverlay.className = 'yt-click-overlay';
    clickOverlay.onclick = () => {
         if(!player || typeof player.getPlayerState !== 'function') return;
         const state = player.getPlayerState();
         if (state == YT.PlayerState.PLAYING) {
             player.pauseVideo();
         } else {
             player.playVideo();
         }
    };

    cropContainer.appendChild(playerDiv);
    cropContainer.appendChild(clickOverlay);
    container.appendChild(cropContainer);

    const startPlayer = () => {
        try {
            player = new YT.Player('yt-player-target', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    playsinline: 1,
                    modestbranding: 1,
                    rel: 0,
                    autoplay: 1,
                    controls: 0,
                    enablejsapi: 1,
                    origin: window.location.origin,
                    ...(startTime > 0 ? { start: Math.floor(startTime) } : {})
                },
                events: {
                    onReady: onPlayerReady,
                    onStateChange: onPlayerStateChange,
                    onError: onPlayerError
                }
            });
        } catch (e) {
            console.error('YT init error', e);
            fallbackIframe(container, videoId, startTime, 0);
        }
    };

    if (isYouTubeApiReady && window.YT) {
        startPlayer();
    } else {
        let attempts = 0;
        const checkYT = setInterval(() => {
            attempts++;
            if (window.YT && window.YT.Player) {
                clearInterval(checkYT);
                startPlayer();
            } else if (attempts > 50) {
                clearInterval(checkYT);
                fallbackIframe(container, videoId, startTime, 0);
            }
        }, 100);
    }
}

function syncFullscreenPlayerMode() {
    const wrapper = document.getElementById('custom-player-wrapper');
    if (!wrapper || !currentVideoState.videoId) return;

    const isFullscreen = document.fullscreenElement === wrapper || document.webkitFullscreenElement === wrapper;

    if (isFullscreen && !currentVideoState.fullscreenNative) {
        currentVideoState.restoreTime = (player && typeof player.getCurrentTime === 'function') ? player.getCurrentTime() : currentVideoState.restoreTime;
        currentVideoState.fullscreenNative = true;
        wrapper.classList.add('native-controls-mode');

        if (player && typeof player.destroy === 'function') {
            try { player.destroy(); } catch (e) { console.warn('Player destroy error', e); }
        }
        player = null;
        if (progressInterval) clearInterval(progressInterval);

        renderNativeFullscreenIframe(currentVideoState.videoId, currentVideoState.restoreTime);
    }

    if (!isFullscreen && currentVideoState.fullscreenNative) {
        currentVideoState.fullscreenNative = false;
        wrapper.classList.remove('native-controls-mode');
        loadVideoPlayer(currentVideoState.trailerUrl, currentVideoState.videoTitle, currentVideoState.restoreTime);
        currentVideoState.restoreTime = 0;
    }
}

document.addEventListener('fullscreenchange', syncFullscreenPlayerMode);
document.addEventListener('webkitfullscreenchange', syncFullscreenPlayerMode);

// 4. Main Player Loader
function loadVideoPlayer(trailerUrl, videoTitle = '', startTime = 0) {
    currentVideoState.trailerUrl = trailerUrl || '';
    currentVideoState.videoTitle = videoTitle || '';
    currentVideoState.restoreTime = startTime || 0;

    // Cleanup previous player instance
    if (player) {
         if (typeof player.destroy === 'function') {
            try { player.destroy(); } catch(e) { console.warn('Player destroy error', e); }
         }
         player = null;
    }
    if (progressInterval) clearInterval(progressInterval);
    
    // Reset UI
    const container = document.getElementById('video-container');
    container.innerHTML = '';
    
    // Reset controls UI
    const progressFilled = document.getElementById('player-progress-filled');
    const timeDisplay = document.getElementById('player-time');
    const playBtn = document.getElementById('player-play-btn');
    const ccBtn = document.getElementById('player-cc-btn');
    
    if(progressFilled) progressFilled.style.width = '0%';
    if(timeDisplay) timeDisplay.innerText = "00:00 / 00:00";
    if(playBtn) playBtn.className = 'fa-solid fa-play hover:text-credacc cursor-pointer transition-colors';
    if(ccBtn) ccBtn.className = 'fa-solid fa-closed-captioning text-gray-600 hover:text-credacc cursor-pointer transition-colors';

    if (!trailerUrl || trailerUrl === 'null' || trailerUrl === 'undefined' || trailerUrl === '') {
        const searchUrl = videoTitle ? `https://www.youtube.com/results?search_query=${encodeURIComponent(videoTitle + ' trailer')}` : 'https://www.youtube.com';
        
        // --- Multi-Source Auto-Fallback Logic ---
        if (videoTitle && !window._isSearchingFallback) {
             container.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 h-full w-full">
                    <div class="loader ease-linear rounded-full border-4 border-t-4 border-credacc h-12 w-12 mb-4 animate-spin"></div>
                    <p class="font-display text-lg text-white mb-2">SEARCHING NETWORK...</p>
                    <p class="font-tech text-xs text-credacc animate-pulse">LOCATING TRAILER FROM ALTERNATIVE SOURCES</p>
                </div>
            `;
            
            window._isSearchingFallback = true; // Prevent infinite loop on re-call
            
            // Try combined fallback (AniList -> Kitsu)
            findAlternativeTrailer(videoTitle).then(newUrl => {
                window._isSearchingFallback = false;
                if (newUrl) {
                    // Success! Reload with new URL
                    loadVideoPlayer(newUrl, videoTitle);
                } else {
                     // Failure: Show original error UI
                     showVideoError();
                }
            }).catch(() => {
                window._isSearchingFallback = false;
                showVideoError();
            });
            return;
        }

        function showVideoError() {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-6 h-full w-full">
                    <i class="fa-solid fa-video-slash text-4xl text-gray-600 mb-4"></i>
                    <p class="font-display text-2xl text-gray-400">NO STREAM AVAILABLE</p>
                    <div class="flex flex-col gap-2 items-center mt-4">
                         <p class="font-tech text-xs text-gray-500">TRAILER DATA MISSING FROM API</p>
                         ${videoTitle ? `<a href="${searchUrl}" target="_blank" class="mt-2 px-4 py-2 border border-credacc text-credacc text-xs font-tech hover:bg-credacc hover:text-black transition-colors rounded uppercase"><i class="fa-brands fa-youtube mr-2"></i> SEARCH TRAILER</a>` : ''}
                    </div>
                </div>
            `;
        }
        
        if(!window._isSearchingFallback) showVideoError();
        return;
    }

    // Extract Video ID
    const videoId = extractYouTubeVideoId(trailerUrl);
    currentVideoState.videoId = videoId || '';

    if (currentVideoState.fullscreenNative) {
        renderNativeFullscreenIframe(videoId, startTime);
        return;
    }

    if (!videoId) {
        // Fallback for non-youtube
        const iframe = document.createElement('iframe');
        iframe.src = trailerUrl;
        iframe.className = 'w-full h-full';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
        iframe.allowFullscreen = true;
        container.appendChild(iframe);
        return;
    }

    renderCustomYouTubePlayer(videoId, startTime);
}

function fallbackIframe(container, videoId, startTime = 0, controls = 0) {
    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    const startParam = Math.max(0, Math.floor(startTime));
    const startQuery = startParam > 0 ? `&start=${startParam}` : '';
    const normalizedControls = Number(controls) === 1 ? 1 : 0;
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&rel=0&modestbranding=1&controls=${normalizedControls}&playsinline=1&enablejsapi=1${startQuery}`;
    iframe.className = 'w-full h-full';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
    iframe.allowFullscreen = true;
    container.appendChild(iframe);

    iframePlaybackState.isPlaying = true;
    iframePlaybackState.isMuted = false;
}

function onPlayerError(event) {
    console.warn("YouTube Player Error:", event.data);
    // 100, 101, 150 mean video can't be embedded.
    // We already have generic fallback, but sometimes we just want to show the iframe and let YT handle the error UI
}

function onPlayerReady(event) {
    event.target.playVideo();
    updateProgressBar();
    updateMuteButtonIcon();
    
    // Initial Volume UI sync
    // --- Initialize ElasticSliders ---
    
    // 1. Volume Slider
    const volumeRoot = document.getElementById('volume-slider-root');
    if (volumeRoot) {
        const initialVolume = player && typeof player.isMuted === 'function' && player.isMuted()
            ? 0
            : (player.getVolume ? player.getVolume() : 50);

        const applyVolume = (val) => {
            const safeVolume = Math.max(0, Math.min(100, Math.round(val)));
            const ytPlayer = event.target || player;

            if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
                if (safeVolume <= 0) {
                    if (typeof ytPlayer.mute === 'function') ytPlayer.mute();
                } else {
                    if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
                }
                ytPlayer.setVolume(safeVolume);
            } else {
                if (safeVolume <= 0) {
                    sendYouTubeIframeCommand('mute');
                    iframePlaybackState.isMuted = true;
                } else {
                    sendYouTubeIframeCommand('unMute');
                    iframePlaybackState.isMuted = false;
                }
                sendYouTubeIframeCommand('setVolume', [safeVolume]);
            }

            iframePlaybackState.lastVolume = safeVolume;
            updateMuteButtonIcon();
        };

        // Always recreate slider for new player instance
        volumeRoot.innerHTML = '';
        window.volumeSlider = new ElasticSlider(volumeRoot, {
            defaultValue: initialVolume,
            startingValue: 0,
            maxValue: 100,
            isVertical: true,
            onChange: applyVolume,
            onDragEnd: applyVolume
        });
    }

    // 2. Progress Slider (Seek)
    const progressRoot = document.getElementById('progress-slider-root');
    if(progressRoot && !progressRoot.querySelector('.slider-container')) {
        // We need a reference to this slider to update it during playback
        window.progressSlider = new ElasticSlider(progressRoot, {
            defaultValue: 0,
            startingValue: 0,
            maxValue: player.getDuration ? player.getDuration() : 100,
            onChange: (val) => {
                // Only seek on drag or click, not generic update
            },
            onDragEnd: (val) => {
                 if(player && player.seekTo) player.seekTo(val, true);
            },
            // Custom stepped behavior if needed for seek? No, smooth is better.
        });
    }
}

function onPlayerStateChange(event) {
    const playBtn = document.getElementById('player-play-btn');
    if (event.data == YT.PlayerState.PLAYING) {
        if(playBtn) playBtn.className = 'fa-solid fa-pause hover:text-credacc cursor-pointer transition-colors';
        if(progressInterval) clearInterval(progressInterval);
        progressInterval = setInterval(updateProgressBar, 500);
    } else {
        if(playBtn) playBtn.className = 'fa-solid fa-play hover:text-credacc cursor-pointer transition-colors';
        if (progressInterval) clearInterval(progressInterval);
    }
}

function updateProgressBar() {
    if (!player || typeof player.getCurrentTime !== 'function') return;
    
    try {
        const currentTime = player.getCurrentTime();
        const duration = player.getDuration();
        
        if (duration > 0) {
            const timeDisp = document.getElementById('player-time');
            if(timeDisp) timeDisp.innerText = formatTime(currentTime) + ' / ' + formatTime(duration);
            
            if (window.progressSlider && !window.progressSlider.isDragging) {
                window.progressSlider.setMax(duration);
                window.progressSlider.setValue(currentTime, false);
            }
        }
    } catch(e) { /* ignore */ }
}

// Initialize Controls Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Click anywhere on video area to toggle play/pause in custom mode
    const videoTapZone = document.getElementById('video-container');
    if (videoTapZone) {
        videoTapZone.addEventListener('click', (e) => {
            const wrapper = document.getElementById('custom-player-wrapper');
            if (wrapper && wrapper.classList.contains('native-controls-mode')) return;

            if (player && typeof player.getPlayerState === 'function') {
                const state = player.getPlayerState();
                if (state === YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                } else {
                    player.playVideo();
                }
            } else {
                if (iframePlaybackState.isPlaying) {
                    sendYouTubeIframeCommand('pauseVideo');
                    iframePlaybackState.isPlaying = false;
                } else {
                    sendYouTubeIframeCommand('playVideo');
                    iframePlaybackState.isPlaying = true;
                }
            }
        });
    }

    // Play/Pause
    const playBtn = document.getElementById('player-play-btn');
    if(playBtn) {
        playBtn.addEventListener('click', () => {
            if(!player || typeof player.getPlayerState !== 'function') return;
            const state = player.getPlayerState();
            if (state == YT.PlayerState.PLAYING) {
                player.pauseVideo();
            } else {
                player.playVideo();
            }
        });
    }

    // Mute/Unmute
    const muteBtn = document.getElementById('player-mute-btn');
    if(muteBtn) {
        muteBtn.addEventListener('click', () => {
            if(player && typeof player.isMuted === 'function') {
                const targetMute = !player.isMuted();
                
                if (targetMute) {
                    player.mute();
                } else {
                    player.unMute();
                }
                
                iframePlaybackState.isMuted = targetMute;
                updateMuteButtonIcon();

                if (window.volumeSlider && typeof window.volumeSlider.setValue === 'function') {
                    // Do NOT trigger onChange (false), this avoids the recursion/override paradox!
                    const sliderValue = targetMute ? 0 : Math.max(1, iframePlaybackState.lastVolume || 50);
                    window.volumeSlider.setValue(sliderValue, false);
                }
            } else {
                if (iframePlaybackState.isMuted) {
                    sendYouTubeIframeCommand('unMute');
                    sendYouTubeIframeCommand('setVolume', [Math.max(1, iframePlaybackState.lastVolume || 50)]);
                    iframePlaybackState.isMuted = false;
                } else {
                    sendYouTubeIframeCommand('mute');
                    iframePlaybackState.isMuted = true;
                }
                
                updateMuteButtonIcon();

                if (window.volumeSlider && typeof window.volumeSlider.setValue === 'function') {
                    const sliderValue = iframePlaybackState.isMuted ? 0 : Math.max(1, iframePlaybackState.lastVolume || 50);
                    window.volumeSlider.setValue(sliderValue, false);
                }
            }
        });
    }

    // Seek
    const progressContainer = document.getElementById('player-progress-container');
    if(progressContainer) {
        progressContainer.addEventListener('click', (e) => {
            if(!player || typeof player.getDuration !== 'function') return;
            const rect = progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const duration = player.getDuration();
            
            const newTime = (clickX / width) * duration;
            player.seekTo(newTime, true);
        });
    }

    // Fullscreen
    const fsBtn = document.getElementById('player-fs-btn');
    if(fsBtn) {
        fsBtn.addEventListener('click', () => {
             // Instead of iframe, request fullscreen on the wrapper
            const wrapper = document.getElementById('custom-player-wrapper');
            if(wrapper) {
                if (wrapper.requestFullscreen) wrapper.requestFullscreen();
                else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
                else if (wrapper.msRequestFullscreen) wrapper.msRequestFullscreen();
            } else {
                 // Fallback to iframe if wrapper missing
                 const iframe = document.querySelector('#video-container iframe');
                 if(iframe) {
                     if (iframe.requestFullscreen) iframe.requestFullscreen();
                     else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
                 }
            }
        });
    }

    // CC Toggle
    const ccBtn = document.getElementById('player-cc-btn');
    if(ccBtn) {
        ccBtn.addEventListener('click', () => {
            if(!player) return;
            // Toggle visual state
            const isActive = ccBtn.classList.contains('text-credacc');
            
            if (isActive) {
                if(typeof player.unloadModule === 'function') player.unloadModule('captions');
                if(typeof player.setOption === 'function') player.setOption('captions', 'track', {});
                ccBtn.classList.remove('text-credacc');
                ccBtn.classList.add('text-gray-600');
            } else {
                if(typeof player.loadModule === 'function') player.loadModule('captions');
                if(typeof player.setOption === 'function') player.setOption('captions', 'track', {'languageCode': 'en'});
                ccBtn.classList.remove('text-gray-600');
                ccBtn.classList.add('text-credacc');
            }
        });
    }
});

// Setup clicking interactions for fetched episodes
function setupEpisodeInteractions(trailerUrl) {
    const items = epListContainer.querySelectorAll('.episode-item');
    
    items.forEach(item => {
        item.addEventListener('click', function() {
            sounds.click();
            
            // Reset all items
            items.forEach(el => {
                el.classList.remove('border-credacc', 'bg-white/10');
                el.classList.add('border-transparent');
                const icon = el.querySelector('.fa-circle-play');
                if(icon) icon.remove();
            });

            // Set Active item styling
            this.classList.remove('border-transparent');
            this.classList.add('border-credacc', 'bg-white/10');
            this.insertAdjacentHTML('beforeend', '<i class="fa-solid fa-circle-play ml-auto text-credacc play-icon"></i>');

            // Simulate Video Loading state
            const epTitle = this.getAttribute('title');
            videoContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full w-full bg-black px-4 text-center">
                    <div class="loader ease-linear rounded-full border-4 border-t-4 border-zinc-700 h-16 w-16 mb-6"></div>
                    <p class="font-tech text-credacc text-sm tracking-[0.2em] animate-pulse">CONNECTING TO STREAM...</p>
                    <p class="font-sans text-xs text-gray-500 mt-2 uppercase truncate max-w-sm">${epTitle}</p>
                </div>
            `;

            // Reload the video
            setTimeout(() => {
                const animeTitle = document.getElementById('modal-title').textContent || '';
                loadVideoPlayer(trailerUrl, `${animeTitle} ${epTitle}`);
            }, 1200);
        });
    });
}

// Fetch real episodes for the selected Anime
async function fetchAnimeEpisodes(animeId, trailerUrl) {
    epListContainer.innerHTML = '<div class="text-gray-400 font-tech text-xs py-4 flex items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin"></i> FETCHING EPISODES...</div>';
    
    try {
        let res = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/episodes`);
        
        // Automatic retry for Rate Limit (429)
        if (res.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            res = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/episodes`);
        }

        if (!res.ok) throw 'API Limit';
        const data = await res.json();
        
        epListContainer.innerHTML = '';
        
        if (data.data && data.data.length > 0) {
            // Updated Logic: Show Total Count First (User Request)
            const totalEps = data.pagination && data.pagination.items ? data.pagination.items.total : data.data.length;
            
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'w-full bg-white/5 p-4 rounded text-center cursor-pointer hover:bg-white/10 transition-colors border border-white/5 group';
            summaryDiv.innerHTML = `
                <div class="font-display text-3xl text-credacc group-hover:text-white transition-colors">${totalEps}</div>
                <div class="font-tech text-[10px] tracking-widest text-gray-400">EPISODES AVAILABLE</div>
                <div class="mt-2 text-xs text-credacc/50 group-hover:text-credacc transition-colors"><i class="fa-solid fa-chevron-down"></i> VIEW LIST</div>
            `;
            
            summaryDiv.onclick = () => {
                if(typeof sounds !== 'undefined') sounds.click();
                epListContainer.innerHTML = '';
                // Render the list
                data.data.forEach((ep, index) => {
                    const isActive = index === 0;
                    const borderClass = isActive ? 'border-credacc bg-white/10' : 'border-transparent';
                    const iconHtml = isActive ? `<i class="fa-solid fa-circle-play ml-auto text-credacc play-icon"></i>` : '';
                    
                    epListContainer.innerHTML += `
                        <div class="episode-item flex items-center gap-3 p-3 bg-white/5 rounded hover:bg-white/10 cursor-pointer border-l-2 ${borderClass} transition-colors" data-ep="${ep.mal_id}" title="${ep.title}">
                            <span class="font-tech text-gray-500 text-[10px] w-6">EP ${ep.mal_id}</span>
                            <span class="text-xs font-semibold text-white truncate max-w-[150px]">${ep.title}</span>
                            ${iconHtml}
                        </div>
                    `;
                });
            };
            
            epListContainer.appendChild(summaryDiv);
        } else {
            // Fallback for Movies/OVAs to ensure video can be played
            epListContainer.innerHTML = `
                <div class="text-gray-500 font-tech text-[10px] tracking-wider mb-2 p-2 bg-white/5 rounded border border-white/5">MOVIE / OVA FORMAT</div>
                <div class="episode-item flex items-center gap-3 p-3 bg-white/10 rounded hover:bg-white/20 cursor-pointer border-l-2 border-credacc transition-colors" data-ep="1" title="Main Feature">
                    <span class="font-tech text-gray-500 text-[10px] w-6">01</span>
                    <span class="text-xs font-semibold text-white truncate max-w-[150px]">Main Feature</span>
                    <i class="fa-solid fa-circle-play ml-auto text-credacc play-icon"></i>
                </div>
            `;
        }
        setupEpisodeInteractions(trailerUrl);
    } catch(e) {
        // If Jikan rate limits the user, fallback to a manual play button so the app doesn't break
        epListContainer.innerHTML = `
            <div class="text-red-500 font-tech text-[10px] mb-2 px-2">API LIMIT REACHED</div>
            <div class="episode-item flex items-center gap-3 p-3 bg-white/10 rounded hover:bg-white/20 cursor-pointer border-l-2 border-credacc transition-colors" data-ep="1" title="Stream Trailer">
                <span class="font-tech text-gray-500 text-[10px] w-6">01</span>
                <span class="text-xs font-semibold text-white truncate max-w-[150px]">Stream Video</span>
                <i class="fa-solid fa-circle-play ml-auto text-credacc play-icon"></i>
            </div>
        `;
        setupEpisodeInteractions(trailerUrl);
    }
}

function openModal(data) {
    document.getElementById('modal-title').textContent = data.title;
    document.getElementById('modal-synopsis').textContent = data.synopsis;
    document.getElementById('modal-score').textContent = data.score;
    document.getElementById('modal-status').textContent = data.status;

    // Fetch Real Episodes using the stored Jikan ID and trailer
    if(epListContainer) {
        fetchAnimeEpisodes(data.id, data.trailer);
    }

    // Load initial video
    loadVideoPlayer(data.trailer, data.title);

    modal.classList.remove('hidden');
    // Small delay to allow display:block to apply before animating clip-path
    setTimeout(() => {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }, 10);
}

function closeModal() {
    modal.classList.remove('active');
    videoContainer.innerHTML = ''; // Stop video
    currentVideoState.fullscreenNative = false;
    currentVideoState.restoreTime = 0;
    const wrapper = document.getElementById('custom-player-wrapper');
    if (wrapper) wrapper.classList.remove('native-controls-mode');
    
    // Clear volume slider so it's recreated fresh for next video
    const volumeRoot = document.getElementById('volume-slider-root');
    if (volumeRoot) volumeRoot.innerHTML = '';
    window.volumeSlider = null;
    
    document.body.style.overflow = 'auto';
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 600); // match transition duration
}

closeModalBtn.addEventListener('click', () => {
    sounds.click();
    closeModal();
});

// Initialize Fetch
fetchTopAnime();

// --- ANIME QUOTES API LOGIC (AnimeChan) ---
const quoteText = document.getElementById('quote-text');
const quoteCharacter = document.getElementById('quote-character');
const quoteAnime = document.getElementById('quote-anime');
const quoteLoading = document.getElementById('quote-loading');
const loadMoreQuoteBtn = document.getElementById('load-more-quote-btn');
let isFetchingQuote = false;

// Expanded rock-solid fallback list in case the unreliable AnimeChan server is offline
const fallbackQuotes = [
    { anime: "Naruto", character: "Pain", quote: "Sometimes you must hurt in order to know, fall in order to grow, lose in order to gain." },
    { anime: "Attack on Titan", character: "Armin Arlert", quote: "A person who cannot sacrifice everything, cannot change anything." },
    { anime: "Fullmetal Alchemist", character: "Edward Elric", quote: "A lesson without pain is meaningless." },
    { anime: "One Piece", character: "Monkey D. Luffy", quote: "If you don't take risks, you can't create a future." },
    { anime: "Bleach", character: "Ichigo Kurosaki", quote: "We can't waste time worrying about the what if's." },
    { anime: "Cowboy Bebop", character: "Spike Spiegel", quote: "Whatever happens, happens." },
    { anime: "Death Note", character: "L Lawliet", quote: "Being alone is better than being with the wrong person." },
    { anime: "Tokyo Ghoul", character: "Ken Kaneki", quote: "Never trust anyone too much, remember the devil was once an angel." },
    { anime: "Jujutsu Kaisen", character: "Satoru Gojo", quote: "Searching for someone to blame is just a pain." },
    { anime: "Hunter x Hunter", character: "Gon Freecss", quote: "If you want to get to know someone, find out what makes them angry." },
    { anime: "Code Geass", character: "Lelouch vi Britannia", quote: "To defeat evil, I must become a greater evil." },
    { anime: "One Punch Man", character: "Saitama", quote: "I'll leave tomorrow's problems to tomorrow's me." },
    { anime: "Steins;Gate", character: "Okabe Rintarou", quote: "No one knows what the future holds. That's why its potential is infinite." }
];

async function fetchRandomQuote() {
    if(isFetchingQuote) return;
    isFetchingQuote = true;
    if(quoteLoading) quoteLoading.classList.remove('hidden');

    try {
        // 3 second timeout so the UI doesn't hang if the API is offline
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch('https://animechan.xyz/api/random', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if(!res.ok) throw new Error("API Unavailable");
        const data = await res.json();
        
        quoteText.textContent = `"${data.quote}"`;
        quoteCharacter.textContent = data.character;
        quoteAnime.textContent = data.anime;
    } catch(e) {
        // Silently fallback without throwing a console error so the app remains clean
        const randomFallback = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
        quoteText.textContent = `"${randomFallback.quote}"`;
        quoteCharacter.textContent = randomFallback.character;
        quoteAnime.textContent = randomFallback.anime;
    } finally {
        isFetchingQuote = false;
        if(quoteLoading) quoteLoading.classList.add('hidden');
    }
}

if(loadMoreQuoteBtn) {
    loadMoreQuoteBtn.addEventListener('click', () => {
        sounds.click();
        fetchRandomQuote();
    });
}

// Initial Fetch for Quotes
fetchRandomQuote();


// --- NEKOS.BEST API LOGIC ---
const nekoGrid = document.getElementById('neko-grid');
const loadMoreNekoBtn = document.getElementById('load-more-neko-btn');
const nekoLoading = document.getElementById('neko-loading');
let isFetchingNekos = false;

async function fetchNekos() {
    if(isFetchingNekos) return;
    isFetchingNekos = true;
    
    if(loadMoreNekoBtn) {
        loadMoreNekoBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> LOADING...';
    }
    nekoLoading.classList.remove('hidden');

    try {
        // Fetching 4 random neko images
        const res = await fetch('https://nekos.best/api/v2/neko?amount=4');
        const data = await res.json();
        
        if(data.results) {
            data.results.forEach(neko => {
                const card = document.createElement('div');
                card.className = 'rounded-xl overflow-hidden border border-white/5 relative group aspect-square cursor-pointer api-card';
                
                card.innerHTML = `
                    <img src="${neko.url}" alt="Neko" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute inset-0 card-img-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <span class="font-tech text-[10px] text-credacc uppercase tracking-wider">ARTIST: ${neko.artist_name || 'UNKNOWN'}</span>
                    </div>
                `;

                card.addEventListener('click', () => {
                    sounds.click();
                    window.open(neko.source_url, '_blank');
                });

                nekoGrid.appendChild(card);
            });
            ScrollTrigger.refresh();
        }
    } catch (error) {
        console.error("Error fetching nekos:", error);
    } finally {
        isFetchingNekos = false;
        nekoLoading.classList.add('hidden');
        if(loadMoreNekoBtn) {
            loadMoreNekoBtn.innerHTML = 'LOAD MORE NEKOS <i class="fa-solid fa-arrow-down"></i>';
        }
    }
}

if(loadMoreNekoBtn) {
    loadMoreNekoBtn.addEventListener('click', () => {
        sounds.click();
        fetchNekos();
    });
}

// Initial Fetch for Nekos
fetchNekos();

// --- ARCADE GAME LOGIC (Neon Strike / Scope-Creep inspired) ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiOverlay = document.getElementById('game-ui');
const hud = document.getElementById('game-hud');
const gameOverUi = document.getElementById('game-over-ui');
const startBtn = document.getElementById('start-game-btn');
const restartBtn = document.getElementById('restart-game-btn');

// Game State
let gameState = 'menu'; // menu, playing, gameover
let score = 0;
let lives = 3;
let targets = [];
let particles = [];
let lastTime = 0;
let spawnTimer = 0;
let spawnInterval = 1000; // MS
let animationId;

function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Target {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 40 + Math.random() * 20;
        this.life = 1.0; // 1 to 0
        this.decayRate = 0.008 + (score * 0.0005); // Faster as score increases
        this.color = `hsl(${120 + Math.random()*60}, 100%, 60%)`; // Greens/Cyans
        this.rotation = Math.random() * Math.PI * 2;
        this.sides = Math.floor(Math.random() * 3) + 3; // Triangle, Square, Pentagon
    }

    update() {
        if(this.radius < this.maxRadius && this.life > 0.5) {
            this.radius += 2; // Grow
        }
        this.life -= this.decayRate;
        this.rotation += 0.02;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw polygon
        ctx.beginPath();
        for (let i = 0; i < this.sides; i++) {
            const angle = (i * 2 * Math.PI) / this.sides;
            const r = this.radius * (this.life > 0.2 ? 1 : this.life * 5); // Shrink at end
            ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
        }
        ctx.closePath();
        
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = this.life;
        
        // Neon glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        
        ctx.stroke();
        
        // Inner fill
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life * 0.2;
        ctx.fill();

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.03;
        this.size *= 0.95;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function createExplosion(x, y, color) {
    for(let i=0; i<15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function startGame() {
    sounds.start();
    gameState = 'playing';
    score = 0;
    lives = 3;
    targets = [];
    particles = [];
    spawnInterval = 1000;
    
    updateHUD();
    uiOverlay.classList.add('hidden');
    gameOverUi.classList.add('hidden');
    hud.classList.remove('hidden');
    
    lastTime = performance.now();
    if(!animationId) loop(lastTime);
}

function endGame() {
    gameState = 'gameover';
    hud.classList.add('hidden');
    gameOverUi.classList.remove('hidden');
    document.getElementById('final-score').textContent = score;
}

function updateHUD() {
    document.getElementById('score-display').textContent = score;
    document.getElementById('lives-display').textContent = lives;
}

function spawnTarget() {
    const padding = 50;
    const x = padding + Math.random() * (canvas.width - padding * 2);
    const y = padding + Math.random() * (canvas.height - padding * 2);
    targets.push(new Target(x, y));
}

function handleInput(x, y) {
    if(gameState !== 'playing') return;
    
    let hit = false;
    for(let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        // Distance check
        const dx = x - t.x;
        const dy = y - t.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if(dist < t.maxRadius) { // Hit
            sounds.hit();
            createExplosion(t.x, t.y, t.color);
            targets.splice(i, 1);
            score += 10;
            spawnInterval = Math.max(300, 1000 - (score * 2)); // Increase difficulty
            updateHUD();
            hit = true;
            break; // Only hit top target
        }
    }
}

// Mouse/Touch handlers for Canvas
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    handleInput(e.clientX - rect.left, e.clientY - rect.top);
});

// Draw background grid effect
function drawBackground() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    
    ctx.beginPath();
    for(let x = 0; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for(let y = 0; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
}

function loop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if(gameState === 'playing') {
        drawBackground();

        // Spawning logic
        spawnTimer += dt;
        if(spawnTimer > spawnInterval) {
            spawnTarget();
            spawnTimer = 0;
        }

        // Update & Draw Targets
        for(let i = targets.length - 1; i >= 0; i--) {
            const t = targets[i];
            t.update();
            
            if(t.life <= 0) {
                sounds.miss();
                targets.splice(i, 1);
                lives--;
                updateHUD();
                // Screen shake effect placeholder
                canvas.style.transform = `translate(${(Math.random()-0.5)*10}px, ${(Math.random()-0.5)*10}px)`;
                setTimeout(()=> canvas.style.transform = 'none', 50);

                if(lives <= 0) endGame();
            } else {
                t.draw(ctx);
            }
        }

        // Update & Draw Particles
        for(let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            if(p.life <= 0) {
                particles.splice(i, 1);
            } else {
                p.draw(ctx);
            }
        }
        
        // Draw custom crosshair hint
        ctx.fillStyle = 'rgba(226, 249, 121, 0.1)';
        ctx.fillRect(0,0,canvas.width, canvas.height); // slight tint overlay
    }

    animationId = requestAnimationFrame(loop);
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw for background
drawBackground();
// TextPressure.js (Ported from React)
class TextPressure {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            console.warn(`TextPressure: Container with id '${containerId}' not found.`);
            return;
        }

        this.options = {
            text: 'Pop!',
            fontFamily: 'Compressa VF',
            fontUrl: 'https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2',
            width: true,
            weight: true,
            italic: true,
            alpha: false,
            flex: true,
            stroke: false,
            scale: false,
            textColor: '#FFFFFF',
            strokeColor: '#FF0000',
            strokeWidth: '3px',  // Customized
            minFontSize: 24,
            ...options
        };

        this.mouse = { x: 0, y: 0 };
        this.cursor = { x: 0, y: 0 };
        this.spans = [];
        this.rafId = null;

        this._initStyle();
        this._initElements();
        this._initEvents();
        this._setSize();
        this._animate();
    }

    _initStyle() {
        if (!document.getElementById('text-pressure-font-style')) {
            const style = document.createElement('style');
            style.id = 'text-pressure-font-style';
            style.textContent = `
                @font-face {
                    font-family: '${this.options.fontFamily}';
                    src: url('${this.options.fontUrl}');
                    font-style: normal;
                }
                .text-pressure-title {
                    color: ${this.options.textColor};
                    font-family: '${this.options.fontFamily}', sans-serif; /* Fallback */
                    text-transform: uppercase;
                    text-align: center;
                    user-select: none;
                    white-space: nowrap;
                    font-weight: 100;
                    margin: 0;
                    width: 100%;
                    /* Important for ensuring spans are inline-block for transform/width */
                }
                .text-pressure-title span {
                    display: inline-block;
                    transform-origin: center center; 
                }
                .text-pressure-flex {
                    display: flex;
                    justify-content: space-between;
                }
                .text-pressure-stroke span {
                    position: relative;
                    color: ${this.options.textColor};
                }
                .text-pressure-stroke span::after {
                    content: attr(data-char);
                    position: absolute;
                    left: 0;
                    top: 0;
                    color: transparent;
                    z-index: -1;
                    -webkit-text-stroke-width: ${this.options.strokeWidth};
                    -webkit-text-stroke-color: ${this.options.strokeColor};
                }
            `;
            document.head.appendChild(style);
        }
    }

    _initElements() {
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.background = 'transparent';

        const h1 = document.createElement('h1');
        h1.className = `text-pressure-title ${this.options.flex ? 'text-pressure-flex' : ''} ${this.options.stroke ? 'text-pressure-stroke' : ''}`;
        this.title = h1;

        const chars = this.options.text.split('');
        chars.forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.setAttribute('data-char', char);
            this.spans.push(span);
            h1.appendChild(span);
        });

        this.container.innerHTML = '';
        this.container.appendChild(h1);
    }

    _initEvents() {
        const handleMouseMove = (e) => {
            this.cursor.x = e.clientX;
            this.cursor.y = e.clientY;
        };
        const handleTouchMove = (e) => {
            const t = e.touches[0];
            this.cursor.x = t.clientX;
            this.cursor.y = t.clientY;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        
        // Resize observer or listener
        // Debounce not strictly needed for basic resize but good practice
        let timeout;
        window.addEventListener('resize', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => this._setSize(), 100);
        });

        // Cleanup function (if needed)
        this.cleanup = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            cancelAnimationFrame(this.rafId);
        };
        
        // Initial positioning
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = rect.left + rect.width / 2;
        this.mouse.y = rect.top + rect.height / 2;
        this.cursor.x = this.mouse.x;
        this.cursor.y = this.mouse.y;
    }

    _dist(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    _getAttr(distance, maxDist, minVal, maxVal) {
        const val = maxVal - Math.abs((maxVal * distance) / maxDist);
        return Math.max(minVal, val + minVal);
    }

    _setSize() {
        const { width: containerW, height: containerH } = this.container.getBoundingClientRect();
        
        // Logic from original component
        let newFontSize = containerW / (this.options.text.length / 2);
        newFontSize = Math.max(newFontSize, this.options.minFontSize);

        this.title.style.fontSize = `${newFontSize}px`;
        this.title.style.lineHeight = '1';
        this.title.style.transform = 'scale(1, 1)'; // Reset

        // Wait a frame for the font size to apply then checking height
        requestAnimationFrame(() => {
            const textRect = this.title.getBoundingClientRect();
            if (this.options.scale && textRect.height > 0) {
                const yRatio = containerH / textRect.height;
                this.title.style.transform = `scale(1, ${yRatio})`;
                this.title.style.lineHeight = `${yRatio}`;
            }
        });
    }

    _animate() {
        this.mouse.x += (this.cursor.x - this.mouse.x) / 15;
        this.mouse.y += (this.cursor.y - this.mouse.y) / 15;

        const titleRect = this.title.getBoundingClientRect();
        const maxDist = titleRect.width / 2;

        this.spans.forEach(span => {
            const rect = span.getBoundingClientRect();
            const charCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            const d = this._dist(this.mouse, charCenter);

            const wdth = this.options.width ? Math.floor(this._getAttr(d, maxDist, 5, 200)) : 100;
            const wght = this.options.weight ? Math.floor(this._getAttr(d, maxDist, 100, 900)) : 400;
            const italVal = this.options.italic ? this._getAttr(d, maxDist, 0, 1).toFixed(2) : 0;
            const alphaVal = this.options.alpha ? this._getAttr(d, maxDist, 0, 1).toFixed(2) : 1;

            span.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${italVal}`;
            
            if (this.options.alpha) {
                span.style.opacity = alphaVal;
            }
        });

        this.rafId = requestAnimationFrame(() => this._animate());
    }
}

// Initialize TextPressure for Discover Header
window.addEventListener('load', () => {
    const tp = new TextPressure('discover-pressure', {
        text: 'DISCOVER.',
        width: true,
        weight: true,
        italic: true,
        alpha: false,
        flex: true,
        stroke: true,
        scale: false,
        textColor: 'transparent',
        strokeColor: 'rgba(255,255,255,0.7)',
        strokeWidth: '1.5px', // Thicker Stroke
        minFontSize: 60 // Balanced size
    });
    
    // Clean layout fix
    const container = document.getElementById('discover-pressure');
    if(container) {
        container.style.letterSpacing = '0.05em'; 
        container.style.width = '100%';
        // Padding is handled in HTML now to prevent clipping while maintaining overflow:hidden for animation
    }
});

// --- ScrollReveal Component logic ---
class ScrollReveal {
    constructor(elementId, options = {}) {
        this.container = document.getElementById(elementId);
        
        if (!this.container) {
            console.warn(`ScrollReveal: Element with id '${elementId}' not found.`);
            return;
        }

        this.options = {
            baseOpacity: 0.1,
            enableBlur: true,
            baseRotation: 3,
            blurStrength: 4,
            rotationEnd: 'bottom 40%', 
            wordAnimationEnd: 'bottom 40%',
            ...options
        };

        this.init();
    }

    init() {
        // Prepare text structure
        // Clean text content to avoid multiple spaces issues if any
        const text = this.container.innerText.replace(/\s+/g, ' ').trim();
        this.container.innerHTML = '';

        const words = text.split(' ');
        
        words.forEach((word, index) => {
            const span = document.createElement('span');
            span.textContent = word + ' ';
            span.className = 'reveal-word';
            Object.assign(span.style, {
                display: 'inline-block',
                willChange: 'opacity, filter, transform',
                opacity: this.options.baseOpacity // Set initial state here to avoid FOUC
            });
            
            if(this.options.enableBlur) {
                span.style.filter = `blur(${this.options.blurStrength}px)`;
            }

            this.container.appendChild(span);
        });

        // Initialize GSAP Animation
        this.animate();
    }

    animate() {
        const { baseRotation, baseOpacity, enableBlur, blurStrength, rotationEnd, wordAnimationEnd } = this.options;
        const el = this.container;
        const wordElements = el.querySelectorAll('.reveal-word');

        // Kill previous triggers if re-initializing (not strictly needed here but good practice)
        // ScrollTrigger.getAll().forEach(t => t.trigger === el && t.kill());

        // 1. Container Rotation
        gsap.fromTo(el, 
            { transformOrigin: '50% 50%', rotate: baseRotation }, // Changed to center for better regular text flow feel
            {
                ease: 'none',
                rotate: 0,
                scrollTrigger: {
                    trigger: el,
                    // scroller: window, // default
                    start: 'top bottom',
                    end: rotationEnd,
                    scrub: true
                }
            }
        );

        // 2. Word Opacity Stagger
        gsap.fromTo(wordElements,
            { opacity: baseOpacity },
            {
                ease: 'none',
                opacity: 1,
                stagger: 0.05,
                scrollTrigger: {
                    trigger: el,
                    start: 'top bottom-=20%',
                    end: wordAnimationEnd,
                    scrub: true
                }
            }
        );

        // 3. Word Blur Stagger
        if (enableBlur) {
            gsap.fromTo(wordElements,
                { filter: `blur(${blurStrength}px)` },
                {
                    ease: 'none',
                    filter: 'blur(0px)',
                    stagger: 0.05,
                    scrollTrigger: {
                        trigger: el,
                        start: 'top bottom-=20%',
                        end: wordAnimationEnd,
                        scrub: true
                    }
                }
            );
        }
    }
}

// Initialize ScrollReveal - DEPRECATED in favor of ScrollFloat
// window.addEventListener('load', () => {
    // new ScrollReveal('scroll-reveal-text', {
    //     baseOpacity: 0.05,
    //     enableBlur: true,
    //     baseRotation: 2,
    //     blurStrength: 10,
    //     rotationEnd: 'top 60%',
    //     wordAnimationEnd: 'bottom 60%'
    // });
// })

// --- TARGET CURSOR COMPONENT ---
class TargetCursorController {
    constructor(targetSelector = 'a, button, .cursor-target, .episode-item, .api-card, .hero-btn', options = {}) {
        this.targetSelector = targetSelector;
        this.options = {
            spinDuration: 2,
            hideDefaultCursor: true,
            hoverDuration: 0.2,
            parallaxOn: true,
            ...options
        };
        
        this.cursor = null;
        this.dot = null;
        this.corners = [];
        this.spinTl = null;
        this.isActive = false;
        this.activeStrength = { current: 0 };
        this.targetCornerPositions = null;
        this.tickerFn = this.tickerFn.bind(this);
        
        // Remove restrictive check to ensure cursor always loads
        this.init();
    }
    
    // Legacy check retained but unused for init blocking
    checkMobile() {
        // Always return false to ensure cursor loads
        this.isMobile = false;
        return false;
    }

    init() {
        // ALWAYS Create Cursor Elements if not present, regardless of device type for now to fix issues
        if (!document.querySelector('.target-cursor-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'target-cursor-wrapper';
            wrapper.innerHTML = `
                <div class="target-cursor-dot"></div>
                <div class="target-cursor-corner corner-tl"></div>
                <div class="target-cursor-corner corner-tr"></div>
                <div class="target-cursor-corner corner-br"></div>
                <div class="target-cursor-corner corner-bl"></div>
            `;
            document.body.appendChild(wrapper);
            this.cursor = wrapper;
            this.dot = wrapper.querySelector('.target-cursor-dot');
            this.corners = Array.from(wrapper.querySelectorAll('.target-cursor-corner'));
        } else {
            this.cursor = document.querySelector('.target-cursor-wrapper');
            this.dot = this.cursor.querySelector('.target-cursor-dot');
            this.corners = Array.from(this.cursor.querySelectorAll('.target-cursor-corner'));
        }

        // Force hide default cursor globally
        const style = document.createElement('style');
        style.innerHTML = '* { cursor: none !important; }';
        document.head.appendChild(style);

        // Initial Set off-screen to prevent flash
        gsap.set(this.cursor, {
            x: -100,
            y: -100,
            opacity: 1
        });

        // Spin Timeline
        this.createSpinTimeline();

        // Event Listeners
        window.addEventListener('mousemove', this.moveCursor.bind(this));
        window.addEventListener('mousedown', this.mouseDown.bind(this));
        window.addEventListener('mouseup', this.mouseUp.bind(this));
        
        // Hover handling
        window.addEventListener('mouseover', this.enterHandler.bind(this), { passive: true });
        window.addEventListener('scroll', this.scrollHandler.bind(this), { passive: true });
    }


    createSpinTimeline() {
        if (this.spinTl) this.spinTl.kill();
        this.spinTl = gsap.timeline({ repeat: -1 })
            .to(this.cursor, { rotation: '+=360', duration: this.options.spinDuration, ease: 'none' });
    }

    moveCursor(e) {
        if (!this.cursor) return;
        gsap.to(this.cursor, {
            x: e.clientX,
            y: e.clientY,
            duration: 0.1,
            ease: 'power3.out'
        });
    }

    mouseDown() {
        if (!this.dot) return;
        gsap.to(this.dot, { scale: 0.7, duration: 0.3 });
        gsap.to(this.cursor, { scale: 0.9, duration: 0.2 });
    }

    mouseUp() {
        if (!this.dot) return;
        gsap.to(this.dot, { scale: 1, duration: 0.3 });
        gsap.to(this.cursor, { scale: 1, duration: 0.2 });
    }
    
    enterHandler(e) {
        // Check if target matches selector
        const target = e.target.closest(this.targetSelector);
        if (!target) return;
        
        if (this.activeTarget === target) return;
        
        // Cleanup old
        if (this.activeTarget) this.cleanupTarget(this.activeTarget);

        this.activeTarget = target;
        
        // Lock cursor logic
        this.activateCursor(target);
        
        // Add leave listener to THIS target
        const leaveHandler = () => {
            this.deactivateCursor();
            this.cleanupTarget(target, leaveHandler);
        };
        target.addEventListener('mouseleave', leaveHandler, { once: true });
        target._cursorLeaveHandler = leaveHandler; // Store reference
    }

    cleanupTarget(target, handler) {
        if (target && target._cursorLeaveHandler) {
            target.removeEventListener('mouseleave', target._cursorLeaveHandler);
            delete target._cursorLeaveHandler;
        }
    }
    
    scrollHandler() {
        if (!this.activeTarget || !this.cursor) return;
        const mouseX = gsap.getProperty(this.cursor, 'x');
        const mouseY = gsap.getProperty(this.cursor, 'y');
        const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
        
        const isStillOverTarget = elementUnderMouse && (elementUnderMouse === this.activeTarget || this.activeTarget.contains(elementUnderMouse));
        
        if (!isStillOverTarget) {
             if (this.activeTarget._cursorLeaveHandler) {
                 this.activeTarget._cursorLeaveHandler();
             }
        }
    }

    activateCursor(target) {
        // Kill spin
        gsap.killTweensOf(this.cursor, 'rotation');
        this.spinTl?.pause();
        gsap.set(this.cursor, { rotation: 0 });

        const rect = target.getBoundingClientRect();
        const borderWidth = 3;
        const cornerSize = 12;
        const cursorX = gsap.getProperty(this.cursor, 'x');
        const cursorY = gsap.getProperty(this.cursor, 'y');

        this.targetCornerPositions = [
            { x: rect.left - borderWidth, y: rect.top - borderWidth },
            { x: rect.right + borderWidth - cornerSize, y: rect.top - borderWidth },
            { x: rect.right + borderWidth - cornerSize, y: rect.bottom + borderWidth - cornerSize },
            { x: rect.left - borderWidth, y: rect.bottom + borderWidth - cornerSize }
        ];

        this.isActive = true;
        gsap.ticker.add(this.tickerFn);

        gsap.to(this.activeStrength, {
            current: 1,
            duration: this.options.hoverDuration,
            ease: 'power2.out'
        });
    }

    deactivateCursor() {
        gsap.ticker.remove(this.tickerFn);
        this.isActive = false;
        this.targetCornerPositions = null;
        gsap.set(this.activeStrength, { current: 0, overwrite: true });
        this.activeTarget = null;
        
        // Return corners to center
        const cornerSize = 12;
        const positions = [
            { x: -cornerSize * 1.5, y: -cornerSize * 1.5 },
            { x: cornerSize * 0.5, y: -cornerSize * 1.5 },
            { x: cornerSize * 0.5, y: cornerSize * 0.5 },
            { x: -cornerSize * 1.5, y: cornerSize * 0.5 }
        ];
        
        this.corners.forEach((corner, i) => {
             gsap.to(corner, {
                 x: positions[i].x,
                 y: positions[i].y,
                 duration: 0.3,
                 ease: 'power3.out'
             });
        });

        // Restart Spin
         if (this.spinTl) {
            const currentRotation = gsap.getProperty(this.cursor, 'rotation');
            const normalizedRotation = currentRotation % 360;
            this.spinTl.kill();
            this.spinTl = gsap.timeline({ repeat: -1 })
                .to(this.cursor, { rotation: '+=360', duration: this.options.spinDuration, ease: 'none' });
            
            gsap.to(this.cursor, {
                rotation: normalizedRotation + 360,
                duration: this.options.spinDuration * (1 - normalizedRotation / 360),
                ease: 'none',
                onComplete: () => {
                   this.spinTl?.restart();
                }
            });
         }
    }

    tickerFn() {
        if (!this.targetCornerPositions || !this.cursor) return;
        
        const strength = this.activeStrength.current;
        if (strength === 0) return;

        const cursorX = gsap.getProperty(this.cursor, 'x');
        const cursorY = gsap.getProperty(this.cursor, 'y');

        this.corners.forEach((corner, i) => {
            const currentX = gsap.getProperty(corner, 'x');
            const currentY = gsap.getProperty(corner, 'y');

            const targetX = this.targetCornerPositions[i].x - cursorX;
            const targetY = this.targetCornerPositions[i].y - cursorY;

            const finalX = currentX + (targetX - currentX) * strength;
            const finalY = currentY + (targetY - currentY) * strength;
            
             gsap.set(corner, {
                x: finalX,
                y: finalY
            });
        });
    }
}

// Initialize
const initCursor = () => {
    if(!document.querySelector('.target-cursor-wrapper')) {
        new TargetCursorController();
        // Aggressively hide default cursor
        const style = document.createElement('style');
        style.innerHTML = '* { cursor: none !important; }';
        document.head.appendChild(style);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCursor);
} else {
    initCursor();
}

// --- ClickSpark Component Logic ---
class ClickSpark {
    constructor(options = {}) {
        this.options = {
            activeOn: 'body', // Use CSS selector string or HTMLElement
            sparkColor: '#fff',
            sparkSize: 10,
            sparkRadius: 15,
            sparkCount: 8,
            duration: 400,
            easing: 'ease-out',
            extraScale: 1.0,
            ...options
        };

        this.root = typeof this.options.activeOn === 'string' 
            ? document.querySelector(this.options.activeOn)
            : this.options.activeOn;

        if (!this.root) {
             console.warn('ClickSpark: Root element not found', this.options.activeOn);
             return;
        }

        this.canvas = null;
        this.ctx = null;
        this.sparks = [];
        this.startTime = null;
        
        this.resizeObserver = null;
        
        this.init();
    }

    init() {
        // Create Canvas overlay
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 99999;
            user-select: none;
            position: absolute;
            top: 0;
            left: 0;
        `;
        
        // Ensure root positioning context
        const rootStyle = window.getComputedStyle(this.root);
        if (rootStyle.position === 'static' && this.root !== document.body) {
             this.root.style.position = 'relative'; 
        }
        if (this.root === document.body) {
            this.canvas.style.position = 'fixed'; // Better for full page
        }

        
        this.root.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Resize Handling
        const resize = () => {
            const rect = this.root.getBoundingClientRect();
            // Handle body/window slightly differently for full coverage
            const width = this.root === document.body ? window.innerWidth : rect.width;
            const height = this.root === document.body ? window.innerHeight : rect.height;
            
            this.canvas.width = width;
            this.canvas.height = height;
        };
        
        // Initial Resize
        resize();
        this.resizeObserver = new ResizeObserver(() => resize());
        this.resizeObserver.observe(this.root);
        window.addEventListener('resize', resize); // Extra safety for window

        // Event Listeners
        this.root.addEventListener('click', (e) => this.handleClick(e));
        
        // Start Loop
        this.animate();
    }

    easeFunc(t) {
        switch (this.options.easing) {
            case 'linear': return t;
            case 'ease-in': return t * t;
            case 'ease-in-out': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            default: return t * (2 - t); // ease-out
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const now = performance.now();

        const newSparks = Array.from({ length: this.options.sparkCount }, (_, i) => ({
            x,
            y,
            angle: (2 * Math.PI * i) / this.options.sparkCount,
            startTime: now
        }));
        
        this.sparks.push(...newSparks);
    }

    animate(timestamp) {
        if (!this.startTime) this.startTime = timestamp;
        
        const { duration, sparkRadius, extraScale, sparkSize, sparkColor } = this.options;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.sparks = this.sparks.filter(spark => {
            const elapsed = timestamp - spark.startTime;
            if (elapsed >= duration) return false;

            const progress = elapsed / duration;
            const eased = this.easeFunc(progress);
            
            const distance = eased * sparkRadius * extraScale;
            const lineLength = sparkSize * (1 - eased);

            const x1 = spark.x + distance * Math.cos(spark.angle);
            const y1 = spark.y + distance * Math.sin(spark.angle);
            const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
            const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

            this.ctx.strokeStyle = sparkColor;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();

            return true;
        });

        requestAnimationFrame((t) => this.animate(t));
    }
}

// Initialize ClickSpark Globally
window.addEventListener('load', () => {
    new ClickSpark({
        activeOn: 'body',
        sparkColor: '#fff',
        sparkSize: 10,
        sparkRadius: 15,
        sparkCount: 8,
        duration: 400
    });
});

/* --- ScrollFloat Component Logic (Ported from React Bits) --- */
class ScrollFloat {
    constructor(activeOn, options = {}) {
        this.container = document.querySelector(activeOn);
        if (!this.container) return;

        this.options = {
            animationDuration: 1,
            ease: 'back.inOut(2)',
            scrollStart: 'center bottom+=50%',
            scrollEnd: 'bottom bottom-=40%',
            stagger: 0.03,
            ...options
        };

        this.init();
    }

    init() {
        // Clean text - handle multiline or extra spaces
        const text = this.container.innerText.trim();
        this.container.innerHTML = '';
        this.container.classList.add('scroll-float');
        
        // Wrap text in scroll-float-text span
        const textWrapper = document.createElement('span');
        textWrapper.className = 'scroll-float-text';
        this.container.appendChild(textWrapper);

        // Split text
        const splitText = text.split('').map(char => {
             const span = document.createElement('span');
             span.className = 'char';
             span.textContent = char === ' ' ? '\u00A0' : char;
             return span;
        });
        
        splitText.forEach(span => textWrapper.appendChild(span));
        
        const charElements = textWrapper.querySelectorAll('.char');
        
        // GSAP Animation
        gsap.fromTo(
            charElements,
            {
                willChange: 'opacity, transform',
                opacity: 0,
                yPercent: 120,
                scaleY: 2.3,
                scaleX: 0.7,
                transformOrigin: '50% 0%'
            },
            {
                duration: this.options.animationDuration,
                ease: this.options.ease,
                opacity: 1,
                yPercent: 0,
                scaleY: 1,
                scaleX: 1,
                stagger: this.options.stagger,
                scrollTrigger: {
                    trigger: this.container,
                    start: this.options.scrollStart,
                    end: this.options.scrollEnd,
                    scrub: true,
                    // scroller: window, // default
                }
            }
        );
    }
}


// --- Animated List Logic (React-like features ported to Vanilla JS) ---
class AnimatedList {
    constructor(listContainerId, options = {}) {
        this.container = document.getElementById(listContainerId);
        if(!this.container) {
             // If container not found, wait for later or warn
             return; 
        }

        this.options = {
            showGradients: true,
            displayScrollbar: true,
            enableArrowNavigation: true,
            initialSelectedIndex: -1,
            onItemSelect: null,
            itemClassName: '',
            ...options
        };

        this.items = []; 
        this.selectedIndex = this.options.initialSelectedIndex;
        this.topGradient = null;
        this.bottomGradient = null;
        this.observer = null;
        
        this.init();
    }

    init() {
        // 1. Structure Setup (Wrapper for gradients)
        // Ideally the user provided ID is the scrollable element.
        // We wrap it in a relative container if it's not already suited.
        
        let parent = this.container.parentElement;
        if (!parent.classList.contains('scroll-list-container')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'scroll-list-container';
            wrapper.style.position = 'relative';
            wrapper.style.height = '100%';
            wrapper.style.overflow = 'hidden';
            
            // Move container into wrapper
            parent.replaceChild(wrapper, this.container);
            wrapper.appendChild(this.container);
            
            parent = wrapper; // Update reference for gradients
        }
        
        this.container.classList.add('scroll-list');
        if (!this.options.displayScrollbar) {
            this.container.classList.add('no-scrollbar');
        }

        // 2. Gradients
        if (this.options.showGradients) {
            // Attach gradients to the wrapper (parent)
            
            this.topGradient = document.createElement('div');
            this.topGradient.className = 'top-gradient';
            this.topGradient.style.background = 'linear-gradient(to bottom, #121212 0%, transparent 100%)';
            this.topGradient.style.position = 'absolute';
            this.topGradient.style.top = '0';
            this.topGradient.style.left = '0';
            this.topGradient.style.right = '0';
            this.topGradient.style.height = '50px';
            this.topGradient.style.pointerEvents = 'none';
            this.topGradient.style.zIndex = '20';
            this.topGradient.style.opacity = '0';
            this.topGradient.style.transition = 'opacity 0.2s';
            
            this.bottomGradient = document.createElement('div');
            this.bottomGradient.className = 'bottom-gradient';
            this.bottomGradient.style.background = 'linear-gradient(to top, #121212 0%, transparent 100%)';
            this.bottomGradient.style.position = 'absolute';
            this.bottomGradient.style.bottom = '0';
            this.bottomGradient.style.left = '0';
            this.bottomGradient.style.right = '0';
            this.bottomGradient.style.height = '50px';
            this.bottomGradient.style.pointerEvents = 'none';
            this.bottomGradient.style.zIndex = '20';
            this.bottomGradient.style.opacity = '1';
            this.bottomGradient.style.transition = 'opacity 0.2s';
            
            parent.appendChild(this.topGradient);
            parent.appendChild(this.bottomGradient);
        }

        // 3. Observers & Event Listeners
        this.container.addEventListener('scroll', () => this.handleScroll());
        
        if (this.options.enableArrowNavigation) {
            // Bind to container focus or globally if modal implies focus?
            // User requested global listener for Arrow keys in React example
            window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        }

        // IO for animation (scale/opacity on view)
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const el = entry.target;
                if (entry.isIntersecting) {
                   el.style.opacity = '1';
                   el.style.transform = 'scale(1)';
                   // mimic motion.div animate={inView}
                } else {
                   // Optional: reset if we want persistent re-animation
                   // el.style.opacity = '0';
                   // el.style.transform = 'scale(0.7)';
                }
            });
        }, {
            root: this.container,
            threshold: 0.2 // amount: 0.5 roughly
        });

        // 4. Handle initial items (if any exist in DOM) or setup MutationObserver
        this.refreshItems();
        
        // Listen for new items added dynamically (e.g. from API)
        const mutationObserver = new MutationObserver(() => this.refreshItems());
        mutationObserver.observe(this.container, { childList: true });
        
        this.handleScroll(); // Initial Check
    }

    refreshItems() {
        // Re-scan children
        const children = Array.from(this.container.children);
        
        children.forEach((child, index) => {
            // Add Styles/State if new
            if (!child.hasAttribute('data-animated')) {
                child.setAttribute('data-animated', 'true');
                child.setAttribute('data-index', index);
                
                // Initial styles (mimic initial={{ scale: 0.7, opacity: 0 }})
                child.style.transition = 'all 0.2s ease';
                child.style.opacity = '0';
                child.style.transform = 'scale(0.7)';
                child.style.cursor = 'pointer';
                if(this.options.itemClassName) child.classList.add(this.options.itemClassName);

                // Events
                child.addEventListener('mouseenter', () => this.setSelectedIndex(index));
                child.addEventListener('click', () => {
                    this.setSelectedIndex(index);
                    if (this.options.onItemSelect) {
                        // Extract text content as 'item'
                        this.options.onItemSelect(child.textContent, index);
                    }
                });
                
                // Observe
                this.observer.observe(child);
            }
            
            // Update selected state class
            if (index === this.selectedIndex) {
                child.classList.add('selected');
                child.firstElementChild?.classList.add('selected'); // if nested
            } else {
                child.classList.remove('selected');
                child.firstElementChild?.classList.remove('selected');
            }
        });
        
        this.items = children;
    }

    setSelectedIndex(index) {
        if (index < 0 || index >= this.items.length) return;
        
        this.selectedIndex = index;
        
        // Update visual classes
        this.items.forEach((item, i) => {
             if (i === index) {
                item.classList.add('selected');
                item.firstElementChild?.classList.add('selected');
             } else {
                item.classList.remove('selected');
                item.firstElementChild?.classList.remove('selected');
             }
        });
        
        // Handle Scrolling for keyboard nav (if needed)
        // Logic implemented in handleKeyDown mostly, but if set manually:
        // this.scrollToItem(index);
    }

    scrollToItem(index) {
        const selectedItem = this.items[index];
        if (!selectedItem) return;

        const container = this.container;
        const extraMargin = 50;
        const containerScrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const itemTop = selectedItem.offsetTop; // Relative to relative parent? 
        // offsetTop is relative to offsetParent. If container is positioned, it works.
        const itemBottom = itemTop + selectedItem.offsetHeight;

        if (itemTop < containerScrollTop + extraMargin) {
            container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
        } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
            container.scrollTo({
                top: itemBottom - containerHeight + extraMargin,
                behavior: 'smooth'
            });
        }
    }

    handleKeyDown(e) {
        // Only navigational keys
        if (!['ArrowDown', 'ArrowUp', 'Tab', 'Enter'].includes(e.key)) return;
        
        // If list is empty or hidden, maybe ignore?
        if (this.items.length === 0) return;

        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            const next = Math.min(this.selectedIndex + 1, this.items.length - 1);
            this.setSelectedIndex(next);
            this.scrollToItem(next);
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            const prev = Math.max(this.selectedIndex - 1, 0);
            this.setSelectedIndex(prev);
            this.scrollToItem(prev);
        } else if (e.key === 'Enter') {
            if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
                e.preventDefault();
                const item = this.items[this.selectedIndex];
                item.click(); // Trigger click handler
            }
        }
    }

    handleScroll() {
        if(!this.options.showGradients) return;
        
        const { scrollTop, scrollHeight, clientHeight } = this.container;
        
        if(this.topGradient) {
            this.topGradient.style.opacity = Math.min(scrollTop / 50, 1);
        }
        if(this.bottomGradient) {
            const bottomDistance = scrollHeight - (scrollTop + clientHeight);
            this.bottomGradient.style.opacity = scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1);
        }
    }
}


// Initialize New Components
window.addEventListener('load', () => {
    // 1. ScrollFloat for the Quote (replacing old ScrollReveal or enhancing it)
    new ScrollFloat('#scroll-reveal-text', {
        animationDuration: 1,
        ease: 'back.inOut(2)',
        scrollStart: 'center bottom+=50%',
        scrollEnd: 'bottom bottom-=40%',
        stagger: 0.03
    });

    // 2. Animated List for Episodes
    // The ID for the episode list container is 'episode-list' (from previous context)
    new AnimatedList('episode-list');
});


// --- Dock Navigation (Ported from React) ---
class Dock {
    constructor(containerSelector, items, options = {}) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) return;

        this.items = items;
        this.options = {
            baseItemSize: 40,
            magnification: 70, 
            panelHeight: 68,
            spread: 120, // Distance of influence
            ...options
        };

        this.dockItems = [];
        this.mouseX = -9999;
        this.isHovering = false;

        this.init();
    }

    init() {
        this.render();
        this.setupEvents();
        this.animate = this.animate.bind(this);
        this.animate();
    }

    render() {
        this.container.innerHTML = '';
        // this.container.style.height = this.options.panelHeight + 'px'; // Don't force height on container, let items dictate

        this.items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'dock-item';
            
            // Initial style
            el.style.width = this.options.baseItemSize + 'px';
            el.style.height = this.options.baseItemSize + 'px';

            // Icon
            const icon = document.createElement('i');
            icon.className = `dock-icon ${item.icon}`;
            el.appendChild(icon);
            
            // Custom Tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'dock-tooltip';
            tooltip.innerText = item.label;
            el.appendChild(tooltip);

            el.addEventListener('click', () => {
                if (item.onClick) item.onClick();
            });

            this.container.appendChild(el);
            this.dockItems.push({ el, icon });
        });
    }

    setupEvents() {
        this.container.addEventListener('mousemove', (e) => {
            this.isHovering = true;
            this.mouseX = e.clientX;
        });

        this.container.addEventListener('mouseleave', () => {
            this.isHovering = false;
            this.mouseX = -9999;
        });
    }

    animate() {
        if (this.isHovering) {
            this.dockItems.forEach(itemObj => {
                const rect = itemObj.el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const dist = Math.abs(this.mouseX - centerX);
                
                let scale = 1;
                
                if (dist < this.options.spread) {
                    // Simple cosine ease for smooth curve
                    const val = Math.cos((dist / this.options.spread) * (Math.PI / 2));
                    const factor = Math.max(0, val);
                    const targetSize = this.options.baseItemSize + (this.options.magnification - this.options.baseItemSize) * factor;
                    
                    itemObj.el.style.width = `${targetSize}px`;
                    itemObj.el.style.height = `${targetSize}px`;
                } else {
                     itemObj.el.style.width = `${this.options.baseItemSize}px`;
                     itemObj.el.style.height = `${this.options.baseItemSize}px`;
                }
            });
        } else {
             // Reset smoothly
             this.dockItems.forEach(itemObj => {
                 itemObj.el.style.width = `${this.options.baseItemSize}px`;
                 itemObj.el.style.height = `${this.options.baseItemSize}px`;
             });
        }

        requestAnimationFrame(this.animate);
    }
}

// Initialize Dock when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only init if dock container exists
    if(!document.getElementById('dock-container')) return;

    const dockItems = [
        { 
            icon: 'fa-solid fa-house', 
            label: 'Home', 
            onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
        },
        { 
            icon: 'fa-solid fa-compass', 
            label: 'Discover', 
            onClick: () => {
                const el = document.getElementById('discover');
                if(el) el.scrollIntoView({ behavior: 'smooth' });
            }
        },
        { 
            icon: 'fa-solid fa-quote-left', 
            label: 'Quotes', 
            onClick: () => {
                const el = document.getElementById('quotes');
                if(el) el.scrollIntoView({ behavior: 'smooth' });
            }
        },
        { 
            icon: 'fa-solid fa-images', 
            label: 'Gallery', 
            onClick: () => {
                const el = document.getElementById('gallery');
                if(el) el.scrollIntoView({ behavior: 'smooth' });
            }
        },
        { 
            icon: 'fa-solid fa-gamepad', 
            label: 'Arcade', 
            onClick: () => {
                const el = document.getElementById('arcade');
                if(el) el.scrollIntoView({ behavior: 'smooth' });
            }
        }
    ];

    new Dock('#dock-container', dockItems, {
        baseItemSize: 40, 
        magnification: 70,
        spread: 120
    });
});

// --- ElasticSlider Class (Vanilla JS + GSAP) ---
class ElasticSlider {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        if (!this.container) return;

        this.options = {
            defaultValue: 50,
            startingValue: 0,
            maxValue: 100,
            isStepped: false, // snap to step
            stepSize: 1,
            isVertical: false, // New orientation option
            leftIcon: '', // HTML string or element
            rightIcon: '', // HTML string or element
            onChange: () => {},
            onDragStart: () => {},
            onDragEnd: () => {},
            ...options
        };

        this.value = this.options.defaultValue;
        this.isDragging = false;
        
        // State tracking for animations
        this.region = 'middle'; // 'left', 'middle', 'right'
        this.overflow = { value: 0 }; // Using object for GSAP target
        this.scale = { value: 1 };
        
        this.sliderRef = null;
        this.trackWrapper = null;
        this.fill = null;
        this.leftIconEl = null;
        this.rightIconEl = null;

        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.className = `slider-container ${this.container.className}`; // Keep existing classes
        if (this.options.isVertical) {
            this.container.classList.add('is-vertical');
        }

        // Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'slider-wrapper';
        
        // Left Icon
        this.leftIconEl = document.createElement('div');
        this.leftIconEl.className = 'slider-icon left';
        this.leftIconEl.innerHTML = this.options.leftIcon;
        wrapper.appendChild(this.leftIconEl);

        // Root (Interactive Area)
        this.sliderRef = document.createElement('div');
        this.sliderRef.className = 'slider-root';
        
        // Track Wrapper (Scales)
        this.trackWrapper = document.createElement('div');
        this.trackWrapper.className = 'slider-track-wrapper';
        
        // Track (Visual)
        const track = document.createElement('div');
        track.className = 'slider-track';
        
        // Fill/Range
        this.fill = document.createElement('div');
        this.fill.className = 'slider-range';
        
        track.appendChild(this.fill);
        this.trackWrapper.appendChild(track);
        this.sliderRef.appendChild(this.trackWrapper);
        wrapper.appendChild(this.sliderRef);

        // Right Icon
        this.rightIconEl = document.createElement('div');
        this.rightIconEl.className = 'slider-icon right';
        this.rightIconEl.innerHTML = this.options.rightIcon;
        wrapper.appendChild(this.rightIconEl);

        this.container.appendChild(wrapper);

        // Value Indicator (Optional, user React code had it)
        // this.valueIndicator = document.createElement('p');
        // this.valueIndicator.className = 'value-indicator';
        // this.container.appendChild(this.valueIndicator);

        this.updateVisuals(this.value, false);
        this.addEvents();
        
        // Hover effects
        wrapper.addEventListener('mouseenter', () => this.animateScale(1.2));
        wrapper.addEventListener('mouseleave', () => this.animateScale(1));
        wrapper.addEventListener('touchstart', () => this.animateScale(1.2), { passive: true });
        wrapper.addEventListener('touchend', () => this.animateScale(1), { passive: true });
    }

    animateScale(targetScale) {
        gsap.to(this.scale, {
            value: targetScale,
            duration: 0.3,
            onUpdate: () => {
                // Apply scale & opacity transforms
                const wrapper = this.container.querySelector('.slider-wrapper');
                if(wrapper) {
                   wrapper.style.transform = `scale(${this.scale.value})`;
                   wrapper.style.opacity = gsap.utils.mapRange(1, 1.2, 0.7, 1, this.scale.value);
                }
                
                // Track Height/Margin adjustments based on scale
                if(this.trackWrapper) {
                    const h = gsap.utils.mapRange(1, 1.2, 6, 12, this.scale.value);
                    const m = gsap.utils.mapRange(1, 1.2, 0, -3, this.scale.value);
                    this.trackWrapper.style.height = `${h}px`;
                    this.trackWrapper.style.marginTop = `${m}px`;
                    this.trackWrapper.style.marginBottom = `${m}px`;
                }
            }
        });
    }

    addEvents() {
        const handleMove = (clientX, clientY) => {
            const rect = this.sliderRef.getBoundingClientRect();
            const { left, width, right } = rect;
            
            // Region detection & Overflow logic
            let newValue = 0;

            if (this.options.isVertical) {
                // Vertical Logic
                // For volume: top is 100%, bottom is 0%. BUT visual implementation usually expects overflow to be pushed out.
                // Let's assume standard behavior:
                // Dragging above top -> Overflow 'top' (mapped to 'right' logic for simplicity or new logic)
                
                const { top, height, bottom } = rect;

                if (clientY < top) {
                     this.setRegion('right'); // visual reuse
                     newValue = top - clientY;
                } else if (clientY > bottom) {
                     this.setRegion('left'); // visual reuse
                     newValue = clientY - bottom;
                } else {
                     this.setRegion('middle');
                     newValue = 0;
                }

                // Decay function for overflow
                const MAX_OVERFLOW = 50;
                const decay = (v, max) => {
                    if (max === 0) return 0;
                    const entry = v / max;
                    const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
                    return sigmoid * max;
                };
                
                this.overflow.value = decay(newValue, MAX_OVERFLOW);
                this.updateOverflowVisuals(clientY, rect); // Pass clientY for vertical

                // Calculate Value (0 at bottom, 1 at top)
                let rawPercent = (bottom - clientY) / height;
                
                // Map to range
                const range = this.options.maxValue - this.options.startingValue;
                let val = this.options.startingValue + (rawPercent * range);
                
                if (this.options.isStepped) {
                    val = Math.round(val / this.options.stepSize) * this.options.stepSize;
                }

                // Clamp
                val = Math.max(this.options.startingValue, Math.min(this.options.maxValue, val));
                
                if(this.value !== val) {
                    this.setValue(val, true); 
                }

            } else {
                // Horizontal (Existing Logic)
                const { left, width, right } = rect;

                if (clientX < left) {
                    this.setRegion('left');
                    newValue = left - clientX;
                } else if (clientX > right) {
                    this.setRegion('right');
                    newValue = clientX - right;
                } else {
                    this.setRegion('middle');
                    newValue = 0;
                }

                // Decay function for overflow
                const MAX_OVERFLOW = 50;
                const decay = (v, max) => {
                    if (max === 0) return 0;
                    const entry = v / max;
                    const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
                    return sigmoid * max;
                };
                
                this.overflow.value = decay(newValue, MAX_OVERFLOW);
                this.updateOverflowVisuals(clientX, rect);

                // Calculate Value
                let rawPercent = (clientX - left) / width;
                // Map to range
                const range = this.options.maxValue - this.options.startingValue;
                let val = this.options.startingValue + (rawPercent * range);
                
                if (this.options.isStepped) {
                    val = Math.round(val / this.options.stepSize) * this.options.stepSize;
                }

                // Clamp
                val = Math.max(this.options.startingValue, Math.min(this.options.maxValue, val));
                
                if(this.value !== val) {
                    this.setValue(val, true); 
                }
            }
        };

        const onPointerDown = (e) => {
            this.isDragging = true;
            this.sliderRef.classList.add('active'); // CSS cursor grabbing
            this.options.onDragStart(this.value);
            this.animateScale(1.2);
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            handleMove(clientX, clientY);

            const onPointerMove = (moveEvent) => {
                const cx = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const cy = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
                handleMove(cx, cy);
            };

            const onPointerUp = () => {
                this.isDragging = false;
                this.sliderRef.classList.remove('active');
                this.options.onDragEnd(this.value);
                this.animateScale(1); 
                
                // Spring back overflow
                gsap.to(this.overflow, {
                    value: 0,
                    duration: 0.5,
                    ease: "elastic.out(1, 0.5)",
                    onUpdate: () => {
                         // Reset scale/transforms
                         this.updateOverflowVisuals(0, this.sliderRef.getBoundingClientRect(), true);
                    }
                });
                
                // Reset Region scales
                this.setRegion('middle');

                window.removeEventListener('mousemove', onPointerMove);
                window.removeEventListener('mouseup', onPointerUp);
                window.removeEventListener('touchmove', onPointerMove);
                window.removeEventListener('touchend', onPointerUp);
            };

            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('mouseup', onPointerUp);
            window.addEventListener('touchmove', onPointerMove, { passive: false });
            window.addEventListener('touchend', onPointerUp);
        };

        this.sliderRef.addEventListener('mousedown', onPointerDown);
        this.sliderRef.addEventListener('touchstart', onPointerDown, { passive: false });

        // Add click handler for direct value setting
        this.sliderRef.addEventListener('click', (e) => {
            if (this.isDragging) return; // Skip if currently dragging

            const rect = this.sliderRef.getBoundingClientRect();
            const clientX = e.clientX;
            const clientY = e.clientY;

            if (this.options.isVertical) {
                // Vertical click: calculate value from top to bottom
                const { top, height, bottom } = rect;
                let rawPercent = (bottom - clientY) / height;
                rawPercent = Math.max(0, Math.min(1, rawPercent)); // Clamp 0-1

                const range = this.options.maxValue - this.options.startingValue;
                let val = this.options.startingValue + (rawPercent * range);

                if (this.options.isStepped) {
                    val = Math.round(val / this.options.stepSize) * this.options.stepSize;
                }

                val = Math.max(this.options.startingValue, Math.min(this.options.maxValue, val));
                this.setValue(val, true);
                this.options.onDragEnd(val);
            } else {
                // Horizontal click: calculate value from left to right
                const { left, width } = rect;
                let rawPercent = (clientX - left) / width;
                rawPercent = Math.max(0, Math.min(1, rawPercent)); // Clamp 0-1

                const range = this.options.maxValue - this.options.startingValue;
                let val = this.options.startingValue + (rawPercent * range);

                if (this.options.isStepped) {
                    val = Math.round(val / this.options.stepSize) * this.options.stepSize;
                }

                val = Math.max(this.options.startingValue, Math.min(this.options.maxValue, val));
                this.setValue(val, true);
                this.options.onDragEnd(val);
            }
        });
    }

    setRegion(newRegion) {
        if (this.region === newRegion) return;
        this.region = newRegion;

        // Animate Icons pop
        if (newRegion === 'left' && this.leftIconEl) {
             gsap.to(this.leftIconEl, { scale: 1.4, duration: 0.15, yoyo: true, repeat: 1 });
        }
        if (newRegion === 'right' && this.rightIconEl) {
             gsap.to(this.rightIconEl, { scale: 1.4, duration: 0.15, yoyo: true, repeat: 1 });
        }
    }

    updateOverflowVisuals(clientCoord, rect, isResetting = false) {
        const { width, height, left, top } = rect;
        const overflowVal = this.overflow.value;
        const scaleVal = this.scale.value;

        if (this.options.isVertical) {
             // Vertical Logic
             const scaleY = 1 + (overflowVal / height);
             const scaleX = gsap.utils.mapRange(0, 50, 1, 0.8, overflowVal);
             
             let origin = 'center';
             if (!isResetting) {
                  // For vertical volume: bottom is min (left), top is max (right)
                  // Wait, region 'left' means min (bottom), region 'right' means max (top)
                  origin = clientCoord < top + height / 2 ? 'bottom' : 'top'; 
             }
             
             // Icons Move Y
             if (this.region === 'left') { // Bottom
                  const y = overflowVal / scaleVal; // Push down?
                  gsap.set(this.leftIconEl, { y: y });
             } else {
                  gsap.set(this.leftIconEl, { y: 0 });
             }
             
             if (this.region === 'right') { // Top
                  const y = -overflowVal / scaleVal; // Push up
                  gsap.set(this.rightIconEl, { y: y });
             } else {
                  gsap.set(this.rightIconEl, { y: 0 });
             }

             gsap.set(this.trackWrapper, {
                 scaleX: scaleX,
                 scaleY: scaleY,
                 transformOrigin: origin
             });

        } else {
             // Horizontal Logic
             const scaleX = 1 + (overflowVal / width);
             const scaleY = gsap.utils.mapRange(0, 50, 1, 0.8, overflowVal);
     
             let origin = 'center';
             if (!isResetting) {
                  origin = clientCoord < left + width / 2 ? 'right' : 'left';
             }
     
             if (this.region === 'left') {
                  const x = -overflowVal / scaleVal;
                  gsap.set(this.leftIconEl, { x: x });
             } else {
                  gsap.set(this.leftIconEl, { x: 0 });
             }
     
             if (this.region === 'right') {
                  const x = overflowVal / scaleVal;
                  gsap.set(this.rightIconEl, { x: x });
             } else {
                  gsap.set(this.rightIconEl, { x: 0 });
             }
     
             gsap.set(this.trackWrapper, {
                 scaleX: scaleX,
                 scaleY: scaleY,
                 transformOrigin: origin
             });
        }
    }

    setValue(newValue, updateUI = true) {
        this.value = newValue;
        if (updateUI) this.updateVisuals(this.value);
        this.options.onChange(this.value);
    }

    updateVisuals(val) {
        const range = this.options.maxValue - this.options.startingValue;
        if (range === 0) return;
        const percent = ((val - this.options.startingValue) / range) * 100;
        
        if (this.options.isVertical) {
            this.fill.style.width = '100%';
            this.fill.style.height = `${percent}%`;
            // Ensure fill grows from bottom
            this.fill.style.bottom = '0';
            this.fill.style.top = 'auto'; // Important for volume
        } else {
            this.fill.style.height = '100%';
            this.fill.style.width = `${percent}%`;
        }
        
        // if(this.valueIndicator) this.valueIndicator.innerText = Math.round(val);
    }
}


// --- AniList API Fallback for Trailers ---
async function fetchTrailerFromAniList(title) {
    if (!title) return null;
    const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        trailer {
          id
          site
        }
      }
    }
    `;
    const variables = { search: title };
    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query, variables })
        });
        const json = await response.json();
        const trailer = json.data?.Media?.trailer;
        if (trailer && trailer.site === 'youtube' && trailer.id) {
            return `https://www.youtube.com/watch?v=${trailer.id}`;
        }
    } catch (e) {
        console.warn('AniList API Error:', e);
    }
    return null;
}

// --- Kitsu API Fallback (Second Layer) ---
async function fetchTrailerFromKitsu(title) {
    if (!title) return null;
    try {
        const response = await fetch(`https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=1`);
        const json = await response.json();
        
        if (json.data && json.data.length > 0) {
            const anime = json.data[0];
            const videoId = anime.attributes.youtubeVideoId;
            if (videoId) {
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
        }
    } catch (e) {
        console.warn('Kitsu API Error:', e);
    }
    return null;
}

// --- Combined Fallback Search ---
async function findAlternativeTrailer(title) {
    let url = await fetchTrailerFromAniList(title);
    if(url) return url;
    
    // Try Kitsu as second option
    console.log("AniList failed, trying Kitsu for:", title);
    url = await fetchTrailerFromKitsu(title);
    if(url) return url;
    
    return null;
}
