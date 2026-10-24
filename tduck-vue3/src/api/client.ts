export type ErrorKind =
  | "auth"
  | "forbidden"
  | "network"
  | "server"
  | "business"
  | "protocol"
  | "verification";
export class ApiError extends Error {
  constructor(public kind: ErrorKind, message: string, public code?: number) {
    super(message);
  }
}
interface ClientOptions {
  getToken: () => string | null;
  onUnauthorized: (token: string) => void;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}
export interface ApiRequestInit extends RequestInit {
  query?: URLSearchParams;
}
// TDuck uses HTTP 200 even for many business failures. Check both layers.
export function createApiClient(options: ClientOptions) {
  return async function request<T>(
    path: string,
    init: ApiRequestInit = {},
    authenticated = true
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("?"))
      throw new ApiError("protocol", "接口路径不正确");
    const token = authenticated ? options.getToken() : null;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (token) headers.set("token", token);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 12000
    );
    try {
      const { query, ...requestInit } = init;
      const suffix = query?.size ? `?${query.toString()}` : "";
      const response = await (options.fetcher ?? fetch)(
        `/tduck-api${path}${suffix}`,
        {
          ...requestInit,
          headers,
          signal: controller.signal,
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
        }
      );
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (response.status === 502 || response.status === 504)
          throw new ApiError("network", "暂时无法连接服务，请检查后端后重试");
      }
      const envelope =
        body && typeof body === "object"
          ? (body as Record<string, unknown>)
          : null;
      const code =
        typeof envelope?.code === "number" ? envelope.code : response.status;
      const msg = typeof envelope?.msg === "string" ? envelope.msg : "";
      // Upstream returns permission failures as either 401 or 500.
      if (
        response.status === 403 ||
        code === 403 ||
        /无.*权限|权限不足|无权访问/.test(msg)
      )
        throw new ApiError(
          "forbidden",
          "你没有权限查看这份问卷，请联系所有者",
          code
        );
      if (response.status === 401 || code === 401) {
        if (token) options.onUnauthorized(token);
        throw new ApiError("auth", "登录已过期，请重新登录", code);
      }
      if (code === 416)
        throw new ApiError(
          "verification",
          "当前部署要求安全验证，请使用原版入口完成登录",
          code
        );
      if (!response.ok)
        throw new ApiError(
          response.status >= 500 ? "server" : "business",
          "请求未成功，请稍后重试",
          code
        );
      if (
        !envelope ||
        typeof envelope.code !== "number" ||
        !("data" in envelope)
      )
        throw new ApiError("protocol", "服务返回格式异常，请联系维护人员");
      if (code !== 200) {
        const message = /账号|密码/.test(msg)
          ? /锁定|次数过多/.test(msg)
            ? "登录失败次数过多，请稍后再试"
            : "账号或密码不正确"
          : "请求未成功，请检查输入后重试";
        throw new ApiError("business", message, code);
      }
      return envelope.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        "network",
        controller.signal.aborted
          ? "请求超时，请稍后重试"
          : "网络连接异常，请检查网络及后端服务"
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "操作未完成，请稍后重试";
}
