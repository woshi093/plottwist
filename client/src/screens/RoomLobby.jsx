import React, { useState } from "react";
import { socket } from "../socket.js";

const ALL_PLATFORMS = ["Netflix", "Disney+", "Prime Video"];
const ALL_GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
  "Drama", "Family", "Fantasy", "Horror", "Mystery", "Romance",
  "Science Fiction", "Thriller",
];

export default function RoomLobby({ session, synced, onLeave }) {
  const [maxDuration, setMaxDuration] = useState(150);
  const [platforms, setPlatforms] = useState([...ALL_PLATFORMS]);
  const [genres, setGenres] = useState([]);
  const [cardCount, setCardCount] = useState(12);
  const [starting, setStarting] = useState(false);

  function togglePlatform(p) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function toggleGenre(g) {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  function handleStart() {
    setStarting(true);
    socket.emit("host_set_filters", {
      Room_Code: session.Room_Code,
      Max_Duration: maxDuration,
      Platform_List: platforms,
      Genre_List: genres,
      Card_Count: cardCount,
    });
  }

  return (
    <div className="screen">
      <div className="top_bar">
        <span className="badge_sync_status">
          <span className="dot" style={{ opacity: synced ? 1 : 0.3 }} /> {synced ? "Syncing..." : "Synced"}
        </span>
        <button className="btn_leave_room" onClick={onLeave}>Leave room</button>
      </div>

      <h1 className="screen_title">Room lobby</h1>

      <p className="screen_subtitle" style={{ marginBottom: -4 }}>Room code</p>
      <p className="lbl_room_code">{session.Room_Code}</p>

      <div className="lobby_user_list">
        {session.Session_Active_Array.map((u) => (
          <div className="lobby_user_row" key={u.userId}>
            <span>{u.name}</span>
            <span style={{ color: "var(--text-faint)", fontSize: 12 }}>
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

          <p className="screen_subtitle" style={{ marginBottom: -2 }}>Platforms</p>
          <div className="filter_chip_row">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                className={"filter_chip chk_filter_platform" + (platforms.includes(p) ? " active" : "")}
                onClick={() => togglePlatform(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <p className="screen_subtitle" style={{ marginBottom: -2 }}>
            Genres <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(leave blank for any)</span>
          </p>
          <div className="filter_chip_row">
            {ALL_GENRES.map((g) => (
              <button
                key={g}
                type="button"
                className={"filter_chip chk_filter_genre" + (genres.includes(g) ? " active" : "")}
                onClick={() => toggleGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>

          <label className="screen_subtitle" htmlFor="sld_filter_count">
            Cards to swipe: {cardCount}
          </label>
          <input
            id="sld_filter_count"
            className="sld_filter_duration"
            type="range"
            min={5}
            max={40}
            step={1}
            value={cardCount}
            onChange={(e) => setCardCount(Number(e.target.value))}
          />

          <button
            className="btn btn_primary"
            style={{ marginTop: 8 }}
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
