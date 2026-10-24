export interface SystemCheck {
  id: number;
  message: string;
  createdAt: string;
}
export interface User {
  username: string;
  role: string;
}
let csrf: { token: string; headerName: string } | undefined;

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.message ??
          (response.status === 401
            ? "请先登录后访问调研工作空间"
            : `请求失败 (${response.status})`),
      );
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new Error("请求超时，请检查后端是否已启动");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function csrfHeaders() {
  csrf = await request("/api/auth/csrf");
  return { [csrf!.headerName]: csrf!.token };
}
export async function mutate<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  return request<T>(path, {
    method,
    headers: { ...(await csrfHeaders()), "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
export async function register(username: string, password: string) {
  await mutate("/api/auth/register", { username, password });
}
export async function login(username: string, password: string) {
  await request("/api/auth/login", {
    method: "POST",
    headers: {
      ...(await csrfHeaders()),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ username, password }),
  });
  csrf = undefined;
}
export async function logout() {
  await request("/api/auth/logout", {
    method: "POST",
    headers: await csrfHeaders(),
  });
  csrf = undefined;
}
export async function createCheck(message: string) {
  return request<SystemCheck>("/api/system-checks", {
    method: "POST",
    headers: { ...(await csrfHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}
