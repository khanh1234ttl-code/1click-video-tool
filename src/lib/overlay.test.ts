import { describe, expect, it, vi } from "vitest";
import { drawOverlay } from "./overlay";
import type { TextStyle } from "./types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const style = (o: Partial<TextStyle>): TextStyle => ({
  fontFamily: "Arial", fontFile: null, fontSize: 64, bold: false, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0,
  shadow: false, boxEnabled: false, boxColor: "#000000", boxOpacity: 0, boxRadius: 0, boxPadding: 0, align: "center",
  maxWidth: 0.8, x: 0.5, y: 0.5, ...o,
});

/** Minimal 2D context that records which text draws happened with a visible shadow. */
function recordingCtx() {
  const draws: { op: string; shadowed: boolean }[] = [];
  const ctx: Record<string, unknown> = {
    shadowColor: "transparent", shadowBlur: 0, shadowOffsetY: 0,
    measureText: (s: string) => ({ width: s.length * 10 }),
    clearRect() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, fill() {},
  };
  const rec = (op: string) => () => draws.push({ op, shadowed: ctx.shadowColor !== "transparent" && (ctx.shadowBlur as number) > 0 });
  ctx.fillText = rec("fill");
  ctx.strokeText = rec("stroke");
  return { ctx: ctx as unknown as CanvasRenderingContext2D, draws };
}

describe("drawOverlay shadow", () => {
  it("draws the shadow under the fill when there is no stroke", () => {
    const { ctx, draws } = recordingCtx();
    drawOverlay(ctx, style({ shadow: true, strokeWidth: 0 }), "Arial", "Tập 1", 1280, 720);
    expect(draws).toEqual([{ op: "fill", shadowed: true }]);
  });

  it("puts the shadow on the stroke only when a stroke exists", () => {
    const { ctx, draws } = recordingCtx();
    drawOverlay(ctx, style({ shadow: true, strokeWidth: 4 }), "Arial", "Tập 1", 1280, 720);
    expect(draws).toEqual([{ op: "stroke", shadowed: true }, { op: "fill", shadowed: false }]);
  });

  it("does not leak the shadow into the next draw on a reused canvas", () => {
    const { ctx, draws } = recordingCtx();
    drawOverlay(ctx, style({ shadow: true, strokeWidth: 0 }), "Arial", "Tập 1", 1280, 720);
    draws.length = 0;
    drawOverlay(ctx, style({ shadow: false, strokeWidth: 0 }), "Arial", "Tập 1", 1280, 720);
    expect(draws).toEqual([{ op: "fill", shadowed: false }]);
  });

  it("draws no shadow when shadow is off", () => {
    const { ctx, draws } = recordingCtx();
    drawOverlay(ctx, style({ shadow: false, strokeWidth: 4 }), "Arial", "Tập 1", 1280, 720);
    expect(draws.every((d) => !d.shadowed)).toBe(true);
  });
});
