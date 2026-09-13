import React, { useState } from "react";

export default function ResultsDashboard({ session, Filtered_Array, synced, tieInfo, onSwipeAgain, onLeave }) {
  const [showParty, setShowParty] = useState(false);

  // Sort by Current_Score first, Tiebreak_Score as the secondary key - the
  // same rule the server uses, so a title that's been through a revote is
  // ranked on that revote's result rather than the original tied score.
  const sorted = [...Filtered_Array].sort(
    (a, b) => b.Current_Score - a.Current_Score || b.Tiebreak_Score - a.Tiebreak_Score
  );

  const isGenuineTie = !!(tieInfo && tieInfo.tie && tieInfo.tiedMovieIds.length > 1);
  const coWinners = isGenuineTie ? sorted.filter((m) => tieInfo.tiedMovieIds.includes(m.id)) : [];
  const winner = !isGenuineTie ? sorted.find((m) => m.Movie_Status !== "EXCLUDED") : null;
  const rest = sorted.filter((m) =>
    isGenuineTie ? !tieInfo.tiedMovieIds.includes(m.id) : m.id !== winner?.id
  );
  const rankBadge = ["gold", "silver", "bronze"];

  let rank = isGenuineTie ? coWinners.length : winner ? 1 : 0;

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

      <h1 className="screen_title">{isGenuineTie ? "It's a tie!" : "Results"}</h1>
      {isGenuineTie && (
        <p className="screen_subtitle" style={{ marginTop: -8 }}>
          Even the tiebreak revote came out even - {coWinners.length} titles are sharing first place.
        </p>
      )}

      {isGenuineTie ? (
        <div className="tie_winners_row">
          {coWinners.map((m) => (
            <div
              key={m.id}
              className="winner_hero_card winner_hero_card_tied"
              style={{ background: m.posterUrl ? `url(${m.posterUrl}) center top/cover` : m.gradient }}
            >
              <div className="winner_hero_scrim">
                <span className="winner_hero_badge">&#129309; Tied</span>
                <p className="winner_hero_title">
                  {!m.posterUrl && m.poster ? m.poster + " " : ""}
                  {m.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        winner && (
          <div
            className="winner_hero_card"
            style={{
              background: winner.posterUrl
                ? `url(${winner.posterUrl}) center top/cover`
                : winner.gradient,
            }}
          >
            <div className="winner_hero_scrim">
              <span className="winner_hero_badge">&#127942; Winner</span>
              <p className="winner_hero_title">
                {!winner.posterUrl && winner.poster ? winner.poster + " " : ""}
                {winner.title}
              </p>
              <p className="winner_hero_meta">
                {winner.duration} min &middot; {winner.available_platforms.join(", ")}
              </p>
              <span className="winner_hero_score">Score: {winner.Current_Score}</span>
            </div>
          </div>
        )
      )}

      {rest.length > 0 && (
        <div className="list_results_ranked">
          {rest.map((m) => {
            const isExcluded = m.Movie_Status === "EXCLUDED";
            if (!isExcluded) rank += 1;
            const badgeClass = !isExcluded && rank <= 3 ? rankBadge[rank - 1] : "";
            return (
              <div
                key={m.id}
                className={"result_row" + (isExcluded ? " excluded" : "")}
              >
                <div className="result_title_row">
                  <span className={"result_rank_badge" + (badgeClass ? " " + badgeClass : "")}>
                    {isExcluded ? "—" : rank}
                  </span>
                  {m.posterUrl ? (
                    <span
                      className="result_thumb"
                      style={{ backgroundImage: `url(${m.posterUrl})` }}
                    />
                  ) : (
                    <span className="result_thumb result_thumb_emoji">{m.poster}</span>
                  )}
                  <span className="result_title_text">{m.title}</span>
                </div>
                <span className="lbl_result_score">
                  {isExcluded ? "Vetoed" : `Score: ${m.Current_Score}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

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
