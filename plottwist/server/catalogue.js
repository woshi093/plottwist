// Master_Catalogue - the full, unfiltered set of titles available to PlotTwist.
// Each Movie_Object matches the fields referenced throughout the Task 2 / Task 5 spec:
//   duration              -> used by FilterCatalogue()
//   available_platforms   -> used by FilterCatalogue()
//   Current_Score / Movie_Score -> used by ProcessSwipe()
//   Movie_Status          -> set to "EXCLUDED" by the veto logic
//
// `poster` and `gradient` are a placeholder "poster" until real artwork is wired
// up (see README - TMDB integration). `posterUrl` is left null on purpose: the
// card component prefers posterUrl when present and falls back to the emoji +
// gradient placeholder otherwise, so swapping in real TMDB images later is a
// drop-in change with no UI rework needed.

const Master_Catalogue = [
  {
    id: "m1", title: "Nebula Drift", duration: 118,
    available_platforms: ["Netflix", "Disney+"],
    genres: ["Sci-Fi", "Adventure"],
    description: "A salvage crew stumbles on a derelict ship carrying a signal that shouldn't exist.",
    poster: "🚀", posterUrl: null, gradient: "linear-gradient(160deg, #2A1B5E, #6E3AC9)",
  },
  {
    id: "m2", title: "The Last Bakery", duration: 102,
    available_platforms: ["Netflix"],
    genres: ["Comedy", "Drama"],
    description: "The only bakery left in a fading seaside town fights to survive one summer.",
    poster: "🥐", posterUrl: null, gradient: "linear-gradient(160deg, #7A3B1E, #D98A3D)",
  },
  {
    id: "m3", title: "Iron Coastline", duration: 145,
    available_platforms: ["Prime Video"],
    genres: ["Thriller", "Crime"],
    description: "A detective returns to her hometown to investigate a case that mirrors her own past.",
    poster: "🌊", posterUrl: null, gradient: "linear-gradient(160deg, #0B3B4A, #1C7A8C)",
  },
  {
    id: "m4", title: "Quiet Static", duration: 96,
    available_platforms: ["Disney+", "Prime Video"],
    genres: ["Mystery", "Drama"],
    description: "A late-night radio host starts receiving calls from a station that went dark years ago.",
    poster: "📻", posterUrl: null, gradient: "linear-gradient(160deg, #241E3E, #4B3F82)",
  },
  {
    id: "m5", title: "Paper Lanterns", duration: 110,
    available_platforms: ["Netflix", "Prime Video"],
    genres: ["Romance", "Drama"],
    description: "Two rival festival organisers are forced to plan the same event from opposite ends of town.",
    poster: "🏮", posterUrl: null, gradient: "linear-gradient(160deg, #7A1E3B, #D9497A)",
  },
  {
    id: "m6", title: "Midnight Cartography", duration: 132,
    available_platforms: ["Netflix"],
    genres: ["Fantasy", "Adventure"],
    description: "A cartographer discovers her maps redraw themselves to lead her somewhere new each night.",
    poster: "🗺️", posterUrl: null, gradient: "linear-gradient(160deg, #142B4A, #2E6BB3)",
  },
  {
    id: "m7", title: "The Understudy", duration: 88,
    available_platforms: ["Disney+"],
    genres: ["Comedy"],
    description: "A perpetually second-choice actor gets one night to finally take the lead.",
    poster: "🎭", posterUrl: null, gradient: "linear-gradient(160deg, #4A1E4A, #A94AA9)",
  },
  {
    id: "m8", title: "Glasshouse Season", duration: 121,
    available_platforms: ["Prime Video", "Disney+"],
    genres: ["Drama"],
    description: "Three estranged siblings inherit their grandmother's botanical garden - and its secrets.",
    poster: "🌿", posterUrl: null, gradient: "linear-gradient(160deg, #123B22, #3F9457)",
  },
];

module.exports = { Master_Catalogue };
