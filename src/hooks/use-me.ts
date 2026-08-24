import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/platform.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

function isAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /unauthorized|authorization|invalid token|no token/i.test(message);
}

/** Shared participant bootstrap query (profile, role, level). */
export function useMe() {
  const fetchMe = useServerFn(getMe);
  const queryClient = useQueryClient();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionReady(Boolean(data.session?.access_token));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSessionReady(Boolean(session?.access_token));
      if (!session) {
        queryClient.removeQueries({ queryKey: ["me"] });
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await fetchMe();
      } catch (error) {
        if (isAuthError(error)) {
          const { data } = await supabase.auth.getSession();
          if (!data.session?.access_token) throw error;
          // One retry after the client session settles (common right after login).
          return await fetchMe();
        }
        throw error;
      }
    },
    enabled: sessionReady,
    staleTime: 60_000,
    retry: 1,
  });
}
