<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { onMount } from "svelte";
  import { api } from "../lib/api";
  import type { FontInfo, TextStyle } from "../lib/types";

  let { style = $bindable() }: { style: TextStyle } = $props();
  let fonts: FontInfo[] = $state([]);
  onMount(async () => (fonts = await api.listFonts()));
  const set = (patch: Partial<TextStyle>) => (style = { ...style, ...patch });
  async function pickFontFile() {
    const f = await open({ filters: [{ name: "Font", extensions: ["ttf", "otf"] }] });
    if (typeof f === "string") set({ fontFile: f, fontFamily: f.split(/[\\/]/).pop()!.replace(/\.(ttf|otf)$/i, "") });
  }
</script>

<div class="grid">
  <label>Font
    <select value={style.fontFile ?? ""} onchange={(e) => { const p = (e.currentTarget as HTMLSelectElement).value; set({ fontFile: p || null, fontFamily: p ? fonts.find((f) => f.path === p)?.name ?? style.fontFamily : "Arial" }); }}>
      <option value="">Arial (mặc định)</option>
      {#if style.fontFile && !fonts.some((f) => f.path === style.fontFile)}<option value={style.fontFile}>{style.fontFamily}</option>{/if}
      {#each fonts as f}<option value={f.path}>{f.name}</option>{/each}
    </select>
  </label>
  <label>File font riêng <button onclick={pickFontFile}>Nạp .ttf/.otf…</button></label>
  <label>Cỡ chữ <input type="number" min="12" max="300" value={style.fontSize} oninput={(e) => set({ fontSize: +e.currentTarget.value })} /></label>
  <label>Màu chữ <input type="color" value={style.color} oninput={(e) => set({ color: e.currentTarget.value })} /></label>
  <label>Đậm <input type="checkbox" checked={style.bold} onchange={(e) => set({ bold: e.currentTarget.checked })} /></label>
  <label>Màu viền <input type="color" value={style.strokeColor} oninput={(e) => set({ strokeColor: e.currentTarget.value })} /></label>
  <label>Độ dày viền <input type="number" min="0" max="30" value={style.strokeWidth} oninput={(e) => set({ strokeWidth: +e.currentTarget.value })} /></label>
  <label>Bóng <input type="checkbox" checked={style.shadow} onchange={(e) => set({ shadow: e.currentTarget.checked })} /></label>
  <label>Nền hộp <input type="checkbox" checked={style.boxEnabled} onchange={(e) => set({ boxEnabled: e.currentTarget.checked })} /></label>
  <label>Màu nền <input type="color" value={style.boxColor} oninput={(e) => set({ boxColor: e.currentTarget.value })} /></label>
  <label>Độ mờ nền <input type="range" min="0" max="1" step="0.05" value={style.boxOpacity} oninput={(e) => set({ boxOpacity: +e.currentTarget.value })} /></label>
  <label>Bo góc <input type="number" min="0" max="100" value={style.boxRadius} oninput={(e) => set({ boxRadius: +e.currentTarget.value })} /></label>
  <label>Đệm <input type="number" min="0" max="100" value={style.boxPadding} oninput={(e) => set({ boxPadding: +e.currentTarget.value })} /></label>
  <label>Canh lề
    <select value={style.align} onchange={(e) => set({ align: e.currentTarget.value as TextStyle["align"] })}>
      <option value="left">Trái</option><option value="center">Giữa</option><option value="right">Phải</option>
    </select>
  </label>
  <label>Rộng tối đa <input type="range" min="0.2" max="1" step="0.05" value={style.maxWidth} oninput={(e) => set({ maxWidth: +e.currentTarget.value })} /></label>
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
</style>
