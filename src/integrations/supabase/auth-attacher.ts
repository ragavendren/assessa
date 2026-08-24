import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";
import { readAccessToken } from "@/lib/auth-session";

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") {
      return next({ headers: {} });
    }

    const { data } = await supabase.auth.getSession();
    let token = data.session?.access_token ?? null;
    // After sign-in the session can lag a beat — wait briefly only when missing.
    if (!token) {
      token = await readAccessToken({ waitMs: 1200 });
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
