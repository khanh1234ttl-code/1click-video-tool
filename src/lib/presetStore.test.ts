import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, tick } from "svelte";
import { PresetStore } from "./presetStore.svelte";
import { fixture } from "./testFixtures";

const boundary = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));

const deferred = <T = void>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((y) => { resolve = y; }); return { promise, resolve }; };
let writes: { type: string; args: any }[], toasts: string[], store: PresetStore | null, active: string;
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
const make = () => (store = new PresetStore(fixture("A"), (t) => toasts.push(t)));
function edit(quality: "720p" | "1080p") { store!.preset.gen.quality = quality; flushSync(); }

beforeEach(() => {
  vi.useFakeTimers(); writes = []; toasts = []; store = null; active = "A";
  boundary.invoke.mockReset().mockImplementation(async (type: string, args: any) => {
    if (["set_preset", "save_preset", "load_preset"].includes(type) && args.imageDir !== active) throw new Error("Dự án đã thay đổi");
    if (["set_preset", "save_preset", "load_preset"].includes(type)) writes.push({ type, args: structuredClone(args) });
    if (type === "list_presets") return ["First", "Second"];
    if (type === "load_preset") { const p = fixture().preset; p.gen.quality = args.name === "Second" ? "1080p" : "720p"; return p; }
  });
});
afterEach(() => { store?.destroy(); vi.useRealTimers(); });

describe("PresetStore", () => {
  it("debounces an edit into one scoped write", async () => {
    make(); edit("1080p"); await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes).toEqual([{ type: "set_preset", args: { preset: expect.objectContaining({ gen: expect.objectContaining({ quality: "1080p" }) }), imageDir: "A" } }]);
  });
  it("flushes 1080p before an immediate named Save", async () => {
    make(); edit("1080p"); await store!.save("Test"); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "save_preset"]);
    expect(writes[0].args.preset.gen.quality).toBe("1080p"); expect(toasts).toContain("Đã lưu preset");
  });
  it.each(["set_preset", "save_preset"])("does not announce success when %s fails", async (failed) => {
    const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation((type: string, args: any) => type === failed ? Promise.reject(new Error("disk failed")) : original(type, args));
    make(); edit("1080p"); await store!.save("Test"); await settle();
    expect(toasts).not.toContain("Đã lưu preset"); expect(toasts.some((t) => t.includes("disk failed"))).toBe(true);
  });
  it("leaves no write timer after destroy", async () => {
    make(); edit("1080p"); store!.destroy(); store = null;
    await vi.advanceTimersByTimeAsync(400); expect(writes).toEqual([]);
  });
  it("flushes local edits before loading and never writes an older snapshot after load", async () => {
    make(); edit("1080p"); await store!.load("First"); await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "load_preset"]);
    expect(writes[0].args.preset.gen.quality).toBe("1080p"); expect(store!.preset.gen.quality).toBe("720p");
  });
  it("serializes a pending autosave before a newer immediate Save", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let calls = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset" && ++calls === 1) await gate.promise; return original(type, args); });
    make(); edit("1080p"); await vi.advanceTimersByTimeAsync(400); edit("720p");
    const saving = store!.save("Test"); await settle(); expect(writes).toEqual([]);
    gate.resolve(); await saving; await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "set_preset", "save_preset"]);
    expect(writes[1].args.preset.gen.quality).toBe("720p");
  });
  it("orders two pending loads and does not restore a pre-load edit between them", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let loads = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "load_preset" && ++loads === 1) await gate.promise; return original(type, args); });
    make(); edit("1080p"); const a = store!.load("First"); const b = store!.load("Second"); await settle();
    gate.resolve(); await a; await b; await vi.advanceTimersByTimeAsync(400); await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset", "load_preset", "load_preset"]);
    expect(store!.name).toBe("Second"); expect(store!.preset.gen.quality).toBe("1080p");
  });
  it("discards a queued load after destroy without a backend call", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset") await gate.promise; return original(type, args); });
    make(); edit("1080p"); await vi.advanceTimersByTimeAsync(400); const load = store!.load("First");
    store!.destroy(); store = null; gate.resolve(); await load; await settle();
    expect(writes.map((w) => w.type)).toEqual(["set_preset"]); expect(toasts).toEqual([]);
  });
  it("adopts a preset changed elsewhere (an agent) when the UI has nothing unsaved", async () => {
    make();
    const agent = fixture().preset; agent.gen.quality = "1080p";
    store!.adopt(agent); flushSync(); await vi.advanceTimersByTimeAsync(400); await settle();
    expect(store!.preset.gen.quality).toBe("1080p");
    expect(writes).toEqual([]); // adopting is not a new UI edit
  });
  it("keeps unsaved UI edits instead of adopting an outside change", async () => {
    make(); edit("1080p");
    const agent = fixture().preset; agent.gen.aspectRatio = "9:16";
    store!.adopt(agent); flushSync();
    expect(store!.preset.gen.quality).toBe("1080p");
    expect(store!.preset.gen.aspectRatio).toBe("16:9");
  });
  it("flush writes an edit made while the first write is pending", async () => {
    const gate = deferred(); const original = boundary.invoke.getMockImplementation()!; let calls = 0;
    boundary.invoke.mockImplementation(async (type: string, args: any) => { if (type === "set_preset" && ++calls === 1) await gate.promise; return original(type, args); });
    make(); edit("1080p"); const f = store!.flush(); await settle(); edit("720p"); gate.resolve(); await f; await settle();
    expect(writes.map((w) => w.args.preset.gen.quality)).toEqual(["1080p", "720p"]);
  });
});
