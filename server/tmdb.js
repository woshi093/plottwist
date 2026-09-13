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

async function buildCatalogueFromTMDB(count = 150) {
  if (!TMDB_KEY) {
    throw new Error("TMDB_API_KEY is not set");
  }

  // Step 1: get enough popular, reasonably well-known titles. TMDB's
  // discover endpoint returns ~20 results per page, and a handful of those
  // get filtered out below (missing runtime or poster), so pull extra pages
  // until we have a comfortable buffer.
  const pagesNeeded = Math.max(1, Math.ceil((count * 1.4) / 20));
  const pageResults = await Promise.all(
    Array.from({ length: pagesNeeded }, (_, i) =>
      fetchJson(
        `${BASE}/discover/movie?sort_by=popularity.desc&vote_count.gte=200&include_adult=false&page=${i + 1}`
      ).catch(() => ({ results: [] }))
    )
  );
  const candidates = pageResults
    .flatMap((p) => p.results || [])
    .slice(0, Math.ceil(count * 1.4));
  if (candidates.length === 0) {
    throw new Error("TMDB discover returned no candidates");
  }

  // Step 2: TMDB's list endpoints don't include runtime, so fetch full
  // details per title (this is the standard way to get runtime + genre names).
  const detailed = await Promise.all(
    candidates.map((m) => fetchJson(`${BASE}/movie/${m.id}`).catch(() => null))
  );

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
