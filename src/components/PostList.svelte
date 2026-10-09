<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/api";
  import { confirmDelete } from "../lib/confirmDelete";
  import type { PresetStore } from "../lib/presetStore.svelte";
  import { statusLabel } from "../lib/textLayout";
  import type { Project, Row } from "../lib/types";

  let { project, store, selected = $bindable(), picked = $bindable(), toast, busy }: {
    project: Project; store: PresetStore; selected: number; picked: Set<number>; toast: (t: string) => void; busy: boolean;
  } = $props();
  let tool: "" | "paste" | "template" = $state("");
  let pasteText = $state("");
  let template = $state("Tập {stt}");
  let tracks: string[] = $state([]);
  const folder = $derived(store.preset.music.folder);
  $effect(() => { folder; refreshTracks(); });
  async function refreshTracks() { try { await store.flush(); tracks = await api.listMusic(); } catch { tracks = []; } }
  const name = (p: string) => p.split(/[\\/]/).pop();
  const checked = () => [...picked].sort((a, b) => a - b);

  async function run(work: () => Promise<number>, done: (n: number) => string) {
    try { await store.flush(); toast(done(await work())); } catch (e) { toast(String(e)); }
  }
  const pasteTexts = () => run(() => api.pasteTexts(selected || 1, pasteText, project.imageDir), (n) => { tool = ""; pasteText = ""; return `Đã điền ${n} text`; });
  const applyTemplate = () => run(() => api.applyTextTemplate(template, checked(), project.imageDir), (n) => { tool = ""; return `Đã đặt text cho ${n} video`; });
  const assignMusic = () => run(() => api.assignMusicInOrder(checked(), project.imageDir), (n) => `Đã gán nhạc lần lượt cho ${n} video`);
  async function importTable() {
    const f = await open({ filters: [{ name: "Bảng", extensions: ["xlsx", "csv"] }] });
    if (typeof f !== "string") return;
    try { await store.flush(); const u = await api.importTable(f); toast(u.length ? `Không khớp: ${u.join(", ")}` : "Đã nhập bảng"); } catch (e) { toast(String(e)); }
  }
  async function save(row: Row, patch: Partial<Pick<Row, "text" | "music">>) {
    try { await api.updateRow({ stt: row.stt, prompt: row.prompt, text: patch.text ?? row.text, music: patch.music === undefined ? row.music : patch.music, textOverride: row.textOverride }, project.imageDir); }
    catch (e) { toast(String(e)); }
  }
  async function deletePicked() {
    const stts = checked();
    if (!stts.length || !(await confirmDelete(stts.length, "cảnh"))) return;
    try {
      const kept = await api.deleteRows(stts, project.imageDir);
      picked = new Set(kept);
      if (kept.length) toast(`Cảnh ${kept.join(", ")} đang xử lý nên chưa xoá`);
    } catch (e) { toast(String(e)); }
  }
  function tickAll(on: boolean) { picked = new Set(on ? project.rows.map((r) => r.stt) : []); }
  function toggle(stt: number) { const s = new Set(picked); s.has(stt) ? s.delete(stt) : s.add(stt); picked = s; }
</script>

<div class="tools">
  <label class="all" title="Chọn tất cả"><input type="checkbox" checked={picked.size > 0 && picked.size === project.rows.length} onchange={(e) => tickAll(e.currentTarget.checked)} /> Tất cả</label>
  <button onclick={() => (tool = tool === "paste" ? "" : "paste")} disabled={busy}>Dán nhiều text</button>
  <button onclick={() => (tool = tool === "template" ? "" : "template")} disabled={busy}>Text theo mẫu</button>
  <button onclick={assignMusic} disabled={busy} title="Lấy nhạc trong folder nhạc theo thứ tự tên, gán cho video 1, 2, 3…">Gán nhạc lần lượt</button>
  <button onclick={importTable} disabled={busy}>Nhập Excel/CSV</button>
  <button class="del" onclick={deletePicked} disabled={busy || !picked.size} title="Bỏ các cảnh không cần khỏi dự án (không xoá file)">Xoá cảnh đã tick ({picked.size})</button>
</div>
{#if tool}
  <div class="batch">
    {#if tool === "paste"}
      <textarea rows="3" placeholder="Mỗi dòng là text của một video, điền từ dòng đang chọn" bind:value={pasteText}></textarea>
      <button class="primary" onclick={pasteTexts}>Điền</button>
    {:else}
      <input placeholder="Tập {"{stt}"}" bind:value={template} title="{'{stt}'} = số thứ tự, {'{ten}'} = tên ảnh" />
      <span class="hint">{picked.size ? `cho ${picked.size} dòng chọn` : "cho mọi dòng"}</span>
      <button class="primary" onclick={applyTemplate}>Áp dụng</button>
    {/if}
  </div>
{/if}
<div class="list">
  {#each project.rows as row (`${project.imageDir}:${row.stt}`)}
    <div class="item" class:sel={selected === row.stt} onclick={() => (selected = row.stt)} role="presentation">
      <input type="checkbox" checked={picked.has(row.stt)} onclick={(e) => e.stopPropagation()} onchange={() => toggle(row.stt)} />
      <b>{row.stt}</b>
      {#if row.images[0]}<img src={convertFileSrc(row.images[0])} alt="" loading="lazy" title={row.images.map(name).join(", ")} />{:else}<span class="noimg">—</span>{/if}
      <input type="text" class="text" value={row.text} placeholder="Text trên video" onclick={(e) => e.stopPropagation()} onchange={(e) => save(row, { text: e.currentTarget.value })} />
      <select class="music" value={row.music ?? ""} onclick={(e) => e.stopPropagation()} onchange={(e) => save(row, { music: e.currentTarget.value || null })}>
        <option value="">Nhạc tự động</option>
        {#if row.music && !tracks.includes(row.music)}<option value={row.music}>{name(row.music)}</option>{/if}
        {#each tracks as t}<option value={t}>{name(t)}</option>{/each}
      </select>
      <span class="st {row.status.state}">{statusLabel(row.status)}</span>
    </div>
  {/each}
</div>

<style>
  .tools, .batch { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding: 6px 0; }
  .batch textarea, .batch input { flex: 1; }
  .all { flex-direction: row; align-items: center; gap: 4px; color: var(--text); padding: 0 6px 0 8px; }
  .del { color: var(--bad); }
  .hint { color: var(--muted); font-size: 12px; }
  .list { overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
  .item { display: grid; grid-template-columns: 20px 28px 48px 1fr 130px 64px; gap: 6px; align-items: center; padding: 4px 8px; border-bottom: 1px solid var(--line); cursor: pointer; }
  .item.sel { background: #eaf1ff; }
  img { width: 48px; height: 28px; object-fit: cover; border-radius: 3px; }
  .text, .music { min-width: 0; padding: 3px 6px; }
  .st { font-size: 12px; white-space: nowrap; }
  .st.done, .st.generated { color: var(--ok); } .st.failed { color: var(--bad); } .st.postProcessing { color: var(--warn); }
</style>
