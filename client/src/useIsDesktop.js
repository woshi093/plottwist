import { useEffect, useState } from "react";

// Drives the responsive desktop side panel (live scoreboard + party list).
// 900px comfortably fits the 430px phone-style app_shell plus a 360px panel
// with room to breathe on either side.
export function useIsDesktop(breakpoint = 900) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" && window.innerWidth >= breakpoint
  );

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isDesktop;
}
