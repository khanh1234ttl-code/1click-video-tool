import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import RunTab from "./RunTab.svelte";
import { reactiveStatus } from "./reactiveStatus.svelte";
import type { Project, Status } from "../lib/types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
// The mounted component stays real; only Canvas/font work is replaced.
vi.mock("../lib/overlay", () => ({ ensureFont: async () => "Arial", drawOverlay: vi.fn(), renderOverlayPng: async () => null }));

function project(): Project {
  return { version: 1, imageDir: "A", commonPrompt: "p", preset: {
    gen: { mode: "imageToVideo", aspectRatio: "16:9", quality: "720p", concurrency: 3, maxRetries: 0, autoPostProcess: false },
    text: { fontFamily: "Arial", fontFile: null, fontSize: 50, bold: false, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, shadow: false, boxEnabled: false, boxColor: "#000000", boxOpacity: 0, boxRadius: 0, boxPadding: 0, align: "center", maxWidth: .8, x: .5, y: .5 },
    music: { folder: null, mode: "random", fallback: "random", musicVolume: .25, originalVolume: 1, fadeIn: 1, fadeOut: 1 },
    output: { folder: null, overwrite: false },
  }, rows: [{ stt: 1, imagePath: "A/1.png", prompt: "", text: "", music: null, textOverride: null, status: { state: "pending" }, jobId: null, rawVideo: null, resolvedMusic: null, output: null }] };
}
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => { resolve = yes; });
  return { promise, resolve };
};
const idle: Status = { connected: true, extId: "x", extVersion: "1", ffmpeg: "ffmpeg", running: false };
const running: Status = { ...idle, running: true };

let target: HTMLDivElement, instance: ReturnType<typeof mount>, busyChanges: boolean[];
let start: ReturnType<typeof deferred>, pause: ReturnType<typeof deferred>, status: ReturnType<typeof reactiveStatus>;
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
function button(prefix: string): HTMLButtonElement {
  const b = [...target.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(prefix));
  if (!b) throw new Error(`Missing button ${prefix}`);
  return b;
}
const calls = () => boundary.invoke.mock.calls.map((c) => c[0]);
const locked = () => busyChanges.at(-1) ?? false;

async function mountRun(initial: Status) {
  status = reactiveStatus(initial);
  instance = mount(RunTab, { target, props: {
    project: project(),
    get status() { return status.status; },
    toast: () => {},
    onBusyChange: (b: boolean) => busyChanges.push(b),
  } });
  await settle();
}

/** Clicks Start; start_run stays pending while the engine already reports running. */
async function startPending() {
  await mountRun(idle);
  button("Bắt đầu").click();
  await settle();
  expect(calls()).toEqual(["save_overlays", "start_run"]);
  status.set(running);
  await settle();
}

beforeEach(() => {
  busyChanges = [];
  start = deferred();
  pause = deferred();
  target = document.createElement("div");
  document.body.append(target);
  boundary.invoke.mockReset().mockImplementation(async (type: string) => {
    if (type === "start_run") return start.promise;
    if (type === "pause_run") return pause.promise;
  });
});
afterEach(async () => { if (instance) await unmount(instance); target.remove(); });

describe("Stop (Dừng) while Start is still preparing", () => {
  it("keeps Dừng usable and calls pause_run while start_run is pending", async () => {
    await startPending();
    expect(button("Dừng").disabled).toBe(false);
    button("Dừng").click();
    await settle();
    expect(calls()).toEqual(["save_overlays", "start_run", "pause_run"]);
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

  it("still blocks a second Start, Retry and Reprocess while the first Start is pending", async () => {
    await mountRun(idle);
    button("Bắt đầu").click();
    await settle();
    button("Bắt đầu").click();
    await settle();
    expect(calls().filter((c) => c === "start_run")).toHaveLength(1);
    expect(button("Bắt đầu").disabled).toBe(true);
    expect(button("Thử lại").disabled).toBe(true);
    expect(button("Chỉ hậu kỳ lại").disabled).toBe(true);
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
