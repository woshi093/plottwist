require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { Master_Catalogue: SEED_CATALOGUE } = require("./catalogue");
const { buildCatalogueFromTMDB } = require("./tmdb");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Master_Catalogue is decided in this priority order:
//   1. A locally-generated, git-committed cache file (instant, no API call,
//      works even if TMDB is down) - see server/scripts/build_catalogue_cache.js
//   2. A live TMDB fetch, if no cache file exists but TMDB_API_KEY is set
//   3. The static seed list in catalogue.js, as a last resort
// FilterCatalogue() below reads this variable by reference, so whichever
// source wins takes effect automatically once initCatalogue() resolves.
let Master_Catalogue = SEED_CATALOGUE;
const CATALOGUE_CACHE_PATH = path.join(__dirname, "catalogue_tmdb_cache.json");

async function initCatalogue() {
  if (fs.existsSync(CATALOGUE_CACHE_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CATALOGUE_CACHE_PATH, "utf8"));
      if (Array.isArray(cached) && cached.length > 0) {
        Master_Catalogue = cached;
        console.log(`Loaded ${Master_Catalogue.length} titles from the cached catalogue file (instant, no TMDB call).`);
        return;
      }
    } catch (err) {
      console.warn(`Cached catalogue file unreadable (${err.message}) - falling back to a live TMDB fetch.`);
    }
  }
  try {
    Master_Catalogue = await buildCatalogueFromTMDB();
    console.log(`Loaded ${Master_Catalogue.length} titles from a live TMDB fetch.`);
  } catch (err) {
    console.warn(`TMDB catalogue unavailable (${err.message}) - using the built-in seed catalogue instead.`);
    Master_Catalogue = SEED_CATALOGUE;
  }
}

// Active_Session_Table: { [Room_Code]: RoomState }
// RoomState = {
//   Room_Code,
//   Filtered_Array: [ Movie_Object, ... ],   // Movie_Object.Current_Score / Movie_Status live here
//   Session_Active_Array: [ { socketId, userId, name, User_Veto_Button, completion_status, Voted_Movies, disconnectedAt }, ... ],
//   hostUserId   // stable across reconnects, unlike socketId
// }
const Active_Session_Table = {};

function roomExists(code) {
  return Object.prototype.hasOwnProperty.call(Active_Session_Table, code);
}

// ---------------------------------------------------------------
// GenerateRoomCode() - unique 4-digit code, 1000-9999
// ---------------------------------------------------------------
function GenerateRoomCode() {
  let Room_Code;
  let Code_Is_Unique = false;
  while (!Code_Is_Unique) {
    Room_Code = String(Math.floor(1000 + Math.random() * 9000)); // RANDOM_INTEGER(1000, 9999)
    if (!roomExists(Room_Code)) Code_Is_Unique = true;
  }
  Active_Session_Table[Room_Code] = {
    Room_Code,
    Filtered_Array: [],
    Session_Active_Array: [],
    hostUserId: null,
    activeTiebreakIds: [], // movie ids currently in a tiebreak revote, if any
    hasHadTiebreak: false, // caps the whole session at one revote round, ever
  };
  return Room_Code;
}

// ---------------------------------------------------------------
// ValidateRoomCode(Input_Code)
// ---------------------------------------------------------------
function ValidateRoomCode(Input_Code) {
  return roomExists(Input_Code);
}

// ---------------------------------------------------------------
// FilterCatalogue(Max_Duration, Platform_List, Genre_List, Card_Count)
// ---------------------------------------------------------------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function FilterCatalogue(Max_Duration, Platform_List, Genre_List, Card_Count) {
  const Filtered_Array = [];
  for (const Movie_Object of Master_Catalogue) {
    const durationOk = Movie_Object.duration <= Max_Duration;
    const platformOk =
      !Platform_List ||
      Platform_List.length === 0 ||
      Movie_Object.available_platforms.some((p) => Platform_List.includes(p));
    const genreOk =
      !Genre_List ||
      Genre_List.length === 0 ||
      (Movie_Object.genres || []).some((g) => Genre_List.includes(g));
    if (durationOk && platformOk && genreOk) {
      Filtered_Array.push({
        ...Movie_Object,
        Current_Score: 0,
        Tiebreak_Score: 0, // only used if this title ends up in a tiebreak revote
        Movie_Status: "ACTIVE",
      });
    }
  }
  const shuffled = shuffle(Filtered_Array);
  if (Card_Count && Card_Count > 0) {
    return shuffled.slice(0, Card_Count);
  }
  return shuffled;
}

// ---------------------------------------------------------------
// BroadcastLiveUpdate(Event_Type, Data_Object) - pushes to every
// connected device in the room immediately.
// ---------------------------------------------------------------
function BroadcastLiveUpdate(Room_Code, Event_Type, Data_Object) {
  io.to(Room_Code).emit(Event_Type, Data_Object);
}

// ---------------------------------------------------------------
// checkRoomCompletion(Room_Code) - called whenever a user finishes their
// deck. Once EVERYONE in the room has finished, decides what happens next:
// a clear winner (session ends), a tie needing one revote (starts a
// tiebreak round), or a tie that survived a revote too (ends as a genuine
// tie, rather than looping forever).
// ---------------------------------------------------------------
function checkRoomCompletion(Room_Code) {
  const room = Active_Session_Table[Room_Code];
  if (!room) return;

  const allFinished =
    room.Session_Active_Array.length > 0 &&
    room.Session_Active_Array.every((u) => u.completion_status === "FINISHED");
  console.log(
    `[tiebreak] checkRoomCompletion(${Room_Code}): statuses=`,
    room.Session_Active_Array.map((u) => `${u.name}:${u.completion_status}`),
    `allFinished=${allFinished}`
  );
  if (!allFinished) return;

  const active = room.Filtered_Array.filter((m) => m.Movie_Status !== "EXCLUDED");
  if (active.length === 0) {
    room.activeTiebreakIds = [];
    BroadcastLiveUpdate(Room_Code, "SESSION_COMPLETE", { tie: false, tiedMovieIds: [] });
    return;
  }

  // Rank by Current_Score first, Tiebreak_Score as the secondary key - a
  // title that's been through a revote is compared on that revote's result,
  // not on the original score that got it into the tiebreak in the first place.
  const ranked = [...active].sort(
    (a, b) => b.Current_Score - a.Current_Score || b.Tiebreak_Score - a.Tiebreak_Score
  );
  const top = ranked[0];
  const tied = ranked.filter(
    (m) => m.Current_Score === top.Current_Score && m.Tiebreak_Score === top.Tiebreak_Score
  );
  console.log(
    `[tiebreak] scores=`,
    ranked.map((m) => `${m.title}:cur=${m.Current_Score},tb=${m.Tiebreak_Score}`),
    `tiedCount=${tied.length}`,
    `hasHadTiebreak=${room.hasHadTiebreak}`
  );

  if (tied.length <= 1) {
    console.log(`[tiebreak] resolved with a clear winner: ${top.title}`);
    room.activeTiebreakIds = [];
    BroadcastLiveUpdate(Room_Code, "SESSION_COMPLETE", { tie: false, tiedMovieIds: [] });
    return;
  }

  if (room.hasHadTiebreak) {
    // This session already had its one revote round - whatever's still tied
    // now (even if it's a smaller group than the original tie) is final.
    console.log(`[tiebreak] already had a revote this session - calling it a genuine tie`);
    room.activeTiebreakIds = [];
    BroadcastLiveUpdate(Room_Code, "SESSION_COMPLETE", { tie: true, tiedMovieIds: tied.map((m) => m.id) });
    return;
  }

  console.log(`[tiebreak] starting the one-and-only tiebreak round`);
  // Start the tiebreak round: clear everyone's vote memory for just these
  // titles (so their next swipe registers as a fresh vote, not a no-op),
  // reset completion so the room can tell when the revote itself is done.
  room.hasHadTiebreak = true;
  room.activeTiebreakIds = tied.map((m) => m.id);
  for (const u of room.Session_Active_Array) {
    for (const id of room.activeTiebreakIds) {
      delete u.Voted_Movies[id];
    }
    u.completion_status = "IN_PROGRESS";
  }
  BroadcastLiveUpdate(Room_Code, "TIEBREAK_ROUND", { tiedMovieIds: room.activeTiebreakIds });
  BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
}

function publicRoomState(room) {
  return {
    Room_Code: room.Room_Code,
    Filtered_Array: room.Filtered_Array,
    Session_Active_Array: room.Session_Active_Array.map((u) => ({
      userId: u.userId,
      name: u.name,
      User_Veto_Button: u.User_Veto_Button,
      completion_status: u.completion_status,
      connected: !u.disconnectedAt,
    })),
  };
}

io.on("connection", (socket) => {
  // ---- Create room (host) ----
  socket.on("create_room", ({ name, userId }, cb) => {
    const Room_Code = GenerateRoomCode();
    const room = Active_Session_Table[Room_Code];
    room.hostUserId = userId;
    room.Session_Active_Array.push({
      socketId: socket.id,
      userId,
      name: name || "Host",
      User_Veto_Button: false,
      completion_status: "IN_PROGRESS",
      Voted_Movies: {}, // { [movieId]: "RIGHT" | "LEFT" } - lets a user safely re-swipe (e.g. "Swipe again") without inflating the group score
      disconnectedAt: null,
    });
    socket.join(Room_Code);
    cb({ success: true, Room_Code, userId, isHost: true });
    BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
  });

  // ---- Join room ----
  socket.on("join_room", ({ Input_Code, name, userId }, cb) => {
    const isValid = ValidateRoomCode(Input_Code);
    if (!isValid) {
      cb({ success: false, message: "Invalid code, please try again" });
      return;
    }
    const room = Active_Session_Table[Input_Code];

    // If this exact browser (same persistent userId) is already in this
    // room - e.g. a second tab, or re-scanning the same QR code - reclaim
    // that existing entry instead of pushing a duplicate. Two entries with
    // the same userId would break every userId-based lookup elsewhere
    // (veto, swipe, rejoin), since they'd silently collide on whichever
    // one Array.find() happens to hit first.
    const existing = room.Session_Active_Array.find((u) => u.userId === userId);
    if (existing) {
      existing.socketId = socket.id;
      existing.disconnectedAt = null;
      socket.join(Input_Code);
      cb({
        success: true,
        Room_Code: Input_Code,
        userId,
        isHost: userId === room.hostUserId,
        Filtered_Array: room.Filtered_Array,
      });
      BroadcastLiveUpdate(Input_Code, "LOBBY_UPDATE", publicRoomState(room));
      return;
    }

    room.Session_Active_Array.push({
      socketId: socket.id,
      userId,
      name: name || "Guest",
      User_Veto_Button: false,
      completion_status: "IN_PROGRESS",
      Voted_Movies: {},
      disconnectedAt: null,
    });
    socket.join(Input_Code);
    cb({
      success: true,
      Room_Code: Input_Code,
      userId,
      isHost: false,
      Filtered_Array: room.Filtered_Array,
    });
    BroadcastLiveUpdate(Input_Code, "LOBBY_UPDATE", publicRoomState(room));
  });

  // ---- Rejoin room (after a refresh / brief disconnect) ----
  // Reclaims the same Session_Active_Array entry by userId - a stable id the
  // client keeps in localStorage, separate from socket.id which changes on
  // every reconnect - so a refreshed user keeps their veto status, their
  // votes so far, and their host status instead of appearing as a new guest.
  socket.on("rejoin_room", ({ Room_Code, userId }, cb) => {
    const room = Active_Session_Table[Room_Code];
    if (!room) {
      cb({ success: false, message: "Room no longer exists" });
      return;
    }
    const User = room.Session_Active_Array.find((u) => u.userId === userId);
    if (!User) {
      cb({ success: false, message: "User not found in this room" });
      return;
    }
    User.socketId = socket.id;
    User.disconnectedAt = null;
    socket.join(Room_Code);
    cb({
      success: true,
      Room_Code,
      userId,
      isHost: userId === room.hostUserId,
      Filtered_Array: room.Filtered_Array,
      Voted_Movies: User.Voted_Movies,
      completion_status: User.completion_status,
    });
    BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
  });

  // ---- HostSetFilters(Max_Duration, Platform_List, Genre_List, Card_Count) ----
  socket.on("host_set_filters", ({ Room_Code, Max_Duration, Platform_List, Genre_List, Card_Count }, cb) => {
    const room = Active_Session_Table[Room_Code];
    if (!room) {
      cb && cb({ success: false, message: "Room no longer exists - try leaving and rejoining." });
      return;
    }
    // Guard against wiping real progress: only allow (re)setting the deck if
    // either nobody has swiped on anything yet, or the current deck is
    // already empty (e.g. the "Adjust filters" escape hatch after a filter
    // combo matched zero titles). This stops a host from accidentally
    // reshuffling a brand new deck out from under a group mid-session.
    const anyoneHasVoted = room.Session_Active_Array.some(
      (u) => u.Voted_Movies && Object.keys(u.Voted_Movies).length > 0
    );
    if (anyoneHasVoted && room.Filtered_Array.length > 0) {
      cb && cb({ success: false, message: "Can't change filters mid-session - everyone's already started swiping." });
      return;
    }
    room.Filtered_Array = FilterCatalogue(Max_Duration, Platform_List, Genre_List, Card_Count);
    cb && cb({ success: true });
    BroadcastLiveUpdate(Room_Code, "CATALOGUE_READY", room.Filtered_Array);
  });

  // ---- ProcessSwipe: RIGHT / LEFT ----
  socket.on("user_swipe", ({ Room_Code, userId, movieId, User_Action }) => {
    const room = Active_Session_Table[Room_Code];
    if (!room) return;
    const Movie_Object = room.Filtered_Array.find((m) => m.id === movieId);
    const User = room.Session_Active_Array.find((u) => u.userId === userId);
    if (!Movie_Object || !User || Movie_Object.Movie_Status === "EXCLUDED") return;
    if (User_Action !== "RIGHT" && User_Action !== "LEFT") return;

    const delta = (action) => (action === "RIGHT" ? 1 : -1);
    const previousVote = User.Voted_Movies[movieId];

    if (previousVote === User_Action) {
      // Same user, same title, same direction (e.g. after "Swipe again") - no-op.
      return;
    }
    // During a tiebreak, votes go to a separate Tiebreak_Score rather than
    // the original Current_Score - this keeps the revote on a clean slate
    // without disturbing the score that got these titles into the tiebreak
    // in the first place, and without needing to compare two different
    // scoring "rounds" against each other for titles that were never tied.
    const inTiebreak = room.activeTiebreakIds.includes(movieId);
    const scoreField = inTiebreak ? "Tiebreak_Score" : "Current_Score";
    if (inTiebreak) {
      console.log(`[tiebreak] swipe during tiebreak: ${User.name} -> ${Movie_Object.title} (${User_Action})`);
    }

    if (previousVote) {
      // User is changing their mind on this title - undo their old contribution first.
      Movie_Object[scoreField] -= delta(previousVote);
    }
    Movie_Object[scoreField] += delta(User_Action);
    User.Voted_Movies[movieId] = User_Action;

    BroadcastLiveUpdate(Room_Code, "SCORE_UPDATE", Movie_Object);
  });

  // ---- ProcessSwipe: VETO_BUTTON_TAPPED branch (two-step, post-confirmation) ----
  socket.on("veto_confirm", ({ Room_Code, userId, movieId, Confirmed }, cb) => {
    const room = Active_Session_Table[Room_Code];
    if (!room) return;
    const User = room.Session_Active_Array.find((u) => u.userId === userId);
    const Movie_Object = room.Filtered_Array.find((m) => m.id === movieId);
    if (!User || !Movie_Object) return;

    if (Confirmed !== true) {
      cb && cb({ status: "CANCELLED" });
      return; // DISPLAY "Veto cancelled" - no state change
    }

    if (User.User_Veto_Button === true) {
      cb && cb({ status: "BLOCKED", message: "Veto already used this session" });
      return;
    }

    Movie_Object.Movie_Status = "EXCLUDED";
    User.User_Veto_Button = true;
    BroadcastLiveUpdate(Room_Code, "VETO_APPLIED", Movie_Object);
    BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
    cb && cb({ status: "EXCLUDED" });
  });

  // ---- User finished their deck ----
  socket.on("user_finished", ({ Room_Code, userId }) => {
    const room = Active_Session_Table[Room_Code];
    if (!room) return;
    const User = room.Session_Active_Array.find((u) => u.userId === userId);
    if (User) User.completion_status = "FINISHED";
    console.log(`[tiebreak] user_finished: ${User ? User.name : userId} in room ${Room_Code}`);
    BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
    checkRoomCompletion(Room_Code);
  });

  // ---- Leave room (explicit, via the Leave button) ----
  // An explicit leave is a deliberate exit - remove the user immediately,
  // unlike a plain disconnect (see below), which gets a reconnect grace period.
  socket.on("leave_room", ({ Room_Code }) => {
    removeSocketFromRoom(socket, Room_Code);
    socket.leave(Room_Code);
  });

  // A plain disconnect (refresh, brief network drop, tab close) doesn't
  // remove the user outright - it marks them as temporarily away so
  // rejoin_room can reclaim the same slot (same votes, same veto status)
  // within RECONNECT_GRACE_MS. cleanupDisconnectedUsers() below does the
  // actual removal once the grace period has passed.
  socket.on("disconnect", () => {
    for (const Room_Code of Object.keys(Active_Session_Table)) {
      const room = Active_Session_Table[Room_Code];
      const User = room.Session_Active_Array.find((u) => u.socketId === socket.id);
      if (User) {
        User.disconnectedAt = Date.now();
        BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
      }
    }
  });

  function removeSocketFromRoom(socket, Room_Code) {
    const room = Active_Session_Table[Room_Code];
    if (!room) return;
    const before = room.Session_Active_Array.length;
    room.Session_Active_Array = room.Session_Active_Array.filter(
      (u) => u.socketId !== socket.id
    );
    if (room.Session_Active_Array.length !== before) {
      BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
    }
    if (room.Session_Active_Array.length === 0) {
      delete Active_Session_Table[Room_Code];
    } else {
      // If the person who just left was the only one still mid-tiebreak,
      // everyone else left waiting needs this to be re-checked - otherwise
      // they'd wait forever for someone who's no longer coming back.
      checkRoomCompletion(Room_Code);
    }
  }
});

// ---------------------------------------------------------------
// Periodic cleanup: a user who has been disconnected (not explicitly left)
// for longer than RECONNECT_GRACE_MS is now assumed gone for good and is
// removed, along with any room that ends up empty as a result.
// ---------------------------------------------------------------
const RECONNECT_GRACE_MS = 60_000;
setInterval(() => {
  for (const Room_Code of Object.keys(Active_Session_Table)) {
    const room = Active_Session_Table[Room_Code];
    const before = room.Session_Active_Array.length;
    room.Session_Active_Array = room.Session_Active_Array.filter(
      (u) => !(u.disconnectedAt && Date.now() - u.disconnectedAt > RECONNECT_GRACE_MS)
    );
    if (room.Session_Active_Array.length !== before) {
      BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
    }
    if (room.Session_Active_Array.length === 0) {
      delete Active_Session_Table[Room_Code];
    } else if (room.Session_Active_Array.length !== before) {
      checkRoomCompletion(Room_Code); // same reasoning as removeSocketFromRoom above
    }
  }
}, 15_000);

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`PlotTwist server listening on :${PORT}`));

// Catalogue loading happens in the background so a large TMDB fetch never
// delays the server coming online - the app is immediately usable with the
// seed catalogue, then swaps to real TMDB data as soon as it's ready.
initCatalogue();
