import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "url";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // 127.0.0.1 rather than localhost: with host "::" below, "localhost" can
  // resolve to ::1 first and the proxy then ECONNREFUSEs against a backend
  // listening only on IPv4.
  const target = env.VITE_PROXY_TARGET || "http://127.0.0.1:5002";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      /**
       * Makes the API same-origin from the browser's point of view, so it stops
       * sending a CORS preflight before every request — the app was paying two
       * round trips for each call. /uploads has to be proxied too: with the
       * base URL relative, lib/api.js resolves API_ORIGIN to "" and company
       * logos become root-relative paths served from this origin.
       *
       * No `xfwd: true` — it would add an X-Forwarded-For that
       * express-rate-limit warns about while the backend's TRUST_PROXY is 0.
       */
      proxy: {
        "/api": { target },
        "/uploads": { target },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        // __dirname does not exist here: this file is now plain ESM, loaded as
        // such because package.json sets "type": "module".
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
