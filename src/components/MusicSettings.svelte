<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import type { MusicSettings } from "../lib/types";
  let { music = $bindable() }: { music: MusicSettings } = $props();
  async function pick() {
    const dir = await open({ directory: true, title: "Chọn folder nhạc" });
    if (typeof dir === "string") music.folder = dir;
  }
</script>

<div class="grid">
  <label class="wide">Folder nhạc <button class="path" onclick={pick} title={music.folder ?? ""}>{music.folder ? music.folder.split(/[\\/]/).slice(-2).join("\\") : "Chọn…"}</button></label>
  <label>Chế độ
    <select bind:value={music.mode}>
      <option value="random">Ngẫu nhiên</option><option value="sequential">Lần lượt</option><option value="assigned">Theo cột Nhạc</option>
    </select>
  </label>
  {#if music.mode === "assigned"}
    <label>Dòng trống dùng
      <select bind:value={music.fallback}><option value="random">Ngẫu nhiên</option><option value="sequential">Lần lượt</option></select>
    </label>
  {/if}
  <label>Âm lượng nhạc {Math.round(music.musicVolume * 100)}% <input type="range" min="0" max="1.5" step="0.05" bind:value={music.musicVolume} /></label>
  <label>Âm gốc {Math.round(music.originalVolume * 100)}% <input type="range" min="0" max="1.5" step="0.05" bind:value={music.originalVolume} /></label>
  <label>Fade vào (s) <input type="number" min="0" max="10" step="0.5" bind:value={music.fadeIn} /></label>
  <label>Fade ra (s) <input type="number" min="0" max="10" step="0.5" bind:value={music.fadeOut} /></label>
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 12px; }
  .wide { grid-column: span 2; }
  .path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
</style>
