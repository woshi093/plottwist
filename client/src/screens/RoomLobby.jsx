import React, { useState } from "react";
import { socket } from "../socket.js";

const ALL_PLATFORMS = ["Netflix", "Disney+", "Prime Video"];

export default function RoomLobby({ session, synced }) {
  const [maxDuration, setMaxDuration] = useState(150);
  const [platforms, setPlatforms] = useState([...ALL_PLATFORMS]);
  const [starting, setStarting] = useState(false);

  function togglePlatform(p) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function handleStart() {
    setStarting(true);
    socket.emit("host_set_filters", {
      Room_Code: session.Room_Code,
      Max_Duration: maxDuration,
      Platform_List: platforms,
    });
  }

  return (
    <div className="screen">
      <h1 className="screen_title">Room lobby</h1>
      <span className="badge_sync_status">
        <span className="dot" style={{ opacity: synced ? 1 : 0.3 }} /> {synced ? "Syncing..." : "Synced"}
      </span>

      <p className="screen_subtitle">Room code</p>
      <p className="lbl_room_code">{session.Room_Code}</p>

      <div className="lobby_user_list">
        {session.Session_Active_Array.map((u) => (
          <div className="lobby_user_row" key={u.userId}>
            <span>{u.name}</span>
            <span style={{ color: "var(--text-secondary)" }}>
              {u.userId === session.userId ? "(you)" : ""}
            </span>
          </div>
        ))}
      </div>

      {session.isHost ? (
        <>
          <label className="screen_subtitle" htmlFor="sld_filter_duration">
            Max duration: {maxDuration} min
          </label>
          <input
            id="sld_filter_duration"
            className="sld_filter_duration"
            type="range"
            min={60}
            max={180}
            step={5}
            value={maxDuration}
            onChange={(e) => setMaxDuration(Number(e.target.value))}
          />

          <p className="screen_subtitle">Platforms</p>
          {ALL_PLATFORMS.map((p) => (
            <label className="chk_filter_platform_row" key={p}>
              <input
                type="checkbox"
                className="chk_filter_platform"
                checked={platforms.includes(p)}
                onChange={() => togglePlatform(p)}
              />
              {p}
            </label>
          ))}

          <button
            className="btn btn_primary"
            onClick={handleStart}
            disabled={starting || platforms.length === 0}
          >
            {starting ? "Starting..." : "Start swiping"}
          </button>
          {platforms.length === 0 && (
            <p className="lbl_veto_error">Select at least one platform.</p>
          )}
        </>
      ) : (
        <p className="screen_subtitle">Waiting for the host to set filters and start the session...</p>
      )}
    </div>
  );
}
