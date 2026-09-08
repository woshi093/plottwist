import React, { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";

const SWIPE_THRESHOLD_X = 100;
const VETO_THRESHOLD_Y = 90;
const EXIT_DURATION = 260;

export default function SwipeDeck({ session, Filtered_Array, synced, onFinished, onLeave }) {
  const active = Filtered_Array.filter((m) => m.Movie_Status !== "EXCLUDED");
  const [index, setIndex] = useState(0);
  const [showVetoModal, setShowVetoModal] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const [vetoError, setVetoError] = useState("");

  // Drag + animation state
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false });
  const [exitAnim, setExitAnim] = useState(null); // "left" | "right" | "down" | null
  const pointerStart = useRef(null);

  const current = active[index];

  function advanceIndex() {
    setVetoError("");
    if (index + 1 >= active.length) {
      socket.emit("user_finished", { Room_Code: session.Room_Code, userId: session.userId });
      onFinished();
    } else {
      setIndex(index + 1);
    }
  }

  // Plays the fly-off animation, THEN commits the actual swipe/veto logic
  // once the animation has finished, so the next card mounts fresh.
  function triggerExit(direction, User_Action) {
    if (exitAnim) return; // ignore repeat triggers mid-animation
    setExitAnim(direction);
    setTimeout(() => {
      if (User_Action) {
        // ProcessSwipe: RIGHT / LEFT
        socket.emit("user_swipe", {
          Room_Code: session.Room_Code,
          userId: session.userId,
          movieId: current.id,
          User_Action,
        });
      }
      setExitAnim(null);
      setDrag({ x: 0, y: 0, dragging: false });
      advanceIndex();
    }, EXIT_DURATION);
  }

  function handleSwipe(User_Action) {
    triggerExit(User_Action === "RIGHT" ? "right" : "left", User_Action);
  }

  // btn_veto - step 1 of the two-step veto (opens modal_veto_confirm)
  function tapVeto() {
    setDrag({ x: 0, y: 0, dragging: false });
    setShowVetoModal(true);
  }

  // btn_veto_confirm / btn_veto_cancel - step 2 of the two-step veto
  function resolveVeto(Confirmed) {
    setShowVetoModal(false);
    if (!Confirmed) return; // DISPLAY "Veto cancelled" - no state change

    socket.emit(
      "veto_confirm",
      { Room_Code: session.Room_Code, userId: session.userId, movieId: current.id, Confirmed: true },
      (res) => {
        if (res.status === "BLOCKED") {
          setVetoError(res.message); // lbl_veto_error
        } else if (res.status === "EXCLUDED") {
          triggerExit("down", null); // already applied server-side, just animate + advance
        }
      }
    );
  }

  // ---- Keyboard support: Left = Pass, Right = Like, Down = Veto ----
  useEffect(() => {
    function onKeyDown(e) {
      if (showVetoModal || showParty) return; // let overlays own the keyboard while open
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSwipe("LEFT");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSwipe("RIGHT");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        tapVeto();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, exitAnim, showVetoModal, showParty]);

  // Veto modal keyboard support: Escape = cancel, Enter = confirm
  useEffect(() => {
    if (!showVetoModal) return;
    function onModalKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        resolveVeto(false);
      } else if (e.key === "Enter") {
        e.preventDefault();
        resolveVeto(true);
      }
    }
    window.addEventListener("keydown", onModalKeyDown);
    return () => window.removeEventListener("keydown", onModalKeyDown);
  }, [showVetoModal]);

  // ---- Drag gesture handlers (mouse + touch, via the Pointer Events API) ----
  function onPointerDown(e) {
    if (exitAnim) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, dragging: true });
  }

  function onPointerMove(e) {
    if (!drag.dragging || !pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    setDrag({ x: dx, y: Math.max(0, dy) * 0.5, dragging: true });
  }

  function onPointerUp() {
    if (!drag.dragging) return;
    const { x, y } = drag;
    if (x > SWIPE_THRESHOLD_X) {
      triggerExit("right", "RIGHT");
    } else if (x < -SWIPE_THRESHOLD_X) {
      triggerExit("left", "LEFT");
    } else if (y > VETO_THRESHOLD_Y) {
      tapVeto();
    } else {
      setDrag({ x: 0, y: 0, dragging: false }); // spring back to center
    }
  }

  const partyCount = session.Session_Active_Array.length;

  const topBar = (
    <div className="top_bar">
      <div className="top_bar_left">
        <button className="btn_view_party" onClick={() => setShowParty(true)}>
          View party <span className="party_count">{partyCount}</span>
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

  if (!current) {
    return (
      <div className="screen">
        {topBar}
        <h1 className="screen_title">Swipe deck</h1>
        <p className="screen_subtitle">No titles match the current filters.</p>
        {partyPopover}
      </div>
    );
  }

  const likeOpacity = Math.max(0, Math.min(drag.x / SWIPE_THRESHOLD_X, 1));
  const passOpacity = Math.max(0, Math.min(-drag.x / SWIPE_THRESHOLD_X, 1));
  const vetoOpacity = Math.max(0, Math.min(drag.y / VETO_THRESHOLD_Y, 1));

  const cardStyle = exitAnim
    ? {} // let the CSS class own the transform when exiting
    : {
        transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`,
        transition: drag.dragging ? "none" : "transform 200ms ease",
        background: current.posterUrl ? `url(${current.posterUrl}) center/cover` : undefined,
      };

  const cardClassName =
    "card_movie" +
    (exitAnim ? ` card_exit_${exitAnim}` : "") +
    (drag.dragging ? " card_dragging" : "");

  return (
    <div className="screen">
      {topBar}

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
          <span className="card_stamp card_stamp_veto" style={{ opacity: vetoOpacity }}>VETO</span>

          <div className="card_movie_scrim">
            <p className="lbl_movie_title">{current.title}</p>
            <p className="card_movie_meta">
              {current.duration} min &middot; {current.available_platforms.join(", ")}
            </p>
            {current.description && (
              <p className="card_movie_description">{current.description}</p>
            )}
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

      {vetoError && <p className="lbl_veto_error">{vetoError}</p>}

      <div className="swipe_actions">
        <button className="btn_circle btn_swipe_pass" onClick={() => handleSwipe("LEFT")} aria-label="Pass">
          &#10005;
        </button>
        <button className="btn_circle btn_veto" onClick={tapVeto} aria-label="Veto">
          &#9873;
        </button>
        <button className="btn_circle btn_swipe_like" onClick={() => handleSwipe("RIGHT")} aria-label="Like">
          &#9829;
        </button>
      </div>

      <p className="screen_subtitle" style={{ textAlign: "center" }}>
        {index + 1} of {active.length} &middot; drag, tap, or press &larr; / &rarr; / &darr;
      </p>

      {showVetoModal && (
        <div className="modal_veto_confirm_backdrop">
          <div className="modal_veto_confirm">
            <h3>Veto this title?</h3>
            <p>
              This uses your one veto for the session. {current.title} will be removed for everyone.
            </p>
            <div className="modal_veto_confirm_actions">
              <button className="btn btn_veto_cancel" onClick={() => resolveVeto(false)}>
                Cancel
              </button>
              <button className="btn btn_veto_confirm" onClick={() => resolveVeto(true)}>
                Confirm veto
              </button>
            </div>
          </div>
        </div>
      )}

      {partyPopover}
    </div>
  );
}
