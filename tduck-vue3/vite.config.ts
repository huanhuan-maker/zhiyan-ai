import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.TDUCK_BACKEND_URL || "http://127.0.0.1:8998";
  const backend = new URL(target);
  if (
    !["http:", "https:"].includes(backend.protocol) ||
    backend.username ||
    backend.password
  )
    throw new Error("Invalid TDuck backend URL");
  const proxy = {
    "/tduck-api": {
      target,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/tduck-api/, ""),
      timeout: 15000,
      proxyTimeout: 15000,
    },
  };
  return {
    plugins: [vue()],
    server: { proxy },
    preview: { proxy },
    build: { chunkSizeWarningLimit: 1000 },
  };
});
