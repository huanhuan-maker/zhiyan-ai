import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import QRCode from "qrcode";
import ShareQrCard from "./ShareQrCard.vue";
import { lanOrigin } from "../api/sharing";

vi.mock("qrcode", () => ({ default: { toCanvas: vi.fn(async () => undefined) } }));
const toCanvas = vi.mocked(QRCode.toCanvas);

beforeEach(() => { localStorage.clear(); toCanvas.mockClear(); lanOrigin.value = null; });

const TOKEN = "AbCdEfGh12345_IjKlMnOpQrStUvWxYz43AbCdEfGh123";
interface CardProps { versionNumber: number; publicPath: string; previewUrl: string; versionStatus?: string; surveyStatus?: string }
function mountCard(overrides: Partial<CardProps> = {}) {
  const props: CardProps = { versionNumber: 1, publicPath: `/public/${TOKEN}`, previewUrl: `http://127.0.0.1:5173/public/${TOKEN}`, ...overrides };
  return mount(ShareQrCard, { props });
}
function phoneLinkOf(wrapper: ReturnType<typeof mountCard>): string {
  return (wrapper.find('input[aria-label="手机局域网分享链接"]').element as HTMLInputElement).value;
}

describe("ShareQrCard", () => {
  it("encodes exactly the displayed LAN URL into the QR", async () => {
    lanOrigin.value = "http://192.168.137.1:5173";
    const wrapper = mountCard();
    const expected = `http://192.168.137.1:5173/public/${TOKEN}`;
    expect(phoneLinkOf(wrapper)).toBe(expected);
    await Promise.resolve();
    expect(toCanvas).toHaveBeenCalledTimes(1);
    expect(toCanvas.mock.calls[0]![1]).toBe(expected);
    expect(toCanvas.mock.calls[0]![0]).toBeInstanceOf(HTMLCanvasElement);
  });

  it("regenerates the QR when the token rotates", async () => {
    lanOrigin.value = "http://192.168.137.1:5173";
    const wrapper = mountCard();
    const rotated = "ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210ZyXwVuTsRqP";
    await wrapper.setProps({ publicPath: `/public/${rotated}`, previewUrl: `http://127.0.0.1:5173/public/${rotated}` });
    const expected = `http://192.168.137.1:5173/public/${rotated}`;
    expect(phoneLinkOf(wrapper)).toBe(expected);
    await Promise.resolve();
    expect(toCanvas).toHaveBeenCalledTimes(2);
    expect(toCanvas.mock.calls[1]![1]).toBe(expected);
  });

  it("shows a setup prompt instead of a phone-unreachable QR before the LAN origin is configured", async () => {
    const wrapper = mountCard();
    await Promise.resolve();
    expect(toCanvas).not.toHaveBeenCalled();
    expect(wrapper.find("canvas").exists()).toBe(false);
    expect(wrapper.find(".qr-missing").text()).toContain("未配置局域网地址");
    expect(phoneLinkOf(wrapper)).toContain("未配置局域网地址");
    expect(wrapper.findAll("button").every(b => b.attributes("disabled") !== undefined)).toBe(true);
  });

  it("keeps the preview link separate from the phone share link", () => {
    lanOrigin.value = "http://192.168.137.1:5173";
    const wrapper = mountCard();
    const preview = wrapper.find(".qr-preview-line");
    expect(preview.text()).toContain("仅此电脑可打开");
    expect(preview.text()).toContain(`http://127.0.0.1:5173/public/${TOKEN}`);
    expect(phoneLinkOf(wrapper)).not.toContain("127.0.0.1");
  });

  it("warns that a closed version cannot collect answers", () => {
    lanOrigin.value = "http://192.168.137.1:5173";
    const wrapper = mountCard({ versionStatus: "CLOSED" });
    expect(wrapper.text()).toContain("已停止收集");
    expect(wrapper.text()).toContain("无法再填写或提交");
  });
});
