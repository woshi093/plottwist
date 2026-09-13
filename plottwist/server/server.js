require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { Master_Catalogue: SEED_CATALOGUE } = require("./catalogue");
const { buildCatalogueFromTMDB } = require("./tmdb");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Master_Catalogue starts as the static seed list, and is replaced with real
// TMDB data at startup if TMDB_API_KEY is set and the request succeeds.
// FilterCatalogue() below reads this variable by reference, so the
// replacement takes effect automatically once initCatalogue() resolves.
let Master_Catalogue = SEED_CATALOGUE;

async function initCatalogue() {
  try {
    Master_Catalogue = await buildCatalogueFromTMDB();
    console.log(`Loaded ${Master_Catalogue.length} titles from TMDB.`);
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
  socket.on("host_set_filters", ({ Room_Code, Max_Duration, Platform_List, Genre_List, Card_Count }) => {
    const room = Active_Session_Table[Room_Code];
    if (!room) return;
    room.Filtered_Array = FilterCatalogue(Max_Duration, Platform_List, Genre_List, Card_Count);
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
    if (previousVote) {
      // User is changing their mind on this title - undo their old contribution first.
      Movie_Object.Current_Score -= delta(previousVote);
    }
    Movie_Object.Current_Score += delta(User_Action);
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
    BroadcastLiveUpdate(Room_Code, "LOBBY_UPDATE", publicRoomState(room));
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
