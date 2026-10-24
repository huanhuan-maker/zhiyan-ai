import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuth } from "../../src/stores/auth";
import { TOKEN_KEY } from "../../src/api";
import { safeRedirect } from "../../src/router";
beforeEach(() => {
  sessionStorage.clear();
  setActivePinia(createPinia());
});
describe("session lifecycle", () => {
  it("does not clear a newer session on a delayed 401 from an old request", () => {
    sessionStorage.setItem(TOKEN_KEY, "new-token");
    const auth = useAuth();
    auth.expire("old-token");
    expect(auth.token).toBe("new-token");
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe("new-token");
    auth.expire("new-token");
    expect(auth.token).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });
  it("does not restore a login if logout happened while login was pending", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          })
      )
    );
    try {
      const auth = useAuth();
      const pending = auth.login("user@example.test", "test-pass");
      auth.logout();
      finish(
        new Response(
          JSON.stringify({
            code: 200,
            data: { token: "late-token", name: "Test" },
          })
        )
      );
      await pending;
      expect(auth.token).toBeNull();
      expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("does not bypass the upstream initial-password change requirement", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              code: 200,
              data: { token: "token", needChangePassword: true },
            })
          )
        )
    );
    try {
      const auth = useAuth();
      await expect(auth.login("user@example.test", "initial")).rejects.toThrow(
        "修改初始密码"
      );
      expect(auth.token).toBeNull();
      expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/login",
    "/about",
  ])("restricts redirect %s to the local workspace", (target) => {
    expect(safeRedirect(target)).toBe("/forms");
  });
  it("preserves a local questionnaire detail destination", () => {
    expect(safeRedirect("/forms/abc")).toBe("/forms/abc");
  });
});
