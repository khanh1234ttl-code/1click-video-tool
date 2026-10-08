import type { TextStyle } from "../lib/types";

/** Test helper: TextPreview props that can change after mount. */
export function previewProps(initial: { style: TextStyle; text: string; w: number; h: number }) {
  const box = $state({ ...initial });
  return {
    props: {
      get style() { return box.style; },
      set style(v: TextStyle) { box.style = v; },
      get text() { return box.text; },
      get w() { return box.w; },
      get h() { return box.h; },
    },
    set(patch: Partial<typeof initial>) { Object.assign(box, patch); },
  };
}
