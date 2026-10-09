<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";

  export type AssignRule = "all" | "roundRobin" | "onePerImage";
  let { library, chosen = $bindable(), target, ticked, onassign, onclose }: {
    library: string[]; chosen: string[]; target: number | null; ticked: number[];
    onassign: (rule: AssignRule, stts: number[]) => void; onclose: () => void;
  } = $props();
  const name = (p: string) => p.split(/[\\/]/).pop();
  // Order of clicks is the order Veo receives the images (frame mode uses the first).
  function toggle(p: string) {
    chosen = chosen.includes(p) ? chosen.filter((x) => x !== p) : [...chosen, p];
  }
</script>

<div class="picker" role="dialog" aria-label="Chọn ảnh">
  <div class="head">
    <b>{target ? `Ảnh cho dòng ${target}` : "Gán ảnh hàng loạt"}</b>
    <span class="hint">Bấm để chọn, số trên ảnh là thứ tự. Khung đầu dùng 1 ảnh; tham chiếu dùng 1–10 ảnh.</span>
    <span class="grow"></span>
    <button onclick={() => (chosen = [])} disabled={!chosen.length}>Bỏ chọn</button>
    <button onclick={onclose}>Đóng</button>
  </div>
  <div class="grid">
    {#each library as p (p)}
      <button class="thumb" class:on={chosen.includes(p)} data-image={p} title={name(p)} onclick={() => toggle(p)}>
        <img src={convertFileSrc(p)} alt="" loading="lazy" />
        {#if chosen.includes(p)}<span class="n">{chosen.indexOf(p) + 1}</span>{/if}
        <span class="cap">{name(p)}</span>
      </button>
    {:else}
      <p class="hint">Folder ảnh chưa có ảnh (jpg, png, webp).</p>
    {/each}
  </div>
  <div class="foot">
    <span>{chosen.length} ảnh đã chọn</span>
    <span class="grow"></span>
    {#if target}
      <button class="primary" onclick={() => onassign("all", [target])}>Dùng cho dòng {target}</button>
    {:else}
      <button class="primary" disabled={!chosen.length} onclick={() => onassign("all", [])}>Cho mọi dòng</button>
      <button disabled={!chosen.length || !ticked.length} onclick={() => onassign("all", ticked)}>Cho dòng đã tick ({ticked.length})</button>
      <button disabled={!chosen.length} title="Mỗi dòng 1 ảnh, lần lượt theo thứ tự đã chọn" onclick={() => onassign("roundRobin", ticked)}>Xoay vòng</button>
      <button disabled={!chosen.length} onclick={() => onassign("onePerImage", [])}>Tạo 1 dòng cho mỗi ảnh</button>
    {/if}
  </div>
</div>

<style>
  .picker { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: var(--panel); padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; }
  .head, .foot { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .grow { flex: 1; }
  .hint { color: var(--muted); font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; max-height: 32vh; overflow-y: auto; }
  .thumb { position: relative; padding: 0; border: 2px solid transparent; border-radius: 8px; overflow: hidden; background: #222; display: flex; flex-direction: column; }
  .thumb.on { border-color: var(--accent); }
  .thumb img { width: 100%; height: 64px; object-fit: cover; display: block; }
  .cap { font-size: 11px; color: #fff; background: rgba(0,0,0,.55); padding: 2px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .n { position: absolute; top: 4px; left: 4px; background: var(--accent); color: #fff; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; display: grid; place-items: center; }
</style>
