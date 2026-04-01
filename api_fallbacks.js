
// --- With Timeout ---
function fetchWithTimeout(url, options = {}, timeout = 8000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout')), timeout)
        )
    ]);
}

// --- Master Fallback Controller (AniList -> Kitsu -> Shikimori -> Hardcoded) ---
async function fetchTopAnimeBackup(page, append) {
    const sources = [
        { name: 'AniList', fn: fetchTopAnimeFromAniList },
        { name: 'Kitsu', fn: fetchTopAnimeFromKitsu },
        { name: 'Shikimori', fn: fetchTopAnimeFromShikimori },
        { name: 'Hardcoded', fn: fetchTopAnimeFromHardcoded, isUltimate: true }
    ];

    for (const source of sources) {
        try {
            console.log(`[Backup] Attempting ${source.name} (Page ${page})...`);
            await source.fn(page, append);
            console.log(`[Backup] ${source.name} succeeded!`);
            return; // Success
        } catch (e) {
            console.warn(`[Backup] ${source.name} failed: ${e.message}`);
            
            // If hardcoded fails, treat it as ultimate fallback and don't throw
            if (source.isUltimate) {
                console.error("[Backup] Even hardcoded fallback failed! Forcing recovery...");
                try {
                    // Final safety: ensure hardcoded serves WITHOUT throwing
                    await fetchTopAnimeFromHardcoded(page, append);
                    console.log("[Backup] Forced hardcoded recovery succeeded");
                    return;
                } catch (finalError) {
                    console.error("[Backup] CRITICAL: Hardcoded fallback completely failed:", finalError);
                    // This is the absolute last resort - don't throw, just fail silently
                    // The App will show error UI but won't crash
                    throw new Error('All backup sources failed including hardcoded fallback');
                }
            }
        }
    }

    console.error("[Backup] All fallback sources exhausted.");
    throw new Error('All API sources failed');
}

// --- Shikimori API Fallback ---
async function fetchTopAnimeFromShikimori(page, append) {
    const limit = 8;
    try {
        const response = await fetchWithTimeout(`https://shikimori.one/api/animes?limit=${limit}&page=${page}&order=popularity&status=ongoing&kind=tv&order=-score`, {}, 8000);
        if (!response.ok) throw new Error(`Shikimori HTTP ${response.status}`);
        
        const json = await response.json();
        if (!json || json.length === 0) throw new Error("Shikimori No Data");

        const mediaList = json.map(anime => {
            return {
                mal_id: anime.id, 
                title: anime.name, // English/Romaji usually
                synopsis: "Click for details...", // List endpoint doesn't give synopsis
                score: anime.score || "N/A",
                status: anime.status === 'ongoing' ? 'RELEASING' : 'FINISHED',
                trailer: {
                    embed_url: null // List endpoint doesn't give trailer
                },
                images: {
                    webp: {
                        large_image_url: anime.image && anime.image.original ? `https://shikimori.one${anime.image.original}` : 'https://via.placeholder.com/225x318?text=No+Image'
                    }
                },
                genres: [{name: 'Anime'}] 
            };
        });

        if (!append) loadingGrid.classList.add('hidden');
        renderAnimeCards(mediaList, append);

        // Simple Pagination Assumption
        if (json.length === limit) {
             if (loadMoreContainer) loadMoreContainer.classList.remove('hidden');
             if (nextBtn) nextBtn.disabled = false;
        } else {
             if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
             if (nextBtn) nextBtn.disabled = true;
        }

    } catch (e) {
        throw e;
    }
}

// --- Kitsu API Fallback --- 
async function fetchTopAnimeFromKitsu(page, append) {
    const offset = (page - 1) * 8;
    try {
        const response = await fetchWithTimeout(`https://kitsu.io/api/edge/anime?sort=-averageRating&page[limit]=8&page[offset]=${offset}`, {}, 8000);
        if (!response.ok) throw new Error(`Kitsu HTTP ${response.status}`);
        
        const json = await response.json();
        if (!json.data || json.data.length === 0) throw new Error("Kitsu No Data");

        const mediaList = json.data.map(item => {
            const attr = item.attributes;
            return {
                mal_id: item.id, // Use Kitsu ID as fallback
                title: attr.canonicalTitle || attr.titles.en || attr.titles.en_jp,
                synopsis: attr.synopsis || "No synopsis available.",
                score: attr.averageRating ? (parseFloat(attr.averageRating) / 10).toFixed(2) : "N/A",
                status: attr.status === 'current' ? 'RELEASING' : 'FINISHED',
                trailer: {
                    embed_url: attr.youtubeVideoId ? `https://www.youtube.com/embed/${attr.youtubeVideoId}` : null
                },
                images: {
                    webp: {
                        large_image_url: attr.posterImage ? attr.posterImage.large : ''
                    }
                },
                genres: [{name: 'Anime'}] // Simplified as Kitsu genre fetching is complex
            };
        });

        if (!append) loadingGrid.classList.add('hidden');
        renderAnimeCards(mediaList, append);

        // Pagination handling (simplified)
        if (json.meta && json.meta.count > (offset + 8)) {
             if (loadMoreContainer) loadMoreContainer.classList.remove('hidden');
             if (nextBtn) nextBtn.disabled = false;
        } else {
             if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
             if (nextBtn) nextBtn.disabled = true;
        }

    } catch (e) {
        throw e;
    }
}

// --- AniList Fallback for Main Grid ---
async function fetchTopAnimeFromAniList(page, append) {
    console.log("Using AniList fallback for page", page);
    const query = `
    query ($page: Int, $perPage: Int) {
      Page (page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
        }
        media (sort: TRENDING_DESC, type: ANIME, status: RELEASING) {
          id
          title {
            romaji
            english
          }
          description
          averageScore
          status
          trailer {
            id
            site
          }
          coverImage {
            extraLarge
          }
          genres
          idMal
        }
      }
    }
    `;

    const variables = {
        page: page,
        perPage: 8
    };

    try {
        const response = await fetchWithTimeout('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query, variables })
        }, 8000);

        if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
        const json = await response.json();
        if (json.errors) throw new Error(`AniList GraphQL error: ${json.errors[0]?.message}`);
        if (!json.data || !json.data.Page) throw new Error("AniList No Data");

        const mediaList = json.data.Page.media
            .filter(anime => anime && anime.coverImage && anime.coverImage.extraLarge) // Only include anime with images
            .map(anime => {
            let cleanDesc = anime.description || "No synopsis available.";
            cleanDesc = cleanDesc.replace(/<br>/g, '\n').replace(/<[^>]*>?/gm, '');

            return {
                mal_id: anime.idMal || anime.id, 
                title: anime.title.english || anime.title.romaji,
                synopsis: cleanDesc,
                score: anime.averageScore ? (anime.averageScore / 10).toFixed(2) : "N/A",
                status: anime.status, 
                trailer: {
                    embed_url: (anime.trailer && anime.trailer.site === 'youtube') 
                        ? `https://www.youtube.com/embed/${anime.trailer.id}` 
                        : null
                },
                images: {
                    webp: {
                        large_image_url: anime.coverImage.extraLarge
                    }
                },
                genres: (anime.genres || []).map(g => ({ name: g }))
            };
        });

        if (mediaList.length === 0) throw new Error("AniList returned no valid anime");

        if (!append) loadingGrid.classList.add('hidden');
        renderAnimeCards(mediaList, append);

        if (json.data.Page.pageInfo.hasNextPage) {
            if (loadMoreContainer) loadMoreContainer.classList.remove('hidden');
            if (nextBtn) nextBtn.disabled = false;
        } else {
            if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
            if (nextBtn) nextBtn.disabled = true;
        }
        
    } catch (e) {
        console.error("AniList Fallback Failed:", e);
        throw e;
    }
}

// --- Ultimate Fallback: Hardcoded Popular Anime ---
async function fetchTopAnimeFromHardcoded(page, append) {
    const hardcodedAnime = [
        { mal_id: 1, title: "Cowboy Bebop", score: "8.78", status: "FINISHED", synopsis: "Space cowboy adventures across the galaxy.", images: { webp: { large_image_url: "https://cdn.myanimelist.net/images/anime/6/73245.jpg" } }, genres: [{ name: "Action" }], trailer: { embed_url: null } },
        { mal_id: 5, title: "Mushishi", score: "8.64", status: "FINISHED", synopsis: "A man who investigates supernatural phenomena explores mysterious stories.", images: { webp: { large_image_url: "https://cdn.myanimelist.net/images/anime/10/18791.jpg" } }, genres: [{ name: "Supernatural" }], trailer: { embed_url: null } },
        { mal_id: 16498, title: "Attack on Titan", score: "8.53", status: "RELEASING", synopsis: "Humanity fights for survival against giant humanoid creatures.", images: { webp: { large_image_url: "https://cdn.myanimelist.net/images/anime/10/47347.jpg" } }, genres: [{ name: "Action" }], trailer: { embed_url: null } },
        { mal_id: 37521, title: "Jujutsu Kaisen", score: "8.62", status: "RELEASING", synopsis: "A high schooler swallows a cursed finger and enters the world of jujutsu sorcerers.", images: { webp: { large_image_url: "https://cdn.myanimelist.net/images/anime/5/86720.jpg" } }, genres: [{ name: "Action" }], trailer: { embed_url: null } },
        { mal_id: 11757, title: "Sword Art Online", score: "7.24", status: "FINISHED", synopsis: "Players are trapped in a virtual reality MMORPG and must escape.", images: { webp: { large_image_url: "https://cdn.myanimelist.net/images/anime/7/39791.jpg" } }, genres: [{ name: "Action" }], trailer: { embed_url: null } },
        { mal_id: 25, title: "Fullmetal Alchemist", score: "8.23", status: "FINISHED", synopsis: "Two brothers seek the Philosopher's Stone to restore their bodies.", images: { webp: { large_image_url: "https://cdn.myanimelist.net/images/anime/6/55341.jpg" } }, genres: [{ name: "Action" }], trailer: { embed_url: null } },
        { mal_id: 15335, title: "One Punch Man", score: "8.40", status: "RELEASING", synopsis: "A hero who defeats any enemy with a single punch searches for a worthy opponent.", images: { webp: { large_image_url: "https://cdn.myanimelist.net/images/anime/12/72841.jpg" } }, genres: [{ name: "Action" }], trailer: { embed_url: null } },
        { mal_id: 21, title: "One Piece", score: "8.57", status: "RELEASING", synopsis: "A pirate captain sails the seas in search of treasure and friendship.", images: { webp: { large_image_url: "https://cdn.myanimelist.net/images/anime/6/73245.jpg" } }, genres: [{ name: "Adventure" }], trailer: { embed_url: null } }
    ];

    const start = (page - 1) * 8;
    const end = Math.min(start + 8, hardcodedAnime.length);
    const pageAnime = hardcodedAnime.slice(start, end);

    // Guard against invalid pages
    if (!pageAnime || pageAnime.length === 0) {
        console.warn("[Hardcoded] No anime found for this page, returning empty");
        if (typeof renderAnimeCards === 'function') {
            renderAnimeCards([], append);
        }
        return; // Don't throw - gracefully degrade
    }

    console.log(`[Hardcoded] Serving ${pageAnime.length} anime from hardcoded list (page ${page})`);

    // Hide loading indicator
    if (!append && typeof loadingGrid !== 'undefined' && loadingGrid) {
        loadingGrid.classList.add('hidden');
    }

    // Render the anime cards
    if (typeof renderAnimeCards === 'function') {
        renderAnimeCards(pageAnime, append);
    } else {
        console.error("[Hardcoded] renderAnimeCards function not available!");
        return; // Gracefully fail without throwing
    }

    // Update pagination controls if available
    if (end < hardcodedAnime.length) {
        if (typeof loadMoreContainer !== 'undefined' && loadMoreContainer) {
            loadMoreContainer.classList.remove('hidden');
        }
        if (typeof nextBtn !== 'undefined' && nextBtn) {
            nextBtn.disabled = false;
        }
    } else {
        if (typeof loadMoreContainer !== 'undefined' && loadMoreContainer) {
            loadMoreContainer.classList.add('hidden');
        }
        if (typeof nextBtn !== 'undefined' && nextBtn) {
            nextBtn.disabled = true;
        }
    }

    // Success - don't throw any error
}
