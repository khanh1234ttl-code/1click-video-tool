import { describe, expect, it } from "vitest";
import { layoutBlock, resolutionFor, statusLabel, wrapText } from "./textLayout";
import type { TextStyle } from "./types";

const measure = (s: string) => s.length * 10; // 10 px per character

const style: TextStyle = {
  fontFamily: "Arial", fontFile: null, fontSize: 54, bold: true, color: "#fff", strokeColor: "#000", strokeWidth: 0,
  shadow: false, boxEnabled: true, boxColor: "#000", boxOpacity: 0.5, boxRadius: 0, boxPadding: 20, align: "center", maxWidth: 0.5, x: 0.5, y: 0.9,
};

describe("wrapText", () => {
  it("wraps on spaces and keeps explicit line breaks", () => {
    expect(wrapText("một hai ba bốn\nnăm", 70, measure)).toEqual(["một hai", "ba bốn", "năm"]);
  });
  it("breaks a single long word by characters", () => {
    expect(wrapText("abcdefghij", 40, measure)).toEqual(["abcd", "efgh", "ij"]);
  });
  it("returns no lines for blank text", () => {
    expect(wrapText("   ", 100, measure)).toEqual([]);
  });
});

describe("layoutBlock", () => {
  it("scales sizes by height/1080 and keeps the box inside the frame", () => {
    const b = layoutBlock(style, "chữ dài ở cuối khung hình", 1280, 720, measure);
    expect(b.scale).toBeCloseTo(720 / 1080);
    expect(b.fontPx).toBeCloseTo(36);
    expect(b.boxY + b.boxH).toBeLessThanOrEqual(720);
    expect(b.boxX).toBeGreaterThanOrEqual(0);
    expect(b.lines.every((l) => measure(l) <= 1280 * 0.5)).toBe(true);
  });
});

describe("helpers", () => {
  it("resolution matches the Rust model", () => {
    expect(resolutionFor({ mode: "imageToVideo", aspectRatio: "9:16", quality: "1080p", concurrency: 1, maxRetries: 1, autoPostProcess: false })).toEqual({ w: 1080, h: 1920 });
  });
  it("labels statuses in Vietnamese", () => {
    expect(statusLabel({ state: "rendering", percent: 45 })).toBe("Render 45%");
    expect(statusLabel({ state: "failed", stage: "postProcess", message: "x" })).toBe("Lỗi hậu kỳ");
  });
});

describe("statusLabel", () => {
  it("labels a generated row Đã tạo", () => {
    expect(statusLabel({ state: "generated" })).toBe("Đã tạo");
  });
});
