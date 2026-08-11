import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  // Vite only exposes VITE_* to import.meta.env. Server functions read process.env
  // (GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, …). Nitro loads .env on build, but
  // local `vite dev` skips Nitro — so inject all .env keys into process.env here.
  const fileEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    server: {
      port: 3000,
      headers: {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      },
    },
    resolve: {
      tsconfigPaths: true,
      dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
    },
    plugins: [
      tailwindcss(),
      tanstackStart({
        // Redirect TanStack Start's bundled server entry to src/server.ts (SSR error wrapper).
        server: { entry: "server" },
      }),
      viteReact(),
      // Nitro’s Vite Environments bridge can lose `__nitro_vite_envs__` after HMR on Windows
      // (`Cannot read properties of undefined (reading 'ssr')`). Use Nitro for production
      // builds/deploy only; TanStack Start handles local SSR without it.
      command === "build" &&
        nitro({
          routeRules: {
            "/**": {
              headers: {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "Referrer-Policy": "strict-origin-when-cross-origin",
                "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
                "Cross-Origin-Opener-Policy": "same-origin",
              },
            },
          },
        }),
    ],
  };
});
