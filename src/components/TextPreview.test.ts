import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import TextPreview from "./TextPreview.svelte";
import { previewProps } from "./previewProps.svelte";
import type { TextStyle } from "../lib/types";

const fonts = vi.hoisted(() => ({ pending: [] as { style: TextStyle; resolve: (f: string) => void }[], draw: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (p: string) => p }));
// Only font loading and Canvas drawing are replaced; the component is real.
vi.mock("../lib/overlay", () => ({
  ensureFont: (style: TextStyle) => new Promise<string>((resolve) => fonts.pending.push({ style, resolve })),
  drawOverlay: fonts.draw,
}));

const style: TextStyle = { fontFamily: "Arial", fontFile: null, fontSize: 50, bold: false, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, shadow: false, boxEnabled: false, boxColor: "#000000", boxOpacity: 0, boxRadius: 0, boxPadding: 0, align: "center", maxWidth: .8, x: .5, y: .5 };
let target: HTMLDivElement, instance: ReturnType<typeof mount>;
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
async function resolveAll() { for (const p of fonts.pending.splice(0)) p.resolve("Arial"); await settle(); }
const lastDraw = () => fonts.draw.mock.calls.at(-1)!;

beforeEach(() => {
  fonts.pending.length = 0;
  fonts.draw.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  target = document.createElement("div");
  document.body.append(target);
});
afterEach(async () => { if (instance) await unmount(instance); target.remove(); vi.restoreAllMocks(); });

describe("TextPreview redraws", () => {
  it("redraws at the new size when only the dimensions change", async () => {
    const p = previewProps({ style, text: "Tập 1", w: 1280, h: 720 });
    instance = mount(TextPreview, { target, props: p.props });
    await settle(); await resolveAll();
    expect(lastDraw().slice(4)).toEqual([1280, 720]);
    p.set({ w: 720, h: 1280 });
    await settle(); await resolveAll();
    expect(lastDraw().slice(4)).toEqual([720, 1280]);
    const canvas = target.querySelector("canvas")!;
    expect([canvas.width, canvas.height]).toEqual([720, 1280]);
  });

  it("ignores a slower, older font load that resolves after a newer one", async () => {
    const p = previewProps({ style, text: "cũ", w: 1280, h: 720 });
    instance = mount(TextPreview, { target, props: p.props });
    await settle();
    p.set({ text: "mới" });
    await settle();
    expect(fonts.pending).toHaveLength(2);
    const [older, newer] = fonts.pending.splice(0);
    newer.resolve("Arial"); await settle();
    older.resolve("Arial"); await settle();
    expect(fonts.draw).toHaveBeenCalledTimes(1);
    expect(lastDraw()[3]).toBe("mới");
  });
});
