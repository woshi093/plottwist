import React, { useEffect, useState } from "react";
import { socket } from "./socket.js";
import JoinCreateRoom from "./screens/JoinCreateRoom.jsx";
import RoomLobby from "./screens/RoomLobby.jsx";
import SwipeDeck from "./screens/SwipeDeck.jsx";
import ResultsDashboard from "./screens/ResultsDashboard.jsx";
import SidePanel from "./screens/SidePanel.jsx";
import { useIsDesktop } from "./useIsDesktop.js";
import { useServerWaking } from "./useServerWaking.js";
import { getPersistentUserId, saveLastRoom, getLastRoom, clearLastRoom } from "./identity.js";

const EMPTY_SESSION = {
  Room_Code: null,
  userId: null,
  isHost: false,
  Session_Active_Array: [],
};

// Screens follow the Final Master Site Map (hybrid):
// join_create -> lobby -> swipe -> results
export default function App() {
  const [screen, setScreen] = useState("reconnecting"); // starts here; falls back to join_create if there's nothing to rejoin
  const [session, setSession] = useState(EMPTY_SESSION);
  const [Filtered_Array, setFilteredArray] = useState([]);
  const [synced, setSynced] = useState(false);
  const [myVotedIds, setMyVotedIds] = useState([]);
  const isDesktop = useIsDesktop();
  const waking = useServerWaking();

  // ---- Attempt a silent rejoin on load (refresh / brief disconnect) ----
  useEffect(() => {
    const lastRoom = getLastRoom();
    if (!lastRoom) {
      setScreen("join_create");
      return;
    }
    const userId = getPersistentUserId();

    function attemptRejoin() {
      socket.emit("rejoin_room", { Room_Code: lastRoom, userId }, (res) => {
        if (res && res.success) {
          setSession({
            Room_Code: res.Room_Code,
            userId: res.userId,
            isHost: res.isHost,
            Session_Active_Array: [],
          });
          setFilteredArray(res.Filtered_Array || []);
          setMyVotedIds(Object.keys(res.Voted_Movies || {}));
          if (!res.Filtered_Array || res.Filtered_Array.length === 0) {
            setScreen("lobby");
          } else if (res.completion_status === "FINISHED") {
            setScreen("results");
          } else {
            setScreen("swipe");
          }
        } else {
          clearLastRoom();
          setScreen("join_create");
        }
      });
    }

    if (socket.connected) {
      attemptRejoin();
    } else {
      socket.once("connect", attemptRejoin);
      return () => socket.off("connect", attemptRejoin);
    }
  }, []);

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

  function handleLeave() {
    if (session.Room_Code) {
      socket.emit("leave_room", { Room_Code: session.Room_Code });
    }
    clearLastRoom();
    setSession(EMPTY_SESSION);
    setFilteredArray([]);
    setMyVotedIds([]);
    setScreen("join_create");
  }

  function handleSwipeAgain() {
    setScreen("swipe"); // SwipeDeck remounts, its local index resets to 0
  }

  return (
    <div className="viewport">
      <div className="app_shell">
        {screen === "reconnecting" && (
          <div className="screen" style={{ justifyContent: "center", alignItems: "center" }}>
            <p className="wordmark">PlotTwist</p>
            <p className="screen_subtitle">Reconnecting...</p>
            {waking && (
              <div className="banner_waking">
                <span className="banner_waking_dot" />
                Waking up the server - this can take up to a minute if no one's
                used PlotTwist in a while.
              </div>
            )}
          </div>
        )}
        {screen === "join_create" && (
          <JoinCreateRoom
            onJoined={(s) => {
              setSession(s);
              saveLastRoom(s.Room_Code);
              setScreen("lobby");
            }}
          />
        )}
        {screen === "lobby" && (
          <RoomLobby
            session={session}
            synced={synced}
            onLeave={handleLeave}
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
            resumeVotedIds={myVotedIds}
            onFinished={() => setScreen("results")}
            onLeave={handleLeave}
            onAdjustFilters={() => setScreen("lobby")}
          />
        )}
        {screen === "results" && (
          <ResultsDashboard
            session={session}
            Filtered_Array={Filtered_Array}
            synced={synced}
            onSwipeAgain={handleSwipeAgain}
            onLeave={handleLeave}
          />
        )}
      </div>

      {isDesktop && screen !== "join_create" && screen !== "reconnecting" && (
        <SidePanel session={session} Filtered_Array={Filtered_Array} screen={screen} synced={synced} />
      )}
    </div>
  );
}
