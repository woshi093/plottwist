// A stable userId that survives page refreshes/reconnects, stored in
// localStorage. Distinct from socket.id, which changes every time the
// browser reconnects (e.g. after a refresh or brief network drop).
const KEY = "plottwist_user_id";

export function getPersistentUserId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

// Remembers which room this browser was last in, so a refresh can silently
// rejoin instead of landing back on the Join/Create screen. Cleared on an
// explicit "Leave" - that's a deliberate exit, not something to undo.
const ROOM_KEY = "plottwist_last_room";

export function saveLastRoom(Room_Code) {
  localStorage.setItem(ROOM_KEY, Room_Code);
}

export function getLastRoom() {
  return localStorage.getItem(ROOM_KEY);
}

export function clearLastRoom() {
  localStorage.removeItem(ROOM_KEY);
}
