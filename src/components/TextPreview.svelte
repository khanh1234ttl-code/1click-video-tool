<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { drawOverlay, ensureFont } from "../lib/overlay";
  import type { TextStyle } from "../lib/types";

  let { style = $bindable(), text, w, h, imagePath = null }: { style: TextStyle; text: string; w: number; h: number; imagePath?: string | null } = $props();
  let canvas: HTMLCanvasElement;
  let dragging = false;
  const SNAPS = [0.15, 0.5, 0.85];

  let revision = 0;
  // Read every input synchronously so the effect tracks size changes too; a font load that
  // finishes after a newer one must not paint stale text or dimensions.
  $effect(() => {
    const s = { ...style };
    const t = text || "Chữ mẫu trên video";
    const width = w, height = h;
    const mine = ++revision;
    ensureFont(s).then((family) => {
      if (mine === revision && canvas) drawOverlay(canvas.getContext("2d")!, s, family, t, width, height);
    });
  });

  function moveTo(ev: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    let x = (ev.clientX - r.left) / r.width;
    let y = (ev.clientY - r.top) / r.height;
    for (const s of SNAPS) {
      if (Math.abs(x - s) < 0.03) x = s;
      if (Math.abs(y - s) < 0.03) y = s;
    }
    style = { ...style, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }
</script>

<div class="frame" style="aspect-ratio: {w} / {h}; background-image: {imagePath ? `url('${convertFileSrc(imagePath)}')` : 'none'}">
  <canvas bind:this={canvas} width={w} height={h}
    onpointerdown={(e) => { dragging = true; canvas.setPointerCapture(e.pointerId); moveTo(e); }}
    onpointermove={(e) => dragging && moveTo(e)}
    onpointerup={() => (dragging = false)}></canvas>
</div>
<div class="snaps">
  {#each SNAPS as y}{#each SNAPS as x}
    <button title="Hít vị trí" onclick={() => (style = { ...style, x, y })}>·</button>
  {/each}{/each}
</div>

<style>
  .frame { width: 100%; max-height: 60vh; background: #222 center/cover no-repeat; border-radius: 8px; overflow: hidden; }
  canvas { width: 100%; height: 100%; cursor: move; display: block; }
  .snaps { display: grid; grid-template-columns: repeat(3, 28px); gap: 4px; margin-top: 6px; }
  .snaps button { padding: 0; height: 22px; }
</style>
