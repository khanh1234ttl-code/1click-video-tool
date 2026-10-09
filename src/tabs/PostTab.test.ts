import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, tick, unmount } from "svelte";
import PostTab from "./PostTab.svelte";
import { PresetStore } from "../lib/presetStore.svelte";
import { fixture } from "../lib/testFixtures";
import type { Project } from "../lib/types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn(), render: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../lib/overlay", () => ({ ensureFont: async () => "Arial", drawOverlay: vi.fn(), renderOverlayPng: boundary.render }));

let target: HTMLDivElement, instance: ReturnType<typeof mount>, store: PresetStore, p: Project;
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
const button = (label: string) => { const b = [...target.querySelectorAll("button")].find((b) => b.textContent?.trim() === label); if (!b) throw new Error(`Missing button ${label}`); return b; };
const call = (type: string) => boundary.invoke.mock.calls.find((c) => c[0] === type)?.[1];
const row = (stt: number, raw: boolean) => ({ stt, images: [`A/${stt}.png`], prompt: "", text: "", music: null, textOverride: null, status: raw ? { state: "generated" as const } : { state: "pending" as const }, jobId: null, rawVideo: raw ? `A/_1click/raw/00${stt}.mp4` : null, resolvedMusic: null, output: null });

beforeEach(async () => {
  p = fixture("A"); p.rows = [row(1, true), row(2, false), row(3, true)];
  boundary.render.mockClear();
  boundary.invoke.mockReset().mockImplementation(async (type: string) => {
    if (type === "get_project") return p;
    if (type === "list_presets" || type === "list_music" || type === "list_fonts") return [];
    if (["paste_texts", "apply_text_template", "assign_music_in_order"].includes(type)) return 2;
  });
  target = document.createElement("div"); document.body.append(target);
  store = new PresetStore(p, () => {});
  instance = mount(PostTab, { target, props: { project: p, store, toast: () => {} } });
  await settle();
});
afterEach(async () => { await unmount(instance); store.destroy(); target.remove(); });

describe("PostTab export", () => {
  it("exports all rows that have a raw video, overlays first", async () => {
    button("Xuất tất cả (2)").click(); await settle();
    const order = boundary.invoke.mock.calls.map((c) => c[0]).filter((t) => ["save_overlays", "reprocess_rows"].includes(t));
    expect(order).toEqual(["save_overlays", "reprocess_rows"]);
    expect(call("reprocess_rows")).toEqual({ stts: [1, 3] });
  });
  it("exports only checked rows that have a raw video", async () => {
    const boxes = target.querySelectorAll<HTMLInputElement>(".list input[type=checkbox]");
    boxes[2].click(); flushSync(); await settle();
    button("Xuất dòng chọn (1)").click(); await settle();
    expect(call("reprocess_rows")).toEqual({ stts: [3] });
  });
  it("disables export when nothing has been generated", async () => {
    await unmount(instance); p.rows = [row(1, false)];
    instance = mount(PostTab, { target, props: { project: p, store, toast: () => {} } }); await settle();
    const b = button("Xuất tất cả (0)");
    expect(b.disabled).toBe(true); expect(b.title).toContain("Tạo video ở bước 1 trước");
  });
  it("previews the selected row's raw video, or its image when not generated", async () => {
    expect(target.querySelector("video")?.getAttribute("src")).toBe("A/_1click/raw/001.mp4");
    target.querySelectorAll<HTMLElement>(".list .item")[1].click(); await settle();
    expect(target.querySelector("video")).toBeNull();
  });
});

describe("PostTab batch tools", () => {
  it("pastes texts from the selected row", async () => {
    target.querySelectorAll<HTMLElement>(".list .item")[1].click(); await settle();
    button("Dán nhiều text").click(); await settle();
    const area = target.querySelector<HTMLTextAreaElement>(".batch textarea")!;
    area.value = "Một\nHai"; area.dispatchEvent(new Event("input")); flushSync();
    button("Điền").click(); await settle();
    expect(call("paste_texts")).toEqual({ startStt: 2, text: "Một\nHai", imageDir: "A" });
  });
  it("applies a text template to checked rows, or to all when none are checked", async () => {
    button("Text theo mẫu").click(); await settle();
    const input = target.querySelector<HTMLInputElement>('.batch input[placeholder="Tập {stt}"]')!;
    input.value = "Tập {stt}"; input.dispatchEvent(new Event("input")); flushSync();
    button("Áp dụng").click(); await settle();
    expect(call("apply_text_template")).toEqual({ template: "Tập {stt}", stts: [], imageDir: "A" });
  });
  it("assigns music in order after flushing the preset (a just-picked folder must be saved)", async () => {
    store.preset.music.folder = "D:/nhac"; flushSync();
    button("Gán nhạc lần lượt").click(); await settle();
    const types = boundary.invoke.mock.calls.map((c) => c[0]);
    expect(types.indexOf("set_preset")).toBeLessThan(types.indexOf("assign_music_in_order"));
    expect(call("assign_music_in_order")).toEqual({ stts: [], imageDir: "A" });
  });
  it("saves an inline text edit for its row", async () => {
    const input = target.querySelectorAll<HTMLInputElement>('.list input[type="text"]')[0];
    input.value = "Tập 1"; input.dispatchEvent(new Event("change", { bubbles: true })); await settle();
    expect(call("update_row")).toEqual({ edit: expect.objectContaining({ stt: 1, text: "Tập 1" }), imageDir: "A" });
  });
});

describe("PostTab per-row style", () => {
  it("saves a per-row position set on the preview, not only edits in the style form", async () => {
    vi.useFakeTimers();
    try {
      const own = [...target.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].find((i) => i.parentElement?.textContent?.includes("riêng cho video"))!;
      own.click(); flushSync(); await vi.advanceTimersByTimeAsync(400); await settle();
      boundary.invoke.mockClear();
      target.querySelectorAll<HTMLButtonElement>(".snaps button")[0].click(); flushSync();
      await vi.advanceTimersByTimeAsync(400); await settle();
      expect(call("update_row")).toEqual({ edit: expect.objectContaining({ stt: 1, textOverride: expect.objectContaining({ x: 0.15, y: 0.15 }) }), imageDir: "A" });
    } finally { vi.useRealTimers(); }
  });
});
