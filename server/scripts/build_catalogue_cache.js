// Run this locally, on your own laptop, whenever you want to (re)generate
// the movie catalogue: `npm run build:catalogue` from inside server/.
//
// It fetches once from TMDB using buildCatalogueFromTMDB() (same function
// server.js would otherwise call live) and saves the result as a plain JSON
// file, catalogue_tmdb_cache.json, sitting next to this script. Commit that
// file to your GitHub repo and the server will load it directly at startup
// instead of calling the TMDB API - instant, no waiting, and it still works
// even if TMDB is briefly down or your key ever stops working.
//
// Re-run this (and re-commit the JSON file) any time you want a fresher or
// different set of titles - it's not automatic, it's a deliberate refresh.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { buildCatalogueFromTMDB } = require("../tmdb");

async function main() {
  console.log("Fetching catalogue from TMDB - this can take a minute for a large count...");
  const catalogue = await buildCatalogueFromTMDB();
  const outPath = path.join(__dirname, "..", "catalogue_tmdb_cache.json");
  fs.writeFileSync(outPath, JSON.stringify(catalogue, null, 2));
  console.log(`Saved ${catalogue.length} titles to ${outPath}`);
  console.log("Next step: commit this file to your GitHub repo so the deployed server picks it up.");
}

main().catch((err) => {
  console.error("Failed to build catalogue cache:", err.message);
  console.error("Check that TMDB_API_KEY is set in server/.env before running this script.");
  process.exit(1);
});
