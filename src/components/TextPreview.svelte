<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { drawOverlay, ensureFont } from "../lib/overlay";
  import type { TextStyle } from "../lib/types";

  let { style = $bindable(), text, w, h, imagePath = null, videoPath = null, maxHeight = "55vh" }: { style: TextStyle; text: string; w: number; h: number; imagePath?: string | null; videoPath?: string | null; maxHeight?: string } = $props();
  let videoFailed = $state(false);
  // A newly selected row gets a fresh chance to play its video.
  $effect(() => { videoPath; videoFailed = false; });
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

<div class="frame" style="aspect-ratio: {w} / {h}; --max-w: calc({maxHeight} * {w} / {h}); background-image: {imagePath ? `url('${convertFileSrc(imagePath)}')` : 'none'}">
  {#if videoPath && !videoFailed}
    <video src={convertFileSrc(videoPath)} muted loop autoplay playsinline onerror={() => (videoFailed = true)}></video>
  {/if}
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
  /* --max-w keeps a tall frame within maxHeight; set inline, applied here (min() inline is not portable). */
  .frame { width: min(100%, var(--max-w)); position: relative; margin: 0 auto; background: #222 center/cover no-repeat; border-radius: 8px; overflow: hidden; }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  video { object-fit: cover; }
  canvas { cursor: move; }
  .snaps { display: grid; grid-template-columns: repeat(3, 24px); gap: 3px; margin: 6px auto 0; width: max-content; }
  .snaps button { padding: 0; height: 18px; }
</style>
