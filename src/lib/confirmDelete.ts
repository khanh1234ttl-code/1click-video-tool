import { ask } from "@tauri-apps/plugin-dialog";

/** Asks before removing rows; only the rows go, image and video files stay on disk. */
export function confirmDelete(n: number, what: "dòng" | "cảnh"): Promise<boolean> {
  return ask(`Xoá ${n} ${what} đã tick khỏi dự án?\nFile ảnh và video trên máy không bị xoá.`, { title: `Xoá ${what}`, kind: "warning", okLabel: "Xoá", cancelLabel: "Không" });
}
