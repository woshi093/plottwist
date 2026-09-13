// TMDB integration - builds Master_Catalogue from real movie data instead of
// the static seed list in catalogue.js. Falls back to the seed list (in
// server.js) if TMDB_API_KEY isn't set or the request fails, so the app
// never breaks because of this.
//
// Supports BOTH kinds of TMDB credential, auto-detected:
//   - "API Key (v3 auth)"          -> a short hex string, sent as ?api_key=
//   - "API Read Access Token (v4)" -> a long token starting with "eyJ",
//                                     sent as an Authorization: Bearer header

const TMDB_KEY = process.env.TMDB_API_KEY || "";
const IS_BEARER = TMDB_KEY.startsWith("eyJ");

const BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w780";
const PLATFORM_POOL = ["Netflix", "Disney+", "Prime Video"];

function withKey(url) {
  if (IS_BEARER) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}api_key=${TMDB_KEY}`;
}

function fetchOptions() {
  if (IS_BEARER) {
    return { headers: { Authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" } };
  }
  return {};
}

async function fetchJson(url) {
  const res = await fetch(withKey(url), fetchOptions());
  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status} ${res.statusText}) for ${url}`);
  }
  return res.json();
}

// Randomly assigns 1-2 platforms so the existing FilterCatalogue() logic
// keeps working unchanged - TMDB's real watch-provider data is region-locked
// and licensing-restricted, well beyond what a school project needs.
function randomPlatforms() {
  const shuffled = [...PLATFORM_POOL].sort(() => Math.random() - 0.5);
  const count = 1 + Math.floor(Math.random() * 2); // 1 or 2
  return shuffled.slice(0, count);
}

async function fetchDetailsInBatches(candidates, batchSize = 25) {
  const results = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((m) => fetchJson(`${BASE}/movie/${m.id}`).catch(() => null))
    );
    results.push(...batchResults);
  }
  return results;
}

async function buildCatalogueFromTMDB(count = 1000) {
  if (!TMDB_KEY) {
    throw new Error("TMDB_API_KEY is not set");
  }

  // Step 1: pull from a spread of genres (not just overall popularity) so a
  // large catalogue still has good variety - a pure "most popular" sort
  // skews heavily toward action/adventure blockbusters, which would starve
  // the genre filter in the room lobby of options like Horror or Documentary.
  const GENRE_IDS = {
    Action: 28, Adventure: 12, Animation: 16, Comedy: 35, Crime: 80,
    Documentary: 99, Drama: 18, Family: 10751, Fantasy: 14, Horror: 27,
    Mystery: 9648, Romance: 10749, "Science Fiction": 878, Thriller: 53,
  };
  const genreNames = Object.keys(GENRE_IDS);
  const pagesPerGenre = Math.max(1, Math.ceil((count / genreNames.length / 20) * 1.3));

  const pageResults = await Promise.all(
    genreNames.flatMap((name) =>
      Array.from({ length: pagesPerGenre }, (_, i) =>
        fetchJson(
          `${BASE}/discover/movie?sort_by=popularity.desc&vote_count.gte=200&include_adult=false&with_genres=${GENRE_IDS[name]}&page=${i + 1}`
        ).catch(() => ({ results: [] }))
      )
    )
  );

  // De-duplicate (many movies have multiple genres and will show up more than once).
  const seen = new Set();
  const candidates = [];
  for (const page of pageResults) {
    for (const m of page.results || []) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        candidates.push(m);
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error("TMDB discover returned no candidates");
  }

  // Step 2: TMDB's list endpoints don't include runtime, so fetch full
  // details per title - in small batches so we don't fire hundreds of
  // requests at TMDB simultaneously.
  const detailed = await fetchDetailsInBatches(candidates.slice(0, Math.ceil(count * 1.3)));

  const Master_Catalogue = detailed
    .filter((d) => d && d.runtime && d.poster_path)
    .slice(0, count)
    .map((d) => ({
      id: `tmdb-${d.id}`,
      title: d.title,
      duration: d.runtime,
      available_platforms: randomPlatforms(),
      genres: (d.genres || []).slice(0, 2).map((g) => g.name),
      description:
        d.overview && d.overview.length > 180
          ? d.overview.slice(0, 177) + "..."
          : d.overview || "",
      poster: "\uD83C\uDFAC", // fallback emoji, unused whenever posterUrl is present
      posterUrl: `${IMG_BASE}${d.poster_path}`,
      gradient: "linear-gradient(160deg, #241E3E, #4B3F82)",
    }));

  if (Master_Catalogue.length === 0) {
    throw new Error("TMDB returned no titles with both runtime and a poster");
  }
  return Master_Catalogue;
}

module.exports = { buildCatalogueFromTMDB };
