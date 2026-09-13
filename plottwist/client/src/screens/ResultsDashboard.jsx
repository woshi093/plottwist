import React, { useState } from "react";

export default function ResultsDashboard({ session, Filtered_Array, synced, onSwipeAgain, onLeave }) {
  const [showParty, setShowParty] = useState(false);
  const sorted = [...Filtered_Array].sort((a, b) => b.Current_Score - a.Current_Score);
  const topScore = sorted.find((m) => m.Movie_Status !== "EXCLUDED")?.Current_Score;
  const rankBadge = ["gold", "silver", "bronze"];

  let rank = 0;

  return (
    <div className="screen">
      <div className="top_bar">
        <div className="top_bar_left">
          <button className="btn_view_party" onClick={() => setShowParty(true)}>
            View party <span className="party_count">{session.Session_Active_Array.length}</span>
          </button>
          <span className="badge_sync_status">
            <span className="dot" style={{ opacity: synced ? 1 : 0.3 }} /> {synced ? "Syncing" : "Synced"}
          </span>
        </div>
        <button className="btn_leave_room" onClick={onLeave}>Leave</button>
      </div>

      <h1 className="screen_title">Results</h1>

      <div className="list_results_ranked">
        {sorted.map((m) => {
          const isExcluded = m.Movie_Status === "EXCLUDED";
          if (!isExcluded) rank += 1;
          const badgeClass = !isExcluded && rank <= 3 ? rankBadge[rank - 1] : "";
          return (
            <div
              key={m.id}
              className={
                "result_row" +
                (isExcluded ? " excluded" : "") +
                (!isExcluded && m.Current_Score === topScore ? " top" : "")
              }
            >
              <div className="result_title_row">
                <span className={"result_rank_badge" + (badgeClass ? " " + badgeClass : "")}>
                  {isExcluded ? "—" : rank}
                </span>
                <span>{m.poster} {m.title}</span>
              </div>
              <span className="lbl_result_score">
                {isExcluded ? "Vetoed" : `Score: ${m.Current_Score}`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="screen_subtitle" style={{ textAlign: "center" }}>
        Synced across all devices
      </p>

      <div className="results_actions">
        <button className="btn btn_primary" onClick={onSwipeAgain}>
          Swipe again
        </button>
        <button className="btn btn_secondary" onClick={onLeave}>
          Back to home
        </button>
      </div>

      {showParty && (
        <div className="party_popover_backdrop" onClick={() => setShowParty(false)}>
          <div className="party_popover" onClick={(e) => e.stopPropagation()}>
            <h4>Who's in this room</h4>
            {session.Session_Active_Array.map((u) => (
              <div className="party_member_row" key={u.userId}>
                <span className="party_member_dot" />
                <span>{u.name}</span>
                {u.userId === session.userId && <span className="party_member_you">you</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
