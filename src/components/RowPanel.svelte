<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { api } from "../lib/api";
  import { resolutionFor } from "../lib/textLayout";
  import type { Project, Row } from "../lib/types";
  import TextPreview from "./TextPreview.svelte";
  import TextStyleEditor from "./TextStyleEditor.svelte";

  let { project, row, onclose, toast }: { project: Project; row: Row; onclose: () => void; toast: (t: string) => void } = $props();
  const imageDir = project.imageDir;
  let live = true;
  onDestroy(() => { live = false; });
  let prompt = $state(row.prompt);
  let text = $state(row.text);
  let music = $state(row.music ?? "");
  let own = $state(row.textOverride !== null);
  let style = $state(row.textOverride ?? { ...project.preset.text });
  let tracks: string[] = $state([]);
  const res = $derived(resolutionFor(project.preset.gen));
  onMount(async () => (tracks = await api.listMusic()));

  async function save() {
    try {
      await api.updateRow({ stt: row.stt, prompt, text, music: music || null, textOverride: own ? $state.snapshot(style) : null }, imageDir);
      if (live) onclose();
    } catch (e) { if (live) toast(String(e)); }
  }
</script>

<div class="panel">
  <h3>Dòng {row.stt} — {row.imagePath.split(/[\\/]/).pop()}</h3>
  <label>Prompt riêng (trống = dùng prompt chung) <textarea rows="3" bind:value={prompt}></textarea></label>
  <label>Text trên video <textarea rows="2" bind:value={text}></textarea></label>
  <label>Nhạc gán cố định
    <select bind:value={music}>
      <option value="">Theo chế độ nhạc chung</option>
      {#each tracks as t}<option value={t}>{t.split(/[\\/]/).pop()}</option>{/each}
    </select>
  </label>
  <label class="inline"><input type="checkbox" bind:checked={own} /> Kiểu/vị trí text riêng cho video này</label>
  {#if own}
    <TextPreview bind:style {text} w={res.w} h={res.h} imagePath={row.imagePath} />
    <TextStyleEditor bind:style />
  {/if}
  <div class="actions"><button onclick={onclose}>Huỷ</button><button class="primary" onclick={save}>Lưu</button></div>
</div>

<style>
  .panel { display: flex; flex-direction: column; gap: 10px; padding: 16px; background: var(--panel); border-left: 1px solid var(--line); width: 460px; overflow-y: auto; }
  .inline { flex-direction: row; align-items: center; color: var(--text); font-size: 14px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
