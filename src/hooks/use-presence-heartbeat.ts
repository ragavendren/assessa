import { pingPresence } from "@/lib/platform.functions";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

/** Keep `profiles.last_seen_at` fresh while the signed-in shell is open. */
export function usePresenceHeartbeat(enabled = true) {
  const ping = useServerFn(pingPresence);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const beat = () => {
      if (cancelled) return;
      void ping().catch(() => undefined);
    };
    beat();
    const id = window.setInterval(beat, 45_000);
    const onFocus = () => beat();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, ping]);
}
