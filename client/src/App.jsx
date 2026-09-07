import React, { useEffect, useState } from "react";
import { socket } from "./socket.js";
import JoinCreateRoom from "./screens/JoinCreateRoom.jsx";
import RoomLobby from "./screens/RoomLobby.jsx";
import SwipeDeck from "./screens/SwipeDeck.jsx";
import ResultsDashboard from "./screens/ResultsDashboard.jsx";

// Screens follow the Final Master Site Map (hybrid):
// join_create -> lobby -> swipe -> results
export default function App() {
  const [screen, setScreen] = useState("join_create");
  const [session, setSession] = useState({
    Room_Code: null,
    userId: null,
    isHost: false,
    Session_Active_Array: [],
  });
  const [Filtered_Array, setFilteredArray] = useState([]);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    function onCatalogueReady(data) {
      setFilteredArray(data);
      setScreen("swipe");
    }
    function onScoreUpdate(updatedMovie) {
      setFilteredArray((prev) =>
        prev.map((m) => (m.id === updatedMovie.id ? { ...m, ...updatedMovie } : m))
      );
      pulseSync();
    }
    function onVetoApplied(updatedMovie) {
      setFilteredArray((prev) =>
        prev.map((m) => (m.id === updatedMovie.id ? { ...m, ...updatedMovie } : m))
      );
      pulseSync();
    }
    function onLobbyUpdate(roomState) {
      setSession((prev) => ({ ...prev, Session_Active_Array: roomState.Session_Active_Array }));
      pulseSync();
    }
    function pulseSync() {
      setSynced(true);
      setTimeout(() => setSynced(false), 900);
    }

    socket.on("CATALOGUE_READY", onCatalogueReady);
    socket.on("SCORE_UPDATE", onScoreUpdate);
    socket.on("VETO_APPLIED", onVetoApplied);
    socket.on("LOBBY_UPDATE", onLobbyUpdate);
    return () => {
      socket.off("CATALOGUE_READY", onCatalogueReady);
      socket.off("SCORE_UPDATE", onScoreUpdate);
      socket.off("VETO_APPLIED", onVetoApplied);
      socket.off("LOBBY_UPDATE", onLobbyUpdate);
    };
  }, []);

  return (
    <div className="app_shell">
      {screen === "join_create" && (
        <JoinCreateRoom
          onJoined={(s) => {
            setSession(s);
            setScreen("lobby");
          }}
        />
      )}
      {screen === "lobby" && (
        <RoomLobby
          session={session}
          synced={synced}
          onFiltersSet={() => {
            /* CATALOGUE_READY event advances the screen */
          }}
        />
      )}
      {screen === "swipe" && (
        <SwipeDeck
          session={session}
          Filtered_Array={Filtered_Array}
          synced={synced}
          onFinished={() => setScreen("results")}
        />
      )}
      {screen === "results" && (
        <ResultsDashboard Filtered_Array={Filtered_Array} synced={synced} />
      )}
    </div>
  );
}
