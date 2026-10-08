import type { Project } from "./types";

/** Test helper: an empty project with the default preset used across component tests. */
export function fixture(dir = "A"): Project {
  return { version: 1, imageDir: dir, commonPrompt: "", preset: {
    gen: { mode: "imageToVideo", aspectRatio: "16:9", quality: "720p", concurrency: 3, maxRetries: 0, autoPostProcess: false },
    text: { fontFamily: "Arial", fontFile: null, fontSize: 50, bold: false, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, shadow: false, boxEnabled: false, boxColor: "#000000", boxOpacity: 0, boxRadius: 0, boxPadding: 0, align: "center", maxWidth: .8, x: .5, y: .5 },
    music: { folder: null, mode: "random", fallback: "random", musicVolume: .25, originalVolume: 1, fadeIn: 1, fadeOut: 1 },
    output: { folder: null, overwrite: false },
  }, rows: [] };
}
