<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/api";
  import { statusLabel } from "../lib/textLayout";
  import type { Project, Row } from "../lib/types";
  import RowPanel from "../components/RowPanel.svelte";

  let { project, toast }: { project: Project | null; toast: (t: string) => void } = $props();
  let selected: Row | null = $state(null);
  let common = $state("");
  let pasteText = $state("");
  let pasteFrom = $state(1);
  let showPaste = $state(false);
  $effect(() => { common = project?.commonPrompt ?? ""; });

  async function pickFolder() {
    const dir = await open({ directory: true, title: "Chọn folder ảnh" });
    if (typeof dir === "string") await api.openProject(dir).catch(toast);
  }
  async function importTable() {
    const f = await open({ filters: [{ name: "Bảng", extensions: ["xlsx", "csv"] }] });
    if (typeof f !== "string") return;
    try {
      const unmatched = await api.importTable(f);
      toast(unmatched.length ? `Không khớp ảnh: ${unmatched.join(", ")}` : "Đã nhập bảng");
    } catch (e) { toast(String(e)); }
  }
  async function paste() {
    const n = await api.pastePrompts(pasteFrom, pasteText);
    toast(`Đã điền ${n} prompt`);
    showPaste = false;
    pasteText = "";
  }
</script>

<div class="bar">
  <button class="primary" onclick={pickFolder}>Chọn folder ảnh</button>
  <button onclick={importTable} disabled={!project}>Nhập CSV/Excel</button>
  <button onclick={() => (showPaste = !showPaste)} disabled={!project}>Dán nhiều prompt</button>
  <input class="grow" placeholder="Prompt chung cho các dòng chưa có prompt riêng" bind:value={common} onchange={() => api.setCommonPrompt(common)} disabled={!project} />
</div>
{#if showPaste}
  <div class="paste">
    <textarea rows="5" placeholder="Mỗi dòng một prompt" bind:value={pasteText}></textarea>
    <label>Điền từ dòng <input type="number" min="1" bind:value={pasteFrom} /></label>
    <button class="primary" onclick={paste}>Điền</button>
  </div>
{/if}

{#if project}
  <div class="wrap">
    <div class="tablewrap">
    <table>
      <thead><tr><th>STT</th><th>Ảnh</th><th>Tên file</th><th>Prompt</th><th>Text</th><th>Nhạc</th><th>Trạng thái</th></tr></thead>
      <tbody>
        {#each project.rows as row (row.stt)}
          <tr class:sel={selected?.stt === row.stt} onclick={() => (selected = row)}>
            <td>{row.stt}</td>
            <td><img src={convertFileSrc(row.imagePath)} alt="" loading="lazy" /></td>
            <td>{row.imagePath.split(/[\\/]/).pop()}</td>
            <td class="clip">{row.prompt || (project.commonPrompt ? "(prompt chung)" : "—")}</td>
            <td class="clip">{row.text}</td>
            <td>{row.music ? row.music.split(/[\\/]/).pop() : "Tự động"}</td>
            <td class="st {row.status.state}">{statusLabel(row.status)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
    {#if selected}
      {#key selected.stt}<RowPanel {project} row={selected} onclose={() => (selected = null)} />{/key}
    {/if}
  </div>
{:else}
  <p class="empty">Chọn một folder ảnh để bắt đầu. Ảnh được sắp theo tên (1, 2, 10…).</p>
{/if}

<style>
  .bar, .paste { display: flex; gap: 8px; align-items: center; padding: 12px; }
  .paste { align-items: flex-end; } .paste textarea { flex: 1; }
  .grow { flex: 1; }
  .wrap { display: flex; height: calc(100vh - 170px); }
  .tablewrap { flex: 1; min-width: 0; overflow: auto; background: var(--panel); }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: left; }
  th { position: sticky; top: 0; background: var(--panel); color: var(--muted); font-weight: 600; }
  tr { cursor: pointer; } tr.sel { background: #eaf1ff; }
  img { width: 72px; height: 40px; object-fit: cover; border-radius: 4px; }
  .clip { max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .st.done { color: var(--ok); } .st.failed { color: var(--bad); } .st.rendering, .st.sending, .st.postProcessing { color: var(--warn); }
  .empty { padding: 40px; color: var(--muted); }
</style>
