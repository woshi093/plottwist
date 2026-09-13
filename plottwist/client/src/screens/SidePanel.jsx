import React from "react";

// Desktop-only companion panel. On a wide screen there's room to keep the
// party roster and a live scoreboard visible at all times, instead of
// hiding them behind the "View party" popover the phone layout needs.
export default function SidePanel({ session, Filtered_Array, screen, synced }) {
  const sorted = [...Filtered_Array].sort((a, b) => b.Current_Score - a.Current_Score);
  const showScoreboard = screen === "swipe" || screen === "results";

  return (
    <aside className="side_panel">
      <div className="side_panel_header">
        <span className="side_panel_title">Room {session.Room_Code}</span>
        <span className="badge_sync_status">
          <span className="dot" style={{ opacity: synced ? 1 : 0.3 }} /> {synced ? "Syncing" : "Synced"}
        </span>
      </div>

      <div className="side_panel_section">
        <p className="side_panel_label">Party ({session.Session_Active_Array.length})</p>
        <div className="lobby_user_list">
          {session.Session_Active_Array.map((u) => (
            <div className="lobby_user_row" key={u.userId}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="party_member_dot"
                  style={{ background: u.connected === false ? "var(--text-faint)" : "var(--like)" }}
                />
                {u.name}
                {u.userId === session.userId && (
                  <span className="party_member_you">you</span>
                )}
              </span>
              {u.User_Veto_Button && <span className="side_panel_veto_used">veto used</span>}
            </div>
          ))}
        </div>
      </div>

      {showScoreboard && (
        <div className="side_panel_section side_panel_scoreboard">
          <p className="side_panel_label">Live scoreboard</p>
          <div className="side_panel_scoreboard_list">
            {sorted.map((m) => (
              <div
                key={m.id}
                className={"side_panel_score_row" + (m.Movie_Status === "EXCLUDED" ? " excluded" : "")}
              >
                <span className="side_panel_score_title">
                  {m.poster ? m.poster + " " : ""}
                  {m.title}
                </span>
                <span className="side_panel_score_value">
                  {m.Movie_Status === "EXCLUDED" ? "Vetoed" : m.Current_Score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {screen === "lobby" && (
        <p className="screen_subtitle" style={{ marginTop: "auto" }}>
          Scores will appear here live once swiping starts.
        </p>
      )}
    </aside>
  );
}
