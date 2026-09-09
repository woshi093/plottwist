import React, { useState } from "react";
import { socket } from "../socket.js";

export default function JoinCreateRoom({ onJoined }) {
  const [mode, setMode] = useState(null); // "create" | "join"
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleCreate() {
    setLoading(true);
    setError("");
    socket.emit("create_room", { name }, (res) => {
      setLoading(false);
      if (res.success) {
        onJoined({
          Room_Code: res.Room_Code,
          userId: res.userId,
          isHost: true,
          Session_Active_Array: [],
        });
      }
    });
  }

  function handleJoin() {
    if (!/^\d{4}$/.test(code)) {
      setError("Enter a 4-digit code (1000-9999).");
      return;
    }
    setLoading(true);
    setError("");
    socket.emit("join_room", { Input_Code: code, name }, (res) => {
      setLoading(false);
      if (res.success) {
        onJoined({
          Room_Code: res.Room_Code,
          userId: res.userId,
          isHost: false,
          Session_Active_Array: [],
        });
      } else {
        setError(res.message); // "Invalid code, please try again"
      }
    });
  }

  return (
    <div className="screen" style={{ justifyContent: "center", gap: 18 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <p className="wordmark">PlotTwist</p>
        <p className="screen_subtitle" style={{ margin: "6px 0 0" }}>
          Pick something together, tonight.
        </p>
      </div>

      <input
        className="txt_name_input"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
      />

      {mode !== "join" && (
        <button
          className="btn btn_primary btn_create_room"
          onClick={() => (mode === "create" ? handleCreate() : setMode("create"))}
          disabled={loading}
        >
          {mode === "create" ? (loading ? "Creating..." : "Confirm - Create room") : "Create room"}
        </button>
      )}

      {mode !== "create" && (
        <>
          <button className="btn btn_secondary btn_join_room" onClick={() => setMode("join")}>
            Join room
          </button>
          {mode === "join" && (
            <>
              <input
                className="txt_room_code_input"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              <button className="btn btn_primary" onClick={handleJoin} disabled={loading}>
                {loading ? "Joining..." : "Join"}
              </button>
            </>
          )}
        </>
      )}

      {error && <p className="lbl_veto_error">{error}</p>}
      <p className="screen_subtitle" style={{ textAlign: "center", marginTop: 12 }}>
        Room codes are 4 digits (1000-9999) and checked for uniqueness.
      </p>
      <p className="screen_subtitle" style={{ textAlign: "center", fontSize: 10, opacity: 0.7 }}>
        Movie data provided by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </div>
  );
}
