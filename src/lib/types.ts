export type GenMode = "imageToVideo" | "componentsToVideo";
export type TextAlign = "left" | "center" | "right";
export type MusicMode = "random" | "sequential" | "assigned";
export type Stage = "generate" | "download" | "postProcess";

export interface GenSettings { mode: GenMode; aspectRatio: "16:9" | "9:16"; quality: "720p" | "1080p"; concurrency: number; maxRetries: number; autoPostProcess: boolean }
export interface TextStyle {
  fontFamily: string; fontFile: string | null; fontSize: number; bold: boolean; color: string;
  strokeColor: string; strokeWidth: number; shadow: boolean; boxEnabled: boolean; boxColor: string;
  boxOpacity: number; boxRadius: number; boxPadding: number; align: TextAlign; maxWidth: number; x: number; y: number;
}
export interface MusicSettings { folder: string | null; mode: MusicMode; fallback: MusicMode; musicVolume: number; originalVolume: number; fadeIn: number; fadeOut: number }
export interface OutputSettings { folder: string | null; overwrite: boolean }
export interface Preset { gen: GenSettings; text: TextStyle; music: MusicSettings; output: OutputSettings }

export type RowStatus =
  | { state: "pending" } | { state: "sending" } | { state: "rendering"; percent: number }
  | { state: "downloaded" } | { state: "generated" } | { state: "postProcessing" } | { state: "done" }
  | { state: "failed"; stage: Stage; message: string };

export interface Row {
  stt: number; imagePath: string; prompt: string; text: string; music: string | null;
  textOverride: TextStyle | null; status: RowStatus; jobId: string | null; rawVideo: string | null;
  resolvedMusic: string | null; output: string | null;
}
export interface Project { version: number; imageDir: string; commonPrompt: string; preset: Preset; rows: Row[] }
export interface Status { connected: boolean; extId: string | null; extVersion: string | null; ffmpeg: string | null; running: boolean }
export interface FontInfo { name: string; path: string }
