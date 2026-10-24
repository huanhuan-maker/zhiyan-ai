import { beforeEach, describe, expect, it } from "vitest";
import { buildLanShareUrl, clearLanOrigin, lanOrigin, normalizeLanOrigin, saveLanOrigin, type LanOriginCheck } from "./sharing";

beforeEach(() => { localStorage.clear(); lanOrigin.value = null; });

describe("normalizeLanOrigin", () => {
  it("accepts a bare LAN IPv4 and applies the dev-server port", () => {
    const check = normalizeLanOrigin("192.168.137.1", "5173");
    expect(check.origin).toBe("http://192.168.137.1:5173");
    expect(check.error).toBe("");
  });
  it("keeps an explicit full origin and ignores any typed path", () => {
    expect(normalizeLanOrigin("http://192.168.1.23:5173/whatever", "5173").origin).toBe("http://192.168.1.23:5173");
  });
  it("reserves compatibility for a future HTTPS domain", () => {
    expect(normalizeLanOrigin("https://survey.example.com", "").origin).toBe("https://survey.example.com");
  });
  it("rejects everything a phone cannot reach", () => {
    const rejected = ["", "   ", "not a url", "localhost", "http://localhost:5173", "127.0.0.1",
      "http://127.0.0.1:5173", "0.0.0.0", "http://0.0.0.0", "http://[::1]:5173", "ftp://192.168.1.5"];
    for (const raw of rejected) {
      const check: LanOriginCheck = normalizeLanOrigin(raw, "5173");
      expect(check.origin, `expected rejection for ${raw}`).toBeNull();
      expect(check.error, `expected reason for ${raw}`).not.toBe("");
    }
  });
});

describe("buildLanShareUrl", () => {
  it("composes host, port, /public/ path and token from the configured origin", () => {
    lanOrigin.value = "http://192.168.137.1:5173";
    expect(buildLanShareUrl("/public/AbCdEfGh12345_IjKlMnOpQrStUvWxYz43AbCdEfGh123")).toBe("http://192.168.137.1:5173/public/AbCdEfGh12345_IjKlMnOpQrStUvWxYz43AbCdEfGh123");
  });
  it("produces no QR target before a usable LAN origin exists", () => {
    lanOrigin.value = null;
    expect(buildLanShareUrl("/public/token123")).toBeNull();
  });
  it("refuses paths outside the real public route", () => {
    lanOrigin.value = "http://192.168.137.1:5173";
    expect(buildLanShareUrl("/admin/whatever")).toBeNull();
    expect(buildLanShareUrl("public/relative")).toBeNull();
  });
});

describe("lan origin persistence", () => {
  it("stores a valid origin and clears it", () => {
    const saved = saveLanOrigin("192.168.137.1");
    expect(saved.origin).toBe(`http://192.168.137.1:${window.location.port || "80"}`);
    expect(lanOrigin.value).toBe(saved.origin);
    expect(localStorage.getItem("zhiyan:lan-origin")).toBe(saved.origin);
    clearLanOrigin();
    expect(lanOrigin.value).toBeNull();
    expect(localStorage.getItem("zhiyan:lan-origin")).toBeNull();
  });
  it("does not persist or apply an invalid origin", () => {
    const saved = saveLanOrigin("http://127.0.0.1:5173");
    expect(saved.origin).toBeNull();
    expect(saved.error).not.toBe("");
    expect(localStorage.getItem("zhiyan:lan-origin")).toBeNull();
  });
});
