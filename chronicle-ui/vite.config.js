import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
var proxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:1609";
export default defineConfig({
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
