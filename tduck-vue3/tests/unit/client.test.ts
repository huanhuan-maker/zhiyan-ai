import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../../src/api/client";
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function setup(body: unknown, status = 200) {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response(body, status));
  const expired = vi.fn();
  return {
    request: createApiClient({
      getToken: () => "test-token",
      onUnauthorized: expired,
      fetcher,
    }),
    fetcher,
    expired,
  };
}
describe("TDuck transport and authentication contract", () => {
  it("sends the token only in the header and encodes query input", async () => {
    const { request, fetcher } = setup({
      code: 200,
      data: { total: 1 },
      msg: null,
    });
    await expect(
      request("/user/form/page", {
        query: new URLSearchParams({ name: "a&b", folderId: "0" }),
      })
    ).resolves.toEqual({ total: 1 });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("/tduck-api/user/form/page?name=a%26b&folderId=0");
    expect(new Headers(options?.headers).get("token")).toBe("test-token");
    expect(options?.credentials).toBe("omit");
    expect(options?.redirect).toBe("error");
  });
  it("does not attach a previous token to login", async () => {
    const { request, fetcher } = setup({ code: 200, data: { token: "new" } });
    await request("/login/account", { method: "POST" }, false);
    expect(new Headers(fetcher.mock.calls[0]![1]?.headers).has("token")).toBe(
      false
    );
  });
  it.each([200, 401])(
    "expires a session for upstream 401 with HTTP %s",
    async (status) => {
      const { request, expired } = setup(
        { code: 401, data: null, msg: "登录状态过期" },
        status
      );
      await expect(request("/user/current/detail")).rejects.toMatchObject({
        kind: "auth",
      });
      expect(expired).toHaveBeenCalledWith("test-token");
    }
  );
  it.each([
    { code: 500, msg: "无表单权限" },
    { code: 401, msg: "无权限访问" },
    { code: 403, msg: "" },
  ])(
    "retains the session for a permission denial: $code $msg",
    async (body) => {
      const { request, expired } = setup({ ...body, data: null });
      await expect(request("/user/form/test")).rejects.toMatchObject({
        kind: "forbidden",
      });
      expect(expired).not.toHaveBeenCalled();
    }
  );
  it("rejects a business failure wrapped in HTTP 200", async () => {
    const { request } = setup({ code: 500, msg: "账号或密码错误", data: null });
    await expect(request("/login/account", {}, false)).rejects.toMatchObject({
      kind: "business",
      message: "账号或密码不正确",
    });
  });
  it("does not display internal SQL or server error messages", async () => {
    const { request } = setup({
      code: 500,
      msg: "SQL: password=private; SELECT ac_user",
      data: null,
    });
    await expect(request("/user/form/page")).rejects.toMatchObject({
      message: "请求未成功，请检查输入后重试",
    });
  });
  it("fails explicitly for captcha requirements", async () => {
    const { request } = setup({ code: 416, data: null });
    await expect(request("/login/account", {}, false)).rejects.toMatchObject({
      kind: "verification",
    });
  });
  it("rejects HTML responses instead of treating them as success", async () => {
    const request = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("<html>bad gateway</html>")),
    });
    await expect(request("/user/form/page")).rejects.toMatchObject({
      kind: "protocol",
    });
  });
  it("reports proxy failures as unavailable", async () => {
    const request = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("bad gateway", { status: 502 })),
    });
    await expect(request("/user/form/page")).rejects.toMatchObject({
      kind: "network",
    });
  });
  it("reports a refused connection without clearing login", async () => {
    const expired = vi.fn();
    const request = createApiClient({
      getToken: () => "token",
      onUnauthorized: expired,
      fetcher: vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError("fetch failed")),
    });
    await expect(request("/user/form/page")).rejects.toMatchObject({
      kind: "network",
    });
    expect(expired).not.toHaveBeenCalled();
  });
  it("aborts a request that never responds", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError"))
            )
          )
      );
    const request = createApiClient({
      getToken: () => null,
      onUnauthorized: vi.fn(),
      fetcher,
      timeoutMs: 10,
    });
    await expect(request("/user/form/page")).rejects.toMatchObject({
      kind: "network",
      message: "请求超时，请稍后重试",
    });
  });
  it("rejects off-origin paths before any request", async () => {
    const { request, fetcher } = setup({ code: 200, data: null });
    await expect(request("//example.com/steal")).rejects.toMatchObject({
      kind: "protocol",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
