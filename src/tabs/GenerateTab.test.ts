import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, tick, unmount } from "svelte";
import GenerateTab from "./GenerateTab.svelte";
import { reactiveStatus } from "./reactiveStatus.svelte";
import { PresetStore } from "../lib/presetStore.svelte";
import { fixture } from "../lib/testFixtures";
import type { Project, Row, Status } from "../lib/types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
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
