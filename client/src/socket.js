import { io } from "socket.io-client";

// Points at the backend from Block 1 (server/server.js).
// Override with VITE_SERVER_URL for a deployed backend.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export const socket = io(SERVER_URL, { autoConnect: true });
