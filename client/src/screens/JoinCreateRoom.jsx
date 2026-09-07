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
    <div className="screen">
      <h1 className="screen_title">PlotTwist</h1>
      <p className="screen_subtitle">Cooperative group media consensus</p>

      <input
        className="txt_name_input"
        style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }}
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
      />

      {mode !== "join" && (
        <button className="btn btn_primary btn_create_room" onClick={() => (mode === "create" ? handleCreate() : setMode("create"))} disabled={loading}>
          {mode === "create" ? (loading ? "Creating..." : "Confirm - Create room") : "Create room"}
        </button>
      )}

      {mode !== "create" && (
        <>
          <button className="btn btn_join_room" onClick={() => setMode("join")}>
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
      <p className="screen_subtitle" style={{ marginTop: "auto" }}>
        Room codes are 4 digits (1000-9999) and checked for uniqueness.
      </p>
    </div>
  );
}
