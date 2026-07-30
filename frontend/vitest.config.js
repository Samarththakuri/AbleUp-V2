import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.{test,spec}.{js,jsx}"],
  },
  resolve: {
    // __dirname does not exist here: this file is now plain ESM, loaded as
    // such because package.json sets "type": "module".
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
