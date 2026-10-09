import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import App from "./App.svelte";
import { open } from "@tauri-apps/plugin-dialog";
import { fixture } from "./lib/testFixtures";
import type { Project } from "./lib/types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn(), listeners: new Map<string, Function>(), render: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async (name: string, f: Function) => {
  boundary.listeners.set(name, f); return () => boundary.listeners.delete(name);
} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
// The mounted components remain real; only browser drawing/font I/O is replaced.
vi.mock("./lib/overlay", () => ({ ensureFont: async () => "Arial", drawOverlay: vi.fn(), renderOverlayPng: boundary.render }));

function project(dir = "A", prompt = "prompt A"): Project {
  const p = fixture(dir);
  p.rows = [{ stt: 1, imagePath: `${dir}/1.png`, prompt, text: "", music: null, textOverride: null, status: { state: "generated" }, jobId: null, rawVideo: `${dir}/_1click/raw/001.mp4`, resolvedMusic: null, output: null }];
  return p;
}
const deferred = <T = void>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
};
let target: HTMLDivElement, instance: ReturnType<typeof mount> | undefined, active: Project;
let writes: { type: string; args: any }[], toasts: string[];
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
function button(text: string): HTMLButtonElement {
  const b = [...target.querySelectorAll("button")].find(b => b.textContent?.trim() === text);
  if (!b) throw new Error(`Missing button ${text}`); return b;
}
async function choose(hasOption: string, value: string) {
  const select = [...target.querySelectorAll("select")].find(s => [...s.options].some(o => o.value === hasOption))!;
  select.value = value;
  for (const option of select.options) option.selected = option.value === value;
  select.dispatchEvent(new Event("change", { bubbles: true })); await settle();
  expect(select.value).toBe(value);
}
const quality = (v: string) => choose("1080p", v);
const aspect = (v: string) => choose("9:16", v);
async function mountApp() { instance = mount(App, { target }); await settle(); }
beforeEach(() => {
  // happy-dom 20 does not match option:checked; Svelte reads this native selector.
  const nativeQuery = HTMLSelectElement.prototype.querySelector;
  vi.spyOn(HTMLSelectElement.prototype, "querySelector").mockImplementation(function (this: HTMLSelectElement, selector: string) {
    return selector === ":checked" ? [...this.options].find(o => o.selected) ?? null : nativeQuery.call(this, selector);
  });
  vi.useFakeTimers(); active = project(); writes = []; toasts = []; boundary.listeners.clear();
  boundary.render.mockReset().mockImplementation(async () => null);
  vi.mocked(open).mockReset();
  target = document.createElement("div"); document.body.append(target);
  boundary.invoke.mockReset().mockImplementation(async (type: string, args: any) => {
    if (["set_preset", "save_preset", "load_preset", "update_row"].includes(type) && args.imageDir !== active.imageDir) throw new Error("Dự án đã thay đổi");
    if (["set_preset", "save_preset", "load_preset", "start_run", "reprocess_rows", "update_row"].includes(type)) writes.push({ type, args: structuredClone(args) });
    if (type === "get_project") return active;
    if (type === "get_status") return { connected: true, extId: "fake", extVersion: "1", ffmpeg: "ffmpeg", running: false };
    if (type === "list_presets") return ["Loaded"];
    if (type === "list_fonts" || type === "list_music") return [];
    if (type === "set_preset") { active.preset = structuredClone(args.preset); boundary.listeners.get("project")?.({ payload: structuredClone(active) }); }
    if (type === "load_preset") { const loaded = fixture().preset; loaded.gen.quality = "720p"; return loaded; }
  });
});
afterEach(async () => { if (instance) await unmount(instance); instance = undefined; target.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("two-step app keeps ordered, scoped preset edits", () => {
  it("Start waits for the pending preset write and starts with it", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset") await gate.promise; return original(type, args); });
    active.rows[0].status = { state: "pending" }; active.rows[0].rawVideo = null;
    await mountApp(); await quality("1080p"); button("Bắt đầu tạo").click(); await settle();
    expect(writes.some((w) => w.type === "start_run")).toBe(false);
    gate.resolve(); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "start_run"]); expect(active.preset.gen.quality).toBe("1080p");
  });
  it("stays on step 1 when the navigation flush fails", async () => {
    await mountApp(); await quality("1080p");
    boundary.invoke.mockRejectedValue(new Error("disk failed")); button("2. Hậu kỳ").click(); await settle();
    expect(target.textContent).toContain("Bắt đầu tạo"); expect(target.textContent).toContain("disk failed");
  });
  it("never writes A's pending edit into project B", async () => {
    await mountApp(); await quality("1080p");
    active = project("B", "prompt B"); boundary.listeners.get("project")!({ payload: active }); await settle();
    await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes.filter((w) => w.type === "set_preset" && w.args.imageDir !== "A")).toEqual([]);
    expect(active.preset.gen.quality).toBe("720p");
  });
  it("exports with the acknowledged aspect, quality and font size before any project event", async () => {
    const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => {
      if (type !== "set_preset") return original(type, args);
      writes.push({ type, args }); active.preset = structuredClone(args.preset); // deliberately no project event
    });
    await mountApp(); await quality("1080p"); await aspect("9:16"); button("2. Hậu kỳ").click(); await settle();
    const size = [...target.querySelectorAll<HTMLInputElement>('input[type="number"]')].find((i) => i.min === "12")!;
    size.value = "80"; size.dispatchEvent(new Event("input", { bubbles: true })); await settle();
    button("Xuất tất cả (1)").click(); await settle();
    expect(boundary.render).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 80 }), expect.any(String), 1080, 1920);
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "set_preset", "reprocess_rows"]);
  });
  it("locks the page while the acknowledged project refresh is pending", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!; let reads = 0;
    boundary.invoke.mockImplementation((type: string, args: any) => type === "get_project" && ++reads === 2 ? gate.promise : original(type, args));
    await mountApp(); await quality("1080p"); button("2. Hậu kỳ").click(); await settle();
    expect(target.querySelector("main")?.hasAttribute("inert")).toBe(true);
    expect(target.textContent).not.toContain("Xuất tất cả");
    gate.resolve(structuredClone(active)); await settle();
    expect(target.textContent).toContain("Xuất tất cả"); expect(active.preset.gen.quality).toBe("1080p");
  });
  it("unlocks B and ignores the stale refresh when the project changes during navigation", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!; let reads = 0;
    boundary.invoke.mockImplementation((type: string, args: any) => type === "get_project" && ++reads === 2 ? gate.promise : original(type, args));
    await mountApp(); await quality("1080p"); button("2. Hậu kỳ").click(); await settle();
    const stale = structuredClone(active);
    active = project("B", "prompt B"); boundary.listeners.get("project")!({ payload: active }); await settle();
    gate.resolve(stale); await settle();
    expect(target.querySelector("main")?.hasAttribute("inert")).toBe(false);
    const select = [...target.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "1080p"))!;
    expect(select.value).toBe("720p");
  });
  it("blocks steps and folder picking while export overlays are prepared", async () => {
    const gate = deferred<null>(); boundary.render.mockImplementationOnce(() => gate.promise);
    await mountApp(); button("2. Hậu kỳ").click(); await settle();
    button("Xuất tất cả (1)").click(); await settle();
    expect(button("1. Tạo video").disabled).toBe(true);
    button("1. Tạo video").dispatchEvent(new MouseEvent("click", { bubbles: true })); await settle();
    expect(target.textContent).toContain("Xuất tất cả"); expect(writes.some((w) => w.type === "reprocess_rows")).toBe(false);
    gate.resolve(null); await settle();
    expect(writes.map((w) => w.type)).toEqual(["reprocess_rows"]); expect(button("1. Tạo video").disabled).toBe(false);
  });
  it("blocks navigation and Start while an earlier folder-open request is pending", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!;
    vi.mocked(open).mockResolvedValue("B");
    boundary.invoke.mockImplementation(async (type: string, args: any) => {
      if (type !== "open_project") return original(type, args);
      active = await gate.promise; boundary.listeners.get("project")!({ payload: active }); return active;
    });
    await mountApp(); button("Chọn folder ảnh").click(); await settle();
    expect(button("2. Hậu kỳ").disabled).toBe(true); expect(button("Bắt đầu tạo").disabled).toBe(true);
    gate.resolve(project("B", "prompt B")); await settle();
    expect(button("2. Hậu kỳ").disabled).toBe(false); expect(target.querySelector<HTMLInputElement>('tbody input[type="text"]')!.value).toBe("prompt B");
  });
  it("saves and loads named presets from the header", async () => {
    await mountApp(); await quality("1080p");
    const name = target.querySelector<HTMLInputElement>('[placeholder="Tên preset"]')!;
    name.value = "Kênh A"; name.dispatchEvent(new Event("input", { bubbles: true }));
    button("Lưu").click(); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "save_preset"]);
    const pick = target.querySelector<HTMLSelectElement>('[aria-label="Nạp preset"]')!;
    pick.value = "Loaded"; for (const o of pick.options) o.selected = o.value === "Loaded";
    pick.dispatchEvent(new Event("change", { bubbles: true })); await settle();
    expect(writes.at(-1)!.type).toBe("load_preset");
  });
});

describe("Ẩn Chrome", () => {
  it("hides the Vids window from the header and offers to show it again", async () => {
    await mountApp();
    button("Ẩn Chrome").click(); await settle();
    expect(boundary.invoke).toHaveBeenCalledWith("set_hide_chrome", { hide: true });
    boundary.listeners.get("status")!({ payload: { connected: true, extId: "fake", extVersion: "1", ffmpeg: "ffmpeg", running: false, hideChrome: true, chromeWindow: true } });
    await settle();
    button("Hiện Chrome").click(); await settle();
    expect(boundary.invoke).toHaveBeenCalledWith("set_hide_chrome", { hide: false });
  });
});
