import { api } from "./api";
import { layoutBlock } from "./textLayout";
import type { TextStyle } from "./types";

const loaded = new Map<string, string>();

/** Registers a custom font file once and returns the CSS family to use. */
export async function ensureFont(style: TextStyle): Promise<string> {
  if (!style.fontFile) return style.fontFamily || "Arial";
  const cached = loaded.get(style.fontFile);
  if (cached) return cached;
  const family = `oc-font-${loaded.size + 1}`;
  const b64 = await api.readFileBase64(style.fontFile);
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const face = new FontFace(family, bytes.buffer);
  await face.load();
  document.fonts.add(face);
  loaded.set(style.fontFile, family);
  return family;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draws the text block on a transparent w×h canvas context (family from ensureFont). */
export function drawOverlay(ctx: CanvasRenderingContext2D, style: TextStyle, family: string, text: string, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const scale = h / 1080;
  ctx.font = `${style.bold ? "700" : "400"} ${style.fontSize * scale}px "${family}"`;
  const b = layoutBlock(style, text, w, h, (s) => ctx.measureText(s).width);
  if (!b.lines.length) return b;
  if (style.boxEnabled) {
    ctx.globalAlpha = style.boxOpacity;
    ctx.fillStyle = style.boxColor;
    roundRect(ctx, b.boxX, b.boxY, b.boxW, b.boxH, style.boxRadius * scale);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  b.lines.forEach((line, i) => {
    const lw = ctx.measureText(line).width;
    const inner = b.boxW - b.pad * 2;
    const x = b.boxX + b.pad + (style.align === "left" ? 0 : style.align === "right" ? inner - lw : (inner - lw) / 2);
    const y = b.boxY + b.pad + b.lineH * (i + 0.5);
    if (style.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8 * scale;
      ctx.shadowOffsetY = 3 * scale;
    }
    if (style.strokeWidth > 0) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth * 2 * scale;
      ctx.strokeText(line, x, y);
    }
    ctx.shadowColor = "transparent";
    ctx.fillStyle = style.color;
    ctx.fillText(line, x, y);
  });
  return b;
}

/** Renders the overlay at full video size and returns a PNG data URL, or null for empty text. */
export async function renderOverlayPng(style: TextStyle, text: string, w: number, h: number): Promise<string | null> {
  if (!text.trim()) return null;
  const family = await ensureFont(style);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  drawOverlay(canvas.getContext("2d")!, style, family, text, w, h);
  return canvas.toDataURL("image/png");
}
