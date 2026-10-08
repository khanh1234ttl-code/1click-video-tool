import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, tick, unmount } from "svelte";
import SourceTab from "./SourceTab.svelte";
import type { Project, Row } from "../lib/types";

const boundary = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: boundary.invoke, convertFileSrc: (p: string) => p }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
// The mounted component stays real; only Canvas/font work is replaced.
vi.mock("../lib/overlay", () => ({ ensureFont: async () => "Arial", drawOverlay: vi.fn(), renderOverlayPng: async () => null }));

const row = (stt: number): Row => ({ stt, imagePath: `A/${stt}.png`, prompt: "", text: "", music: null, textOverride: null, status: { state: "pending" }, jobId: null, rawVideo: null, resolvedMusic: null, output: null });
function project(): Project {
  return { version: 1, imageDir: "A", commonPrompt: "", preset: {
    gen: { mode: "imageToVideo", aspectRatio: "16:9", quality: "720p", concurrency: 3, maxRetries: 0, autoPostProcess: false },
    text: { fontFamily: "Arial", fontFile: null, fontSize: 50, bold: false, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, shadow: false, boxEnabled: false, boxColor: "#000000", boxOpacity: 0, boxRadius: 0, boxPadding: 0, align: "center", maxWidth: .8, x: .5, y: .5 },
    music: { folder: null, mode: "random", fallback: "random", musicVolume: .25, originalVolume: 1, fadeIn: 1, fadeOut: 1 },
    output: { folder: null, overwrite: false },
  }, rows: [row(1), row(2), row(3)] };
}

let target: HTMLDivElement, instance: ReturnType<typeof mount>;
async function settle() { for (let i = 0; i < 20; i++) { await tick(); await Promise.resolve(); } }
const button = (label: string) => {
  const b = [...target.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!b) throw new Error(`Missing button ${label}`);
  return b;
};
const pasteCall = () => boundary.invoke.mock.calls.find((c) => c[0] === "paste_prompts")?.[1];

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

beforeEach(async () => {
  target = document.createElement("div");
  document.body.append(target);
  boundary.invoke.mockReset().mockImplementation(async (type: string) => (type === "paste_prompts" ? 2 : type === "list_music" ? [] : undefined));
  instance = mount(SourceTab, { target, props: { project: project(), toast: () => {} } });
  await settle();
});
afterEach(async () => { await unmount(instance); target.remove(); });

describe("Dán nhiều prompt", () => {
  it("fills from the selected row", async () => {
    target.querySelectorAll("tbody tr")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    await pasteTwoPrompts();
    expect(pasteCall()).toEqual({ startStt: 2, text: "a\nb" });
  });

  it("fills from row 1 when no row is selected", async () => {
    await pasteTwoPrompts();
    expect(pasteCall()).toEqual({ startStt: 1, text: "a\nb" });
  });
});
