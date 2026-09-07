import React from "react";

export default function ResultsDashboard({ Filtered_Array, synced }) {
  const sorted = [...Filtered_Array].sort((a, b) => b.Current_Score - a.Current_Score);
  const topScore = sorted.find((m) => m.Movie_Status !== "EXCLUDED")?.Current_Score;

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="screen_title">Results</h1>
        <span className="badge_sync_status">
          <span className="dot" style={{ opacity: synced ? 1 : 0.3 }} /> {synced ? "Syncing..." : "Synced"}
        </span>
      </div>

      <div className="list_results_ranked">
        {sorted.map((m, i) => (
          <div
            key={m.id}
            className={
              "result_row" +
              (m.Movie_Status === "EXCLUDED" ? " excluded" : "") +
              (m.Movie_Status !== "EXCLUDED" && m.Current_Score === topScore ? " top" : "")
            }
          >
            <span>
              {i + 1}. {m.poster} {m.title}
            </span>
            <span className="lbl_result_score">
              {m.Movie_Status === "EXCLUDED" ? "Vetoed" : `Score: ${m.Current_Score}`}
            </span>
          </div>
        ))}
      </div>

      <p className="screen_subtitle" style={{ marginTop: "auto", textAlign: "center" }}>
        Synced across all devices
      </p>
    </div>
  );
}
