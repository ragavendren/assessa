import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** Invalidate pulse queries when Postgres changes arrive. */
export function usePulseRealtime(pulseId: string, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !pulseId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["pulse-host", pulseId] });
      void queryClient.invalidateQueries({ queryKey: ["pulse-player", pulseId] });
      void queryClient.invalidateQueries({ queryKey: ["pulse-board", pulseId] });
    };

    const channel = supabase
      .channel(`pulse-live:${pulseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "play_pulses", filter: `id=eq.${pulseId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "play_pulse_responses",
          filter: `pulse_id=eq.${pulseId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "play_pulse_participants",
          filter: `pulse_id=eq.${pulseId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pulseId, enabled, queryClient]);
}
