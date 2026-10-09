<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { api } from "../lib/api";
  import { joinPath } from "../lib/paths";
  import { renderOverlays } from "../lib/exportOverlays";
  import type { PresetStore } from "../lib/presetStore.svelte";
  import { resolutionFor } from "../lib/textLayout";
  import type { Project, Row, TextStyle } from "../lib/types";
  import MusicSettings from "../components/MusicSettings.svelte";
  import OutputSettings from "../components/OutputSettings.svelte";
  import PostList from "../components/PostList.svelte";
  import TextPreview from "../components/TextPreview.svelte";
  import TextStyleEditor from "../components/TextStyleEditor.svelte";

  let { project, store, toast, onBusyChange = () => {} }: { project: Project; store: PresetStore; toast: (t: string) => void; onBusyChange?: (b: boolean) => void } = $props();
  let busy = $state(false);
  $effect(() => onBusyChange(busy));
  let selected = $state(project.rows[0]?.stt ?? 0);
  let picked = $state(new Set<number>());
  const row = $derived(project.rows.find((r) => r.stt === selected));
  // The shown scene was deleted: show the first one left.
  $effect(() => { if (!row && project.rows.length) selected = project.rows[0].stt; });
  const res = $derived(resolutionFor(store.preset.gen));
  const ready = $derived(project.rows.filter((r) => r.rawVideo).map((r) => r.stt));
  const pickedReady = $derived(ready.filter((s) => picked.has(s)));

  // Per-row style: edited locally (form or preview drag), saved shortly after each change;
  // export waits for the save.
  let own = $state(false);
  let rowStyle: TextStyle = $state(structuredClone($state.snapshot(store.preset.text)));
  let shownRow = 0;
  let savedOverride = "";
  $effect(() => {
    const r = row;
    if (!r || r.stt === shownRow) return;
    shownRow = r.stt;
    own = r.textOverride !== null;
    rowStyle = structuredClone(r.textOverride ?? $state.snapshot(store.preset.text)) as TextStyle;
    savedOverride = own ? JSON.stringify(rowStyle) : "null";
  });
  // One watcher for every way the override changes: the checkbox, the form, or the preview.
  $effect(() => {
    const json = own ? JSON.stringify($state.snapshot(rowStyle)) : "null";
    if (json === savedOverride) return;
    savedOverride = json;
    scheduleOverride(untrack(() => row));
  });
  let pendingOverride: Promise<void> = Promise.resolve();
  let overrideTimer: ReturnType<typeof setTimeout> | undefined;
  let overrideWork: (() => void) | undefined;
  function scheduleOverride(r: Row | undefined) {
    if (!r) return;
    const override = own ? ($state.snapshot(rowStyle) as TextStyle) : null;
    clearTimeout(overrideTimer);
    overrideWork = () => {
      overrideWork = undefined;
      pendingOverride = api.updateRow({ stt: r.stt, prompt: r.prompt, text: r.text, music: r.music, textOverride: override }, project.imageDir).catch((e) => toast(String(e)));
    };
    overrideTimer = setTimeout(() => overrideWork?.(), 300);
  }
  async function flushOverride() {
    clearTimeout(overrideTimer);
    overrideWork?.();
    await pendingOverride;
  }
  onDestroy(() => { clearTimeout(overrideTimer); overrideWork?.(); });

  async function exportRows(stts: number[]) {
    if (busy) return;
    busy = true;
    try {
      await store.flush();
      await flushOverride();
      const p = await api.getProject();
      if (!p || p.imageDir !== project.imageDir) throw new Error("Dự án đã thay đổi");
      const todo = stts.filter((s) => p.rows.some((r) => r.stt === s && r.rawVideo));
      if (!todo.length) throw new Error("Chưa có video gốc. Tạo video ở bước 1 trước.");
      await renderOverlays(p, todo);
      await api.reprocessRows(todo);
      toast(`Đang xuất ${todo.length} video`);
    } catch (e) { toast(String(e)); } finally { busy = false; }
  }
</script>

<div class="post">
  <section class="left">
    <PostList {project} {store} bind:selected bind:picked {toast} {busy} />
  </section>
  <section class="right">
    {#if row}
      {#if own}
        <TextPreview bind:style={rowStyle} text={row.text || "Chữ mẫu trên video"} w={res.w} h={res.h} imagePath={row.images[0] ?? null} videoPath={row.rawVideo} maxHeight="42vh" />
      {:else}
        <TextPreview bind:style={store.preset.text} text={row.text || "Chữ mẫu trên video"} w={res.w} h={res.h} imagePath={row.images[0] ?? null} videoPath={row.rawVideo} maxHeight="42vh" />
      {/if}
      <label class="check"><input type="checkbox" bind:checked={own} /> Kiểu/vị trí chữ riêng cho video {row.stt}</label>
    {/if}
    <div class="sections">
      <details open>
        <summary>Kiểu chữ {own ? `(riêng video ${selected})` : "(chung)"}</summary>
        {#if own}<TextStyleEditor bind:style={rowStyle} />
        {:else}<TextStyleEditor bind:style={store.preset.text} />{/if}
      </details>
      <details><summary>Nhạc nền</summary><MusicSettings bind:music={store.preset.music} /></details>
      <details><summary>Đầu ra</summary><OutputSettings bind:output={store.preset.output} /></details>
    </div>
  </section>
</div>
<div class="foot">
  <span class="grow"></span>
  <button disabled={busy || !pickedReady.length} onclick={() => exportRows(pickedReady)}>Xuất dòng chọn ({pickedReady.length})</button>
  <button class="primary" disabled={busy || !ready.length} title={ready.length ? "" : "Tạo video ở bước 1 trước"} onclick={() => exportRows(ready)}>Xuất tất cả ({ready.length})</button>
  <button onclick={() => api.openPath(store.preset.output.folder ?? joinPath(project.imageDir, "Output"))}>Mở folder Output</button>
</div>

<style>
  .post { display: grid; grid-template-columns: minmax(360px, 5fr) minmax(360px, 6fr); gap: 12px; padding: 8px 12px 0; height: calc(100vh - 100px); }
  .left { display: flex; flex-direction: column; min-height: 0; }
  .left :global(.list) { flex: 1; }
  .right { display: flex; flex-direction: column; gap: 6px; min-height: 0; overflow-y: auto; padding-right: 4px; }
  .check { flex-direction: row; align-items: center; color: var(--text); justify-content: center; }
  details { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; margin-bottom: 6px; }
  summary { cursor: pointer; font-weight: 600; }
  details[open] summary { margin-bottom: 8px; }
  .foot { display: flex; gap: 8px; align-items: center; padding: 6px 12px; }
  .grow { flex: 1; }
</style>
