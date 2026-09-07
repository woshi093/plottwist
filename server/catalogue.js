// Master_Catalogue - the full, unfiltered set of titles available to PlotTwist.
// Each Movie_Object matches the fields referenced throughout the Task 2 / Task 5 spec:
//   duration              -> used by FilterCatalogue()
//   available_platforms   -> used by FilterCatalogue()
//   Current_Score / Movie_Score -> used by ProcessSwipe()
//   Movie_Status          -> set to "EXCLUDED" by the veto logic

const Master_Catalogue = [
  { id: "m1", title: "Nebula Drift", duration: 118, available_platforms: ["Netflix", "Disney+"], poster: "🚀" },
  { id: "m2", title: "The Last Bakery", duration: 102, available_platforms: ["Netflix"], poster: "🥐" },
  { id: "m3", title: "Iron Coastline", duration: 145, available_platforms: ["Prime Video"], poster: "🌊" },
  { id: "m4", title: "Quiet Static", duration: 96, available_platforms: ["Disney+", "Prime Video"], poster: "📻" },
  { id: "m5", title: "Paper Lanterns", duration: 110, available_platforms: ["Netflix", "Prime Video"], poster: "🏮" },
  { id: "m6", title: "Midnight Cartography", duration: 132, available_platforms: ["Netflix"], poster: "🗺️" },
  { id: "m7", title: "The Understudy", duration: 88, available_platforms: ["Disney+"], poster: "🎭" },
  { id: "m8", title: "Glasshouse Season", duration: 121, available_platforms: ["Prime Video", "Disney+"], poster: "🌿" },
];

module.exports = { Master_Catalogue };
