import type { GenSettings, RowStatus, TextStyle } from "./types";

export type Measure = (s: string) => number;

/** Greedy word wrap; words longer than maxWidth are split by characters. */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word;
      if (measure(cand) <= maxWidth) { line = cand; continue; }
      if (line) out.push(line);
      line = "";
      let chunk = "";
      for (const ch of word) {
        if (measure(chunk + ch) > maxWidth && chunk) { out.push(chunk); chunk = ""; }
        chunk += ch;
      }
      line = chunk;
    }
    if (line) out.push(line);
  }
  return out;
}

export interface Block { scale: number; fontPx: number; lineH: number; lines: string[]; boxX: number; boxY: number; boxW: number; boxH: number; pad: number }

/** Lays out the text block for a w×h frame; `measure` must already use the scaled font. */
export function layoutBlock(style: TextStyle, text: string, w: number, h: number, measure: Measure): Block {
  const scale = h / 1080;
  const fontPx = style.fontSize * scale;
  const pad = style.boxEnabled ? style.boxPadding * scale : 0;
  const lines = wrapText(text, Math.max(10, w * style.maxWidth), measure);
  const lineH = fontPx * 1.25;
  const textW = Math.max(0, ...lines.map(measure));
  const boxW = textW + pad * 2;
  const boxH = lines.length * lineH + pad * 2;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const boxX = clamp(style.x * w - boxW / 2, 0, w - boxW);
  const boxY = clamp(style.y * h - boxH / 2, 0, h - boxH);
  return { scale, fontPx, lineH, lines, boxX, boxY, boxW, boxH, pad };
}

export function resolutionFor(gen: GenSettings): { w: number; h: number } {
  const [w, h] = gen.quality === "1080p" ? [1920, 1080] : [1280, 720];
  return gen.aspectRatio === "9:16" ? { w: h, h: w } : { w, h };
}

const STAGE: Record<string, string> = { generate: "Lỗi tạo video", download: "Lỗi tải về", postProcess: "Lỗi hậu kỳ" };

export function statusLabel(s: RowStatus): string {
  switch (s.state) {
    case "pending": return "Chờ";
    case "sending": return "Đang gửi";
    case "rendering": return `Render ${s.percent}%`;
    case "downloaded": return "Đã tải";
    case "postProcessing": return "Hậu kỳ";
    case "done": return "Xong";
    case "failed": return STAGE[s.stage] ?? "Lỗi";
  }
}
