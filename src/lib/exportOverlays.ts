import { api } from "./api";
import { renderOverlayPng } from "./overlay";
import { resolutionFor } from "./textLayout";
import type { Project } from "./types";

/** Renders each row's text overlay at the video's size from a durable project snapshot. */
export async function renderOverlays(project: Project, stts: number[]) {
  const { w, h } = resolutionFor(project.preset.gen);
  const items = [];
  for (const row of project.rows.filter((r) => stts.includes(r.stt))) {
    items.push({ stt: row.stt, pngBase64: await renderOverlayPng(row.textOverride ?? project.preset.text, row.text, w, h) });
  }
  await api.saveOverlays(items);
}
