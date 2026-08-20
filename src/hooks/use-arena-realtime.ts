import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

/** Invalidate arena queries when Postgres changes arrive (ms-level host console). */
export function useArenaRealtime(arenaId: string, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !arenaId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["arena-host", arenaId] });
      void queryClient.invalidateQueries({ queryKey: ["arena-player", arenaId] });
    };

    const channel = supabase
      .channel(`arena-live:${arenaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "play_arenas",
          filter: `id=eq.${arenaId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "play_arena_answers",
          filter: `arena_id=eq.${arenaId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "play_arena_teams",
          filter: `arena_id=eq.${arenaId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [arenaId, enabled, queryClient]);
}
