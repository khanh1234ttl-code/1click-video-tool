import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, tick, unmount } from "svelte";
import { ask, open } from "@tauri-apps/plugin-dialog";
import GenerateTab from "./GenerateTab.svelte";
import { reactiveStatus } from "./reactiveStatus.svelte";
import { PresetStore } from "../lib/presetStore.svelte";
import { fixture } from "../lib/testFixtures";
import type { Project, Row, Status } from "../lib/types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), ask: vi.fn(async () => true) }));
// The mounted component stays real; only Canvas/font work is replaced.
vi.mock("../lib/overlay", () => ({ ensureFont: async () => "Arial", drawOverlay: vi.fn(), renderOverlayPng: async () => null }));

const row = (stt: number): Row => ({ stt, images: [`A/${stt}.png`], prompt: "", text: "", music: null, textOverride: null, status: { state: "pending" }, jobId: null, rawVideo: null, resolvedMusic: null, output: null });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
};
const idle: Status = { connected: true, extId: "x", extVersion: "1", ffmpeg: "ffmpeg", running: false };
const running: Status = { ...idle, running: true };

let target: HTMLDivElement, instance: ReturnType<typeof mount> | undefined, busyChanges: boolean[], store: PresetStore;
let start: ReturnType<typeof deferred>, pause: ReturnType<typeof deferred>, status: ReturnType<typeof reactiveStatus>, fixtureProject: Project;
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
function button(prefix: string): HTMLButtonElement {
  const b = [...target.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(prefix));
  if (!b) throw new Error(`Missing button ${prefix}`);
  return b;
}
// Actions only: store/bookkeeping reads are not what these tests are about.
const calls = () => boundary.invoke.mock.calls.map((c) => c[0]).filter((c) => !["list_presets", "get_project", "list_music"].includes(c));
const locked = () => busyChanges.at(-1) ?? false;

async function mountGen(initial: Status) {
  status = reactiveStatus(initial);
  store = new PresetStore(fixtureProject, () => {});
  instance = mount(GenerateTab, { target, props: {
    project: fixtureProject,
    store,
    get status() { return status.status; },
    toast: () => {},
    onBusyChange: (b: boolean) => busyChanges.push(b),
  } });
  await settle();
}

/** Clicks Start; start_run stays pending while the engine already reports running. */
async function startPending() {
  await mountGen(idle);
  button("Bắt đầu tạo").click();
  await settle();
  expect(calls()).toEqual(["start_run"]);
  status.set(running);
  await settle();
}

beforeEach(() => {
  busyChanges = [];
  start = deferred();
  pause = deferred();
  fixtureProject = fixture("A");
  fixtureProject.rows = [row(1), row(2), row(3)];
  target = document.createElement("div");
  document.body.append(target);
  boundary.invoke.mockReset().mockImplementation(async (type: string) => {
    if (type === "start_run") return start.promise;
    if (type === "pause_run") return pause.promise;
    if (type === "get_project") return fixtureProject;
    if (type === "paste_prompts") return 2;
    if (type === "list_presets" || type === "list_music") return [];
  });
});
afterEach(async () => { if (instance) await unmount(instance); instance = undefined; store?.destroy(); target.remove(); });

describe("Dừng while Start is still preparing", () => {
  it("keeps Dừng usable and calls pause_run while start_run is pending", async () => {
    await startPending();
    expect(button("Dừng").disabled).toBe(false);
    button("Dừng").click();
    await settle();
    expect(calls()).toEqual(["start_run", "pause_run"]);
  });

  it.each([["pause settles first", true], ["start settles first", false]])("keeps navigation locked until start and pause both settle (%s)", async (_label, pauseFirst) => {
    await startPending();
    button("Dừng").click();
    await settle();
    expect(locked()).toBe(true);
    (pauseFirst ? pause : start).resolve();
    await settle();
    expect(locked()).toBe(true);
    (pauseFirst ? start : pause).resolve();
    await settle();
    expect(locked()).toBe(false);
  });

  it("still blocks a second Start and Retry while the first Start is pending", async () => {
    await mountGen(idle);
    button("Bắt đầu tạo").click();
    await settle();
    button("Bắt đầu tạo").click();
    await settle();
    expect(calls().filter((c) => c === "start_run")).toHaveLength(1);
    expect(button("Bắt đầu tạo").disabled).toBe(true);
    expect(button("Thử lại").disabled).toBe(true);
  });

  it("does not send a second pause_run while one is pending", async () => {
    await startPending();
    button("Dừng").click();
    await settle();
    button("Dừng").click();
    await settle();
    expect(calls().filter((c) => c === "pause_run")).toHaveLength(1);
  });
});

describe("Start and rows", () => {
  it("does not render overlays on Start when auto post-processing is off", async () => {
    await mountGen(idle);
    button("Bắt đầu tạo").click(); await settle();
    expect(calls()).toEqual(["start_run"]);
  });
  it("renders overlays first when auto post-processing is on", async () => {
    fixtureProject.preset.gen.autoPostProcess = true;
    await mountGen(idle);
    button("Bắt đầu tạo").click(); await settle();
    expect(calls()).toEqual(["save_overlays", "start_run"]);
  });
  it("saves an inline prompt edit to its own row and project", async () => {
    await mountGen(idle);
    const input = target.querySelector<HTMLInputElement>('tbody tr input[type="text"]')!;
    input.value = "sóng vỗ"; input.dispatchEvent(new Event("change", { bubbles: true })); await settle();
    expect(boundary.invoke).toHaveBeenCalledWith("update_row", { edit: expect.objectContaining({ stt: 1, prompt: "sóng vỗ" }), imageDir: "A" });
  });
  it("disables Bắt đầu tạo when no row is waiting", async () => {
    for (const r of fixtureProject.rows) { r.status = { state: "generated" }; r.rawVideo = `A/_1click/raw/00${r.stt}.mp4`; }
    await mountGen(idle);
    expect(button("Bắt đầu tạo").disabled).toBe(true);
  });
  it("counts generated rows and shows Xem for them", async () => {
    fixtureProject.rows[0].status = { state: "generated" }; fixtureProject.rows[0].rawVideo = "A/_1click/raw/001.mp4";
    await mountGen(idle);
    expect(target.textContent).toContain("1/3 đã tạo");
    expect(button("Xem").disabled).toBe(false);
  });
});

describe("Dán nhiều prompt", () => {
  async function pasteTwoPrompts() {
    button("Dán nhiều prompt").click();
    await settle();
    const area = target.querySelector("textarea")!;
    area.value = "a\nb";
    area.dispatchEvent(new Event("input"));
    flushSync();
    button("Điền").click();
    await settle();
  }
  const pasteCall = () => boundary.invoke.mock.calls.find((c) => c[0] === "paste_prompts")?.[1];

  it("fills from the selected row", async () => {
    await mountGen(idle);
    target.querySelectorAll("tbody tr")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    await pasteTwoPrompts();
    expect(pasteCall()).toEqual({ startStt: 2, text: "a\nb" });
  });

  it("fills from row 1 when no row is selected", async () => {
    await mountGen(idle);
    await pasteTwoPrompts();
    expect(pasteCall()).toEqual({ startStt: 1, text: "a\nb" });
  });
});

describe("Ảnh cho từng prompt", () => {
  const assignCall = () => boundary.invoke.mock.calls.filter((c) => c[0] === "assign_images").map((c) => c[1]);
  async function openPicker() {
    button("Gán ảnh…").click(); await settle();
  }
  function pick(...paths: string[]) {
    for (const p of paths) target.querySelector<HTMLButtonElement>(`.picker [data-image="${p}"]`)!.click();
    flushSync();
  }
  beforeEach(() => {
    const original = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: any) => {
      if (type === "list_images") return ["A/1.png", "A/2.png", "A/3.png"];
      if (type === "assign_images" || type === "add_rows") return 1;
      if (type === "delete_rows") return [];
      return original(type, args);
    });
  });

  it("uses the picked images, in pick order, for every prompt", async () => {
    await mountGen(idle); await openPicker();
    pick("A/2.png", "A/1.png");
    button("Cho mọi dòng").click(); await settle();
    expect(assignCall()).toEqual([{ images: ["A/2.png", "A/1.png"], rule: "all", stts: [], imageDir: "A" }]);
  });

  it("rotates images over the ticked rows and can add one row per image", async () => {
    await mountGen(idle);
    target.querySelectorAll<HTMLInputElement>("tbody input[type=checkbox]")[2].click(); flushSync();
    await openPicker(); pick("A/1.png", "A/3.png");
    button("Xoay vòng").click(); await settle();
    await openPicker(); pick("A/3.png");
    button("Tạo 1 dòng cho mỗi ảnh").click(); await settle();
    expect(assignCall()).toEqual([
      { images: ["A/1.png", "A/3.png"], rule: "roundRobin", stts: [3], imageDir: "A" },
      { images: ["A/3.png"], rule: "onePerImage", stts: [], imageDir: "A" },
    ]);
  });

  it("edits one row's images from its image cell", async () => {
    await mountGen(idle);
    target.querySelectorAll<HTMLButtonElement>("tbody .imgs")[1].click(); await settle();
    expect(target.querySelector(".picker [data-image='A/2.png']")?.classList.contains("on")).toBe(true);
    pick("A/3.png");
    button("Dùng cho dòng 2").click(); await settle();
    expect(assignCall()).toEqual([{ images: ["A/2.png", "A/3.png"], rule: "all", stts: [2], imageDir: "A" }]);
  });

  it("adds a row and deletes the ticked rows", async () => {
    await mountGen(idle);
    button("Thêm dòng").click(); await settle();
    expect(boundary.invoke).toHaveBeenCalledWith("add_rows", { count: 1, imageDir: "A" });
    target.querySelectorAll<HTMLInputElement>("tbody input[type=checkbox]")[0].click(); flushSync();
    button("Xoá dòng đã tick (1)").click(); await settle();
    expect(boundary.invoke).toHaveBeenCalledWith("delete_rows", { stts: [1], imageDir: "A" });
  });

  it("ticks every row from the header box and asks before deleting", async () => {
    await mountGen(idle);
    target.querySelector<HTMLInputElement>("thead input[type=checkbox]")!.click(); flushSync();
    vi.mocked(ask).mockResolvedValueOnce(false);
    button("Xoá dòng đã tick (3)").click(); await settle();
    expect(calls()).not.toContain("delete_rows");
    button("Xoá dòng đã tick (3)").click(); await settle();
    expect(boundary.invoke).toHaveBeenCalledWith("delete_rows", { stts: [1, 2, 3], imageDir: "A" });
  });
});

describe("Reopening a folder that has a saved project", () => {
  const saved = { rows: 3, prompts: 2, videos: 1 };
  async function pickB(peek: unknown) {
    vi.mocked(open).mockResolvedValueOnce("B");
    const base = boundary.invoke.getMockImplementation()!;
    boundary.invoke.mockImplementation(async (type: string, args: unknown) => (type === "peek_project" ? peek : base(type, args)));
    await mountGen(idle);
    button("Chọn folder ảnh").click(); await settle();
  }
  const opened = () => boundary.invoke.mock.calls.filter((c) => c[0] === "open_project").map((c) => c[1]);

  it("opens a folder without saved work directly", async () => {
    await pickB(null);
    expect(opened()).toEqual([{ dir: "B", fresh: false }]);
  });
  it("asks, and Mở tiếp keeps the saved prompts and videos", async () => {
    await pickB(saved);
    expect(target.textContent).toContain("2 prompt");
    expect(opened()).toEqual([]);
    button("Mở tiếp").click(); await settle();
    expect(opened()).toEqual([{ dir: "B", fresh: false }]);
  });
  it("Làm mới starts over from the images", async () => {
    await pickB(saved);
    button("Làm mới").click(); await settle();
    expect(opened()).toEqual([{ dir: "B", fresh: true }]);
  });
  it("Huỷ opens nothing and unlocks the step", async () => {
    await pickB(saved);
    expect(busyChanges.at(-1)).toBe(true);
    button("Huỷ").click(); await settle();
    expect(opened()).toEqual([]);
    expect(busyChanges.at(-1)).toBe(false);
  });
});
