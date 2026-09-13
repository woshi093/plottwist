import React, { useState } from "react";
import { socket } from "../socket.js";

const SWIPE_THRESHOLD_X = 100;
const EXIT_DURATION = 260;

// A short, focused revote between only the tied titles. Deliberately
// simpler than SwipeDeck: no veto (these titles already survived that
// stage), and a fixed set that never shrinks mid-round - so a plain
// numeric index is safe here, unlike the main deck.
export default function TiebreakDeck({ session, tiedMovies, synced, onLeave }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false });
  const [exitAnim, setExitAnim] = useState(null);
  const [showParty, setShowParty] = useState(false);
  const [myFinished, setMyFinished] = useState(false);
  const pointerStart = React.useRef(null);

  const current = tiedMovies[index];

  function triggerExit(direction, User_Action) {
    if (exitAnim) return;
    setExitAnim(direction);
    setTimeout(() => {
      socket.emit("user_swipe", {
        Room_Code: session.Room_Code,
        userId: session.userId,
        movieId: current.id,
        User_Action,
      });
      setExitAnim(null);
      setDrag({ x: 0, y: 0, dragging: false });
      if (index + 1 >= tiedMovies.length) {
        socket.emit("user_finished", { Room_Code: session.Room_Code, userId: session.userId });
        setMyFinished(true);
      } else {
        setIndex(index + 1);
      }
    }, EXIT_DURATION);
  }

  function onPointerDown(e) {
    if (exitAnim) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, dragging: true });
  }
  function onPointerMove(e) {
    if (!drag.dragging || !pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    setDrag({ x: dx, y: 0, dragging: true });
  }
  function onPointerUp() {
    if (!drag.dragging) return;
    if (drag.x > SWIPE_THRESHOLD_X) triggerExit("right", "RIGHT");
    else if (drag.x < -SWIPE_THRESHOLD_X) triggerExit("left", "LEFT");
    else setDrag({ x: 0, y: 0, dragging: false });
  }

  const topBar = (
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
  );

  const partyPopover = showParty && (
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
  );

  if (myFinished || !current) {
    return (
      <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
        {topBar}
        <span className="tiebreak_badge">Tiebreaker</span>
        <h1 className="screen_title" style={{ textAlign: "center" }}>Waiting on the rest of the group&hellip;</h1>
        <p className="screen_subtitle" style={{ textAlign: "center" }}>
          Everyone tied, so it came down to a quick revote. Results will update the moment
          everyone's picked.
        </p>
        {partyPopover}
      </div>
    );
  }

  const likeOpacity = Math.max(0, Math.min(drag.x / SWIPE_THRESHOLD_X, 1));
  const passOpacity = Math.max(0, Math.min(-drag.x / SWIPE_THRESHOLD_X, 1));

  const cardStyle = exitAnim
    ? {}
    : {
        transform: `translate(${drag.x}px, 0px) rotate(${drag.x / 18}deg)`,
        transition: drag.dragging ? "none" : "transform 200ms ease",
        background: current.posterUrl ? `url(${current.posterUrl}) center top/cover` : undefined,
      };
  const cardClassName =
    "card_movie" + (exitAnim ? ` card_exit_${exitAnim}` : "") + (drag.dragging ? " card_dragging" : "");

  return (
    <div className="screen">
      {topBar}
      <span className="tiebreak_badge">Tiebreaker &middot; {index + 1} of {tiedMovies.length}</span>
      <p className="screen_subtitle" style={{ marginTop: -6 }}>
        It's a tie so far - pick your favourite of the tied titles.
      </p>

      <div className="card_movie_stage">
        <div
          key={current.id}
          className={cardClassName}
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!current.posterUrl && (
            <div className="card_movie_art" style={{ background: current.gradient }}>
              {current.poster}
            </div>
          )}
          <span className="card_stamp card_stamp_like" style={{ opacity: likeOpacity }}>LIKE</span>
          <span className="card_stamp card_stamp_pass" style={{ opacity: passOpacity }}>PASS</span>
          <div className="card_movie_scrim">
            <p className="lbl_movie_title">{current.title}</p>
            <p className="card_movie_meta">
              {current.duration} min &middot; {current.available_platforms.join(", ")}
            </p>
            {current.genres && current.genres.length > 0 && (
              <div className="card_genre_row">
                {current.genres.map((g) => (
                  <span className="card_genre_tag" key={g}>{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="swipe_actions">
        <button className="btn_circle btn_swipe_pass" onClick={() => triggerExit("left", "LEFT")} aria-label="Not this one">&#10005;</button>
        <button className="btn_circle btn_swipe_like" onClick={() => triggerExit("right", "RIGHT")} aria-label="Prefer this one">&#9829;</button>
      </div>

      {partyPopover}
    </div>
  );
}
