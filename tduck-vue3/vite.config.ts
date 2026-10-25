import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from '@vitejs/plugin-vue-jsx';
import {fileURLToPath, URL as NodeURL} from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.TDUCK_BACKEND_URL || "http://127.0.0.1:8997";
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
      // AI 草稿生成走真实模型，可能超过默认代理超时（后端 ai.timeout-ms 默认 90s）
      timeout: 120000,
      proxyTimeout: 120000,
    },
  };
  return {
    plugins: [vue(),vueJsx({include:/formatTableColumn\.js$/})],
    resolve:{alias:{'@':fileURLToPath(new NodeURL('./src/td',import.meta.url))},extensions:['.mjs','.js','.ts','.jsx','.tsx','.json','.vue']},
    define:{'process.env.VUE_APP_API_ROOT':JSON.stringify('/tduck-api'),'process.env.VUE_APP_TITLE':JSON.stringify('TDuck'),'process.env.VUE_APP_MAP_KEY':JSON.stringify(env.VITE_TDUCK_AMAP_KEY||''),'process.env.VUE_APP_SECURITY_JSCODE':JSON.stringify(env.VITE_TDUCK_AMAP_SECURITY_JSCODE||''),'process.env.VUE_APP_WX':JSON.stringify(env.VITE_TDUCK_ENABLE_WX==='ON'?'ON':'OFF'),'process.env.VUE_APP_BASE_API':JSON.stringify('/tduck-api')},
    server: { proxy },
    preview: { proxy },
    build: { chunkSizeWarningLimit: 1000 },
  };
});
