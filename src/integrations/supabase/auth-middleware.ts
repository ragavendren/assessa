import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  createSupabaseFetch,
  formatSupabaseFetchError,
  stripEnvQuotes,
} from "./server-fetch";

export const requireSupabaseAuth = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const SUPABASE_URL =
    stripEnvQuotes(process.env["SUPABASE_URL"]) ||
    stripEnvQuotes(process.env["VITE_SUPABASE_URL"]);
  const SUPABASE_PUBLISHABLE_KEY =
    stripEnvQuotes(process.env["SUPABASE_PUBLISHABLE_KEY"]) ||
    stripEnvQuotes(process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Set them in your environment (see README).`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  const request = getRequest();

  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    throw new Error("Unauthorized: No authorization header provided");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Only Bearer tokens are supported");
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  if (token.split(".").length !== 3) {
    throw new Error("Unauthorized: Invalid token");
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Prefer Auth API validation (works for ES256 / asymmetric signing keys).
  const userResult = await supabase.auth.getUser(token);
  if (userResult.data?.user?.id) {
    const user = userResult.data.user;
    return next({
      context: {
        supabase,
        userId: user.id,
        claims: {
          sub: user.id,
          email: user.email,
          user_metadata: user.user_metadata ?? {},
          app_metadata: user.app_metadata ?? {},
        },
      },
    });
  }

  // Fallback: local JWKS claims verification.
  const claimsResult = await supabase.auth.getClaims(token);
  if (claimsResult.data?.claims?.sub) {
    return next({
      context: {
        supabase,
        userId: String(claimsResult.data.claims.sub),
        claims: claimsResult.data.claims,
      },
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(
      "[Supabase auth] validation failed:",
      formatSupabaseFetchError(userResult.error ?? claimsResult.error),
    );
  }
  throw new Error("Unauthorized: Invalid token");
});
