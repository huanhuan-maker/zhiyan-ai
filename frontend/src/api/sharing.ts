import { ref } from "vue";

// LAN share-link configuration. The QR must never encode localhost: phones cannot reach it.
const STORAGE_KEY = "zhiyan:lan-origin";

export interface LanOriginCheck { origin: string | null; error: string }

export function normalizeLanOrigin(raw: string, defaultPort: string): LanOriginCheck {
  const input = (raw ?? "").trim();
  if (!input) return { origin: null, error: "尚未配置局域网访问地址。" };
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input) ? input : `http://${input}`;
  let url: URL;
  try { url = new URL(candidate); } catch { return { origin: null, error: "地址格式无法识别。示例：192.168.137.1 或 http://192.168.137.1:5173" }; }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { origin: null, error: "仅支持 http:// 或 https:// 地址（为将来 HTTPS 域名保留）。" };
  const host = url.hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (!host || host === "localhost" || host === "0.0.0.0" || host === "::1" || host.startsWith("127."))
    return { origin: null, error: "不能使用 localhost、127.0.0.1 或 0.0.0.0：手机无法访问。请填写电脑的局域网 IPv4（或域名）。" };
  if (!url.port && defaultPort) url.port = defaultPort;
  return { origin: url.origin, error: "" };
}

function currentDefaultPort(): string {
  try { return window.location.port; } catch { return ""; }
}

function readStored(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    if (!raw) return null;
    return normalizeLanOrigin(raw, currentDefaultPort()).origin;
  } catch { return null; }
}

/** Normalized LAN origin shared by every QR card; reactive so saving once updates all cards. */
export const lanOrigin = ref<string | null>(readStored());

export function saveLanOrigin(raw: string): LanOriginCheck {
  const check = normalizeLanOrigin(raw, currentDefaultPort());
  if (check.origin) {
    try { localStorage.setItem(STORAGE_KEY, check.origin); } catch { /* storage unavailable: keep in memory */ }
    lanOrigin.value = check.origin;
  }
  return check;
}

export function clearLanOrigin() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing stored */ }
  lanOrigin.value = null;
}

/** The exact string shown on screen and encoded into the QR; null until a usable LAN origin exists. */
export function buildLanShareUrl(publicPath: string): string | null {
  if (!publicPath.startsWith("/public/")) return null;
  return lanOrigin.value ? lanOrigin.value + publicPath : null;
}
