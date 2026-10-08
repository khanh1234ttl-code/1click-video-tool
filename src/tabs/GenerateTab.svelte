<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/api";
  import { renderOverlays } from "../lib/exportOverlays";
  import type { PresetStore } from "../lib/presetStore.svelte";
  import { statusLabel } from "../lib/textLayout";
  import type { Project, Row, Status } from "../lib/types";
  import GenSettingsBar from "../components/GenSettingsBar.svelte";

  let { project, store, status, toast, beforeNavigate = async () => {}, onBusyChange = () => {} }: {
    project: Project | null; store: PresetStore | null; status: Status; toast: (t: string) => void;
    beforeNavigate?: () => Promise<void>; onBusyChange?: (busy: boolean) => void;
  } = $props();
  let opening = $state(false);
  // busy guards Start/Retry; stopping is separate so Dừng stays usable while Start still encodes.
  let busy = $state(false);
  let stopping = $state(false);
  let selected = $state(0);
  let common = $state("");
  let pasteText = $state("");
  let pasteFrom = $state(1);
  let showPaste = $state(false);
  $effect(() => onBusyChange(opening || busy || stopping));
  $effect(() => { common = project?.commonPrompt ?? ""; });
  let shownProject: string | undefined;
  $effect(() => { const dir = project?.imageDir; if (dir !== shownProject) { shownProject = dir; selected = 0; } });
  const failed = $derived(project?.rows.filter((r) => r.status.state === "failed").map((r) => r.stt) ?? []);
  const generated = $derived(project?.rows.filter((r) => r.rawVideo).length ?? 0);
  const name = (p: string) => p.split(/[\\/]/).pop();

  async function pickFolder() {
    if (opening) return;
    opening = true;
    try {
      await beforeNavigate();
      const dir = await open({ directory: true, title: "Chọn folder ảnh" });
      if (typeof dir === "string") await api.openProject(dir);
    } catch (e) { toast(String(e)); }
    finally { opening = false; }
  }
  async function importTable() {
    const f = await open({ filters: [{ name: "Bảng", extensions: ["xlsx", "csv"] }] });
    if (typeof f !== "string") return;
    try {
      await store?.flush();
      const unmatched = await api.importTable(f);
      toast(unmatched.length ? `Không khớp: ${unmatched.join(", ")}` : "Đã nhập bảng");
    } catch (e) { toast(String(e)); }
  }
  function select(row: Row) { selected = row.stt; pasteFrom = row.stt; }
  function togglePaste() { showPaste = !showPaste; if (showPaste) pasteFrom = selected || 1; }
  async function paste() {
    try {
      const n = await api.pastePrompts(pasteFrom, pasteText);
      toast(`Đã điền ${n} prompt`);
      showPaste = false;
      pasteText = "";
    } catch (e) { toast(String(e)); }
  }
  async function savePrompt(row: Row, prompt: string) {
    if (!project) return;
    try { await api.updateRow({ stt: row.stt, prompt, text: row.text, music: row.music, textOverride: row.textOverride }, project.imageDir); }
    catch (e) { toast(String(e)); }
  }
  async function act(f: () => Promise<void>) {
    if (busy || !store) return;
    busy = true;
    try {
      await store.flush();
      await f();
    } catch (e) { toast(String(e)); } finally { busy = false; }
  }
  /** The backend's acknowledged project: what start/retry will actually use. */
  async function durable(): Promise<Project> {
    const p = await api.getProject();
    if (!p || p.imageDir !== store?.imageDir) throw new Error("Dự án đã thay đổi");
    return p;
  }
  const start = () => act(async () => {
    const p = await durable();
    if (p.preset.gen.autoPostProcess) await renderOverlays(p, p.rows.filter((r) => r.status.state === "pending").map((r) => r.stt));
    await api.startRun();
  });
  // Generation/download failures go back to Chờ and start right away; post-process failures
  // only need their overlays, which are rendered here too.
  const retry = (stts: number[]) => act(async () => {
    await renderOverlays(await durable(), stts);
    await api.retryRows(stts);
    if (status.connected) await api.startRun().catch(() => {});
  });
  async function stop() {
    if (stopping) return;
    stopping = true;
    try { await api.pauseRun(); } catch (e) { toast(String(e)); } finally { stopping = false; }
  }
</script>

<div class="bar">
  <button class="primary" onclick={pickFolder} disabled={opening || busy || stopping}>Chọn folder ảnh</button>
  <button onclick={importTable} disabled={!project}>Nhập Excel/CSV</button>
  <button onclick={togglePaste} disabled={!project}>Dán nhiều prompt</button>
  <input class="grow" placeholder="Prompt chung cho các dòng chưa có prompt riêng" bind:value={common} onchange={() => api.setCommonPrompt(common).catch(toast)} disabled={!project} />
</div>
{#if store}<GenSettingsBar bind:gen={store.preset.gen} />{/if}
{#if showPaste}
  <div class="paste">
    <textarea rows="4" placeholder="Mỗi dòng một prompt" bind:value={pasteText}></textarea>
    <label>Điền từ dòng <input type="number" min="1" bind:value={pasteFrom} /></label>
    <button class="primary" onclick={paste}>Điền</button>
  </div>
{/if}

{#if project}
  <div class="tablewrap">
    <table>
      <thead><tr><th>STT</th><th>Ảnh</th><th>Tên file</th><th>Prompt</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>
        {#each project.rows as row (`${project.imageDir}:${row.stt}`)}
          <tr class:sel={selected === row.stt} onclick={() => select(row)}>
            <td>{row.stt}</td>
            <td><img src={convertFileSrc(row.imagePath)} alt="" loading="lazy" /></td>
            <td class="clip">{name(row.imagePath)}</td>
            <td class="prompt"><input type="text" value={row.prompt} placeholder={project.commonPrompt || "Nhập prompt"} onchange={(e) => savePrompt(row, e.currentTarget.value)} /></td>
            <td class="st {row.status.state}" title={row.status.state === "failed" ? row.status.message : ""}>
              {statusLabel(row.status)}
              {#if row.status.state === "rendering"}<progress max="100" value={row.status.percent}></progress>{/if}
              {#if row.status.state === "failed"}<button class="mini" onclick={(e) => { e.stopPropagation(); retry([row.stt]); }}>Thử lại</button>{/if}
            </td>
            <td><button class="mini" disabled={!row.output && !row.rawVideo} onclick={(e) => { e.stopPropagation(); api.openPath((row.output ?? row.rawVideo)!); }}>Xem</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="foot">
    <span>{generated}/{project.rows.length} đã tạo</span>
    <span class="grow"></span>
    <button class="primary" disabled={busy || opening || status.running || !status.connected} onclick={start}>Bắt đầu tạo</button>
    <button disabled={stopping || !status.running} onclick={stop} title="Hủy các video đang tạo; dòng chưa xong về Chờ">Dừng</button>
    <button disabled={!failed.length || busy} onclick={() => retry(failed)}>Thử lại {failed.length} dòng lỗi</button>
    <button onclick={() => api.openPath(`${project.imageDir}\\_1click\\raw`)}>Mở folder video gốc</button>
  </div>
{:else}
  <p class="empty">Chọn một folder ảnh để bắt đầu. Ảnh được sắp theo tên (1, 2, 10…).</p>
{/if}

<style>
  .bar, .paste, .foot { display: flex; gap: 8px; align-items: center; padding: 8px 12px; }
  .paste { align-items: flex-end; } .paste textarea { flex: 1; }
  .grow { flex: 1; }
  .tablewrap { height: calc(100vh - 205px); overflow: auto; background: var(--panel); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 8px; border-bottom: 1px solid var(--line); text-align: left; }
  th { position: sticky; top: 0; background: var(--panel); color: var(--muted); font-weight: 600; z-index: 1; }
  tr.sel { background: #eaf1ff; }
  img { width: 56px; height: 32px; object-fit: cover; border-radius: 4px; display: block; }
  .clip { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prompt { width: 55%; } .prompt input { width: 100%; }
  .mini { padding: 2px 8px; font-size: 12px; }
  progress { width: 70px; vertical-align: middle; }
  .st { white-space: nowrap; }
  .st.done, .st.generated { color: var(--ok); } .st.failed { color: var(--bad); } .st.rendering, .st.sending, .st.postProcessing, .st.downloaded { color: var(--warn); }
  .empty { padding: 40px; color: var(--muted); }
</style>
