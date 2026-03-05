import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const proxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:1609";
const rawBasePath = process.env.VITE_BASE_PATH || "/app/";
const normalizedBasePath = `/${rawBasePath.replace(/^\/+/, "").replace(/\/+$/, "")}/`;

export default defineConfig({
  base: normalizedBasePath,
  plugins: [react()],
  server: {
    proxy: {
      "/setup": proxyTarget,
      "/editor": proxyTarget,
      "/plan": proxyTarget,
      "/dashboard": proxyTarget,
      "/control": proxyTarget,
      "/rerun": proxyTarget
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup-tests.ts"]
  }
});
