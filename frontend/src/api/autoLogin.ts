import { login, request } from "./client";

/**
 * 测试阶段临时自动登录(2026-10-24 用户要求跳过手动登录)。
 * 仅当本地 frontend/.env.local 配置了 VITE_AUTO_LOGIN_USER / VITE_AUTO_LOGIN_PASSWORD 时启用;
 * 该文件被 .gitignore 忽略,仓库与默认构建不含任何账户信息。
 * 后端登录接口、CSRF、会话与所有权校验全部保持原样;自动登录失败时静默降级为正常登录页。
 * 恢复正式流程:删除 .env.local 里这两个变量(或 main.ts 中对本模块的调用)即可。
 */
export async function ensureDevSession(): Promise<void> {
  const user = import.meta.env.VITE_AUTO_LOGIN_USER as string | undefined;
  const password = import.meta.env.VITE_AUTO_LOGIN_PASSWORD as string | undefined;
  if (!user || !password) return;
  try { await request("/api/auth/me"); return; } catch { /* 未登录,继续尝试自动登录 */ }
  try { await login(user, password); } catch { /* 后端未启动或凭证失效:保持未登录,走登录页 */ }
}
