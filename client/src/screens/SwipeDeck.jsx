import React, { useState } from "react";
import { socket } from "../socket.js";

export default function SwipeDeck({ session, Filtered_Array, synced, onFinished }) {
  const active = Filtered_Array.filter((m) => m.Movie_Status !== "EXCLUDED");
  const [index, setIndex] = useState(0);
  const [showVetoModal, setShowVetoModal] = useState(false);
  const [vetoError, setVetoError] = useState("");

  const current = active[index];

  function advance() {
    setVetoError("");
    if (index + 1 >= active.length) {
      socket.emit("user_finished", { Room_Code: session.Room_Code, userId: session.userId });
      onFinished();
    } else {
      setIndex(index + 1);
    }
  }

  function handleSwipe(User_Action) {
    // ProcessSwipe: RIGHT / LEFT
    socket.emit("user_swipe", {
      Room_Code: session.Room_Code,
      movieId: current.id,
      User_Action,
    });
    advance();
  }

  // btn_veto - step 1 of the two-step veto (opens modal_veto_confirm)
  function tapVeto() {
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
          advance();
        }
      }
    );
  }

  if (!current) {
    return (
      <div className="screen">
        <h1 className="screen_title">Swipe deck</h1>
        <p className="screen_subtitle">No titles match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="screen_title">Swipe deck</h1>
        <span className="badge_sync_status">
          <span className="dot" style={{ opacity: synced ? 1 : 0.3 }} /> {synced ? "Syncing..." : "Synced"}
        </span>
      </div>

      <div className="card_movie">
        <div className="card_movie_poster">{current.poster}</div>
        <p className="lbl_movie_title">{current.title}</p>
        <p className="card_movie_meta">{current.duration} min &middot; {current.available_platforms.join(", ")}</p>
      </div>

      {vetoError && <p className="lbl_veto_error">{vetoError}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn_swipe_pass" onClick={() => handleSwipe("LEFT")}>
          &larr; Pass
        </button>
        <button className="btn btn_veto" onClick={tapVeto}>
          Veto
        </button>
        <button className="btn btn_swipe_like" onClick={() => handleSwipe("RIGHT")}>
          Like &rarr;
        </button>
      </div>

      <p className="screen_subtitle" style={{ textAlign: "center" }}>
        {index + 1} of {active.length}
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
    </div>
  );
}
