import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const DEFAULT_WAIT_MS = 2500;

async function readSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

/** Wait briefly for Supabase to persist the session after sign-in / OAuth redirect. */
export async function resolveClientSession(opts?: { waitMs?: number }): Promise<Session | null> {
  const waitMs = opts?.waitMs ?? DEFAULT_WAIT_MS;
  const immediate = await readSession();
  if (immediate) return immediate;

  if (typeof window === "undefined") return null;

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(session);
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        if (session) finish(session);
      }
    });
    const subscription = data.subscription;

    const timer = window.setTimeout(() => {
      void readSession()
        .then((session) => finish(session))
        .catch(reject);
    }, waitMs);
  });
}

/** Client-only access token for server function Authorization headers. */
export async function readAccessToken(opts?: { waitMs?: number }): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const session = await resolveClientSession(opts);
  return session?.access_token ?? null;
}
