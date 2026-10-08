import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import PresetTab from "./PresetTab.svelte";
import App from "../App.svelte";
import { open } from "@tauri-apps/plugin-dialog";
import type { Project } from "../lib/types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn(), listeners: new Map<string, Function>(), render: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async (name: string, f: Function) => {
  boundary.listeners.set(name, f); return () => boundary.listeners.delete(name);
} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
// The mounted components remain real; only browser drawing/font I/O is replaced.
vi.mock("../lib/overlay", () => ({ ensureFont: async () => "Arial", drawOverlay: vi.fn(), renderOverlayPng: boundary.render }));

function project(dir = "A", prompt = "prompt A"): Project {
  return { version: 1, imageDir: dir, commonPrompt: "", preset: {
    gen: { mode: "imageToVideo", aspectRatio: "16:9", quality: "720p", concurrency: 3, maxRetries: 0 },
    text: { fontFamily: "Arial", fontFile: null, fontSize: 50, bold: false, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, shadow: false, boxEnabled: false, boxColor: "#000000", boxOpacity: 0, boxRadius: 0, boxPadding: 0, align: "center", maxWidth: .8, x: .5, y: .5 },
    music: { folder: null, mode: "random", fallback: "random", musicVolume: .25, originalVolume: 1, fadeIn: 1, fadeOut: 1 },
    output: { folder: null, overwrite: false },
  }, rows: [{ stt: 1, imagePath: `${dir}/1.png`, prompt, text: "", music: null, textOverride: null, status: { state: "pending" }, jobId: null, rawVideo: null, resolvedMusic: null, output: null }] };
}
const deferred = <T = void>() => {
  let resolve!: (v: T) => void, reject!: (e: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let target: HTMLDivElement, instance: ReturnType<typeof mount>, active: Project;
let writes: { type: string; args: any }[], toasts: string[];
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
function button(text: string): HTMLButtonElement {
  const b = [...target.querySelectorAll("button")].find(b => b.textContent?.trim() === text);
  if (!b) throw new Error(`Missing button ${text}`); return b;
}
async function quality(value = "1080p") {
  const select = [...target.querySelectorAll("select")].find(s => [...s.options].some(o => o.value === "1080p"))!;
  select.value = value;
  for (const option of select.options) option.selected = option.value === value;
  select.dispatchEvent(new Event("change", { bubbles: true })); await settle();
  expect(select.value).toBe(value);
}
async function name(value = "Test") {
  const input = target.querySelector<HTMLInputElement>('[placeholder="Tên preset"]')!;
  input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); await settle();
}
async function mountPreset() { instance = mount(PresetTab, { target, props: { project: active, toast: (s: string) => toasts.push(s) } }); await settle(); }
async function mountApp() { instance = mount(App, { target }); await settle(); }
beforeEach(() => {
  // happy-dom 20 does not match option:checked; Svelte reads this native selector.
  const nativeQuery = HTMLSelectElement.prototype.querySelector;
  vi.spyOn(HTMLSelectElement.prototype, "querySelector").mockImplementation(function (this: HTMLSelectElement, selector: string) {
    return selector === ":checked" ? [...this.options].find(o => o.selected) ?? null : nativeQuery.call(this, selector);
  });
  vi.useFakeTimers(); active = project(); writes = []; toasts = []; boundary.listeners.clear();
  boundary.render.mockClear();
  vi.mocked(open).mockReset();
  target = document.createElement("div"); document.body.append(target);
  boundary.invoke.mockReset().mockImplementation(async (type: string, args: any) => {
    if (["set_preset", "save_preset", "load_preset", "update_row"].includes(type) && args.imageDir !== active.imageDir) throw new Error("Dự án đã thay đổi");
    if (["set_preset", "save_preset", "load_preset", "start_run", "update_row"].includes(type)) writes.push({ type, args: structuredClone(args) });
    if (type === "get_project") return active;
    if (type === "get_status") return { connected: true, extId: "fake", extVersion: "1", ffmpeg: "ffmpeg", running: false };
    if (type === "list_presets") return ["Loaded"];
    if (type === "list_fonts" || type === "list_music") return [];
    if (type === "set_preset") { active.preset = structuredClone(args.preset); boundary.listeners.get("project")?.({ payload: structuredClone(active) }); }
    if (type === "load_preset") { const loaded = project().preset; loaded.gen.quality = "720p"; return loaded; }
  });
});
afterEach(async () => { if (instance) await unmount(instance); target.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("ordered scoped preset editing", () => {
  it("flushes 1080p before immediate named Save", async () => {
    await mountPreset(); await quality(); await name(); button("Lưu").click(); await settle();
    expect(writes.map(w => w.type)).toEqual(["set_preset", "save_preset"]);
    expect(writes[0].args.preset.gen.quality).toBe("1080p");
    expect(writes[0].args.imageDir).toBe("A"); expect(toasts).toContain("Đã lưu preset");
  });
  it.each(["set_preset", "save_preset"])("does not announce success when %s fails", async (failed) => {
    const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation((type: string, args: any) => type === failed ? Promise.reject(new Error("disk failed")) : original(type, args));
    await mountPreset(); await quality(); await name(); button("Lưu").click(); await settle();
    expect(toasts).not.toContain("Đã lưu preset"); expect(toasts.some(t => String(t).includes("disk failed"))).toBe(true);
    if (failed === "set_preset") expect(writes.some(w => w.type === "save_preset")).toBe(false);
  });
  it("blocks Run and start until the pending write resolves", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset") await gate.promise; return original(type, args); });
    await mountApp(); button("Preset").click(); await settle(); await quality(); button("Chạy").click(); await settle();
    expect(target.textContent).not.toContain("Bắt đầu"); expect(writes.some(w => w.type === "start_run")).toBe(false);
    gate.resolve(); await settle(); button("Bắt đầu").click(); await settle();
    expect(writes.map(w => w.type)).toEqual(["set_preset", "start_run"]); expect(active.preset.gen.quality).toBe("1080p");
  });
  it("keeps Preset open when navigation flush fails", async () => {
    await mountApp(); button("Preset").click(); await settle(); await quality();
    boundary.invoke.mockRejectedValue(new Error("disk failed")); button("Chạy").click(); await settle();
    expect(target.textContent).not.toContain("Bắt đầu"); expect(target.textContent).toContain("disk failed");
  });
  it("cancels an unmounted A debounce instead of writing to B", async () => {
    await mountApp(); button("Preset").click(); await settle(); await quality();
    active = project("B", "prompt B"); boundary.listeners.get("project")!({ payload: active }); await settle();
    await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes.filter(w => w.type === "set_preset" && w.args.imageDir !== "A")).toEqual([]);
    expect(active.preset.gen.quality).toBe("720p");
  });
  it("does not leave a write timer after unmount", async () => {
    await mountPreset(); await quality(); await unmount(instance); instance = undefined!;
    await vi.advanceTimersByTimeAsync(400); expect(writes).toEqual([]);
  });
  it("flushes local edits before loading and never writes an older snapshot after load", async () => {
    await mountPreset(); await quality(); button("Loaded").click(); await settle();
    await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes.map(w => w.type)).toEqual(["set_preset", "load_preset"]);
    expect(writes[0].args.preset.gen.quality).toBe("1080p");
    const select = [...target.querySelectorAll("select")].find(s => [...s.options].some(o => o.value === "1080p"))!;
    expect(select.value).toBe("720p"); expect(writes[1].args.imageDir).toBe("A");
  });
  it("serializes a pending autosave before a newer immediate Save", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let calls = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset" && ++calls === 1) await gate.promise; return original(type, args); });
    await mountPreset(); await quality(); await vi.advanceTimersByTimeAsync(400); await quality("720p"); await name(); button("Lưu").click(); await settle();
    expect(writes).toEqual([]); gate.resolve(); await settle();
    expect(writes.map(w => w.type)).toEqual(["set_preset", "set_preset", "save_preset"]);
    expect(writes[1].args.preset.gen.quality).toBe("720p");
  });
  it("resets selected row fields when project B also has STT 1", async () => {
    await mountApp(); target.querySelector<HTMLTableRowElement>("tbody tr")!.click(); await settle();
    expect(target.querySelector<HTMLTextAreaElement>(".panel textarea")!.value).toBe("prompt A");
    active = project("B", "prompt B"); boundary.listeners.get("project")!({ payload: active }); await settle();
    expect(target.querySelector(".panel")).toBeNull();
    target.querySelector<HTMLTableRowElement>("tbody tr")!.click(); await settle();
    expect(target.querySelector<HTMLTextAreaElement>(".panel textarea")!.value).toBe("prompt B");
    button("Lưu").click(); await settle(); expect(writes[0].args.imageDir).toBe("B"); expect(writes[0].args.edit.prompt).toBe("prompt B");
  });
  it("uses the acknowledged quality/aspect/text for Run even before the project event", async () => {
    const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => {
      if (type !== "set_preset") return original(type, args);
      writes.push({ type, args }); active.preset = structuredClone(args.preset); // deliberately no project event
    });
    await mountApp(); button("Preset").click(); await settle(); await quality();
    const aspect = [...target.querySelectorAll("select")].find(s => [...s.options].some(o => o.value === "9:16"))!;
    aspect.value = "9:16"; aspect.dispatchEvent(new Event("change", { bubbles: true }));
    const size = [...target.querySelectorAll<HTMLInputElement>('input[type="number"]')].find(i => i.min === "12")!;
    size.value = "80"; size.dispatchEvent(new Event("input", { bubbles: true }));
    button("Chạy").click(); await settle(); button("Bắt đầu").click(); await settle();
    expect(boundary.render).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 80 }), "", 1080, 1920);
    expect(writes.map(w => w.type)).toEqual(["set_preset", "start_run"]);
  });
  it("ignores an old successful row Save callback after selecting B", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation((type: string, args: any) => type === "update_row" ? gate.promise : original(type, args));
    await mountApp(); target.querySelector<HTMLTableRowElement>("tbody tr")!.click(); await settle(); button("Lưu").click(); await settle();
    active = project("B", "prompt B"); boundary.listeners.get("project")!({ payload: active }); await settle();
    target.querySelector<HTMLTableRowElement>("tbody tr")!.click(); await settle();
    gate.resolve(); await settle(); expect(target.querySelector<HTMLTextAreaElement>(".panel textarea")!.value).toBe("prompt B");
  });
  it("orders two pending loads and does not restore a pre-load edit between them", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let calls = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => {
      if (type === "list_presets") return ["First", "Second"];
      if (type !== "load_preset") return original(type, args);
      if (++calls === 1) await gate.promise;
      writes.push({ type, args }); const p = project().preset; p.gen.quality = args.name === "Second" ? "1080p" : "720p"; return p;
    });
    await mountPreset(); await quality(); button("First").click(); await settle(); button("Second").click(); await settle();
    expect(calls).toBe(1); gate.resolve(); await settle(); await vi.advanceTimersByTimeAsync(400);
    expect(writes.map(w => w.type)).toEqual(["set_preset", "load_preset", "load_preset"]);
    expect(target.querySelector<HTMLInputElement>('[placeholder="Tên preset"]')!.value).toBe("Second");
  });
  it("flushes an edit made while navigation is waiting on the first write", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let calls = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset" && ++calls === 1) await gate.promise; return original(type, args); });
    await mountApp(); button("Preset").click(); await settle(); await quality(); button("Chạy").click(); await settle();
    await quality("720p"); gate.resolve(); await settle();
    expect(writes.map(w => w.args?.preset?.gen.quality)).toEqual(["1080p", "720p"]);
    expect(active.preset.gen.quality).toBe("720p"); expect(target.textContent).toContain("Bắt đầu");
  });
  it("discards a queued load after unmount without a backend call", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset") await gate.promise; return original(type, args); });
    await mountPreset(); await quality(); await vi.advanceTimersByTimeAsync(400); button("Loaded").click(); await settle();
    await unmount(instance); instance = undefined!; gate.resolve(); await settle();
    expect(writes.map(w => w.type)).toEqual(["set_preset"]); expect(toasts).toEqual([]);
  });
  it("blocks editing while the acknowledged project refresh is pending", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!; let reads = 0;
    boundary.invoke.mockImplementation((type: string, args: any) => type === "get_project" && ++reads === 2 ? gate.promise : original(type, args));
    await mountApp(); button("Preset").click(); await settle(); await quality(); button("Chạy").click(); await settle();
    expect(target.querySelector<HTMLFieldSetElement>("fieldset.cols")?.disabled).toBe(true);
    expect(target.querySelector(".cols")?.hasAttribute("inert")).toBe(true);
    expect(target.textContent).not.toContain("Bắt đầu");
    gate.resolve(structuredClone(active)); await settle();
    expect(target.textContent).toContain("Bắt đầu"); expect(active.preset.gen.quality).toBe("1080p");
  });
  it("unlocks B and ignores the stale refresh when the project changes during navigation", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!; let reads = 0;
    boundary.invoke.mockImplementation((type: string, args: any) => type === "get_project" && ++reads === 2 ? gate.promise : original(type, args));
    await mountApp(); button("Preset").click(); await settle(); await quality(); button("Chạy").click(); await settle();
    const stale = structuredClone(active);
    active = project("B", "prompt B"); boundary.listeners.get("project")!({ payload: active }); await settle();
    gate.resolve(stale); await settle();
    expect(target.querySelector<HTMLFieldSetElement>("fieldset.cols")?.disabled).toBe(false);
    expect(target.textContent).not.toContain("Bắt đầu");
    const select = [...target.querySelectorAll("select")].find(s => [...s.options].some(o => o.value === "1080p"))!;
    expect(select.value).toBe("720p");
  });
  it("blocks Source and project switching throughout Run overlay preparation", async () => {
    const gate = deferred<null>(); boundary.render.mockImplementationOnce(() => gate.promise);
    await mountApp(); button("Chạy").click(); await settle();
    button("Bắt đầu").click(); button("Bắt đầu").click(); await settle();
    expect(button("Nguồn").disabled).toBe(true); expect(button("Preset").disabled).toBe(true);
    button("Bắt đầu").dispatchEvent(new MouseEvent("click", { bubbles: true })); await settle();
    expect(boundary.render).toHaveBeenCalledTimes(1);
    button("Nguồn").click(); await settle();
    button("Nguồn").dispatchEvent(new MouseEvent("click", { bubbles: true })); await settle();
    expect(target.textContent).not.toContain("Chọn folder ảnh"); expect(writes.some(w => w.type === "start_run")).toBe(false);
    gate.resolve(null); await settle(); expect(writes.map(w => w.type)).toEqual(["start_run"]); expect(button("Nguồn").disabled).toBe(false);
  });
  it("blocks navigation and Run while an earlier folder-open request is pending", async () => {
    const gate = deferred<Project>(); const original = boundary.invoke.getMockImplementation()!;
    vi.mocked(open).mockResolvedValue("B");
    boundary.invoke.mockImplementation(async (type: string, args: any) => {
      if (type !== "open_project") return original(type, args);
      active = await gate.promise; boundary.listeners.get("project")!({ payload: active }); return active;
    });
    await mountApp(); button("Chọn folder ảnh").click(); await settle();
    expect(button("Chạy").disabled).toBe(true); expect(button("Preset").disabled).toBe(true);
    button("Chạy").dispatchEvent(new MouseEvent("click", { bubbles: true })); await settle();
    expect(target.textContent).not.toContain("Bắt đầu"); expect(writes.some(w => w.type === "start_run")).toBe(false);
    gate.resolve(project("B", "prompt B")); await settle();
    expect(button("Chạy").disabled).toBe(false); expect(target.textContent).toContain("prompt B");
    button("Chạy").click(); await settle(); expect(target.textContent).toContain("Bắt đầu");
  });
});
