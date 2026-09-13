import { useEffect, useState } from "react";
import { socket } from "./socket.js";

// Render's free tier puts the backend to sleep after 15 minutes idle, so the
// very first connection after a while can take 30-60s to wake it up. This
// flips true once the wait is noticeably longer than a normal connection,
// so the UI can explain the delay instead of just sitting there looking broken.
export function useServerWaking(thresholdMs = 3000) {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    if (socket.connected) return undefined;

    const timer = setTimeout(() => setWaking(true), thresholdMs);
    function onConnect() {
      clearTimeout(timer);
      setWaking(false);
    }
    socket.on("connect", onConnect);
    return () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
    };
  }, [thresholdMs]);

  return waking;
}
