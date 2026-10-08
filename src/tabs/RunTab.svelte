<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { api } from "../lib/api";
  import { renderOverlayPng } from "../lib/overlay";
  import { resolutionFor, statusLabel } from "../lib/textLayout";
  import type { Project, Status } from "../lib/types";

  let { project, status, toast, onBusyChange = () => {} }: { project: Project; status: Status; toast: (t: string) => void; onBusyChange?: (busy: boolean) => void } = $props();
  let picked = $state(new Set<number>());
  // busy guards Start/Retry/Reprocess; pausing is separate so Pause stays usable while Start
  // is still encoding images (the engine already reports running then).
  let busy = $state(false);
  let pausing = $state(false);
  $effect(() => onBusyChange(busy || pausing));
  const failed = $derived(project.rows.filter((r) => r.status.state === "failed").map((r) => r.stt));
  const doneCount = $derived(project.rows.filter((r) => r.status.state === "done").length);

  async function renderOverlays(snapshot: Project, stts: number[]) {
    const { w, h } = resolutionFor(snapshot.preset.gen);
    const items = [];
    for (const row of snapshot.rows.filter((r) => stts.includes(r.stt))) {
      items.push({ stt: row.stt, pngBase64: await renderOverlayPng(row.textOverride ?? snapshot.preset.text, row.text, w, h) });
    }
    await api.saveOverlays(items);
  }
  async function act(f: (snapshot: Project) => Promise<void>) {
    if (busy) return;
    const snapshot = structuredClone($state.snapshot(project));
    busy = true;
    try { await f(snapshot); } catch (e) { toast(String(e)); } finally { busy = false; }
  }
  async function pauseRun() {
    if (pausing) return;
    pausing = true;
    try { await api.pauseRun(); } catch (e) { toast(String(e)); } finally { pausing = false; }
  }
  const start = () => act(async (snapshot) => {
    await renderOverlays(snapshot, snapshot.rows.filter((r) => r.status.state === "pending").map((r) => r.stt));
    await api.startRun();
  });
  // Rows failed at generation/download go back to Pending, so start them right away;
  // startRun rejects when only post-processing retries remain, which is fine.
  const retry = (stts: number[]) => act(async (snapshot) => {
    await renderOverlays(snapshot, stts);
    await api.retryRows(stts);
    if (status.connected) await api.startRun().catch(() => {});
  });
  const reprocess = (stts: number[]) => act(async (snapshot) => { await renderOverlays(snapshot, stts); await api.reprocessRows(stts); });
  async function pickFfmpeg() {
    const dir = await open({ directory: true, title: "Chọn thư mục chứa ffmpeg.exe" });
    if (typeof dir === "string") await api.setFfmpegDir(dir).catch(toast);
  }
  const toggle = (stt: number) => { const s = new Set(picked); s.has(stt) ? s.delete(stt) : s.add(stt); picked = s; };
</script>

<div class="bar">
  <span class="dot" class:on={status.connected}></span>
  {status.connected ? `Extension đã kết nối (v${status.extVersion ?? "?"})` : "Extension chưa kết nối — mở Chrome có cài extension 1Click"}
  {#if status.extId}<button title="Cho phép một extension khác kết nối" onclick={() => api.resetExtension()}>Quên extension {status.extId.slice(0, 6)}…</button>{/if}
  {#if !status.ffmpeg}<button onclick={pickFfmpeg}>Chọn thư mục FFmpeg</button>{/if}
  <span class="grow"></span>
  <span>{doneCount}/{project.rows.length} xong</span>
  <button class="primary" disabled={busy || status.running || !status.connected} onclick={start}>Bắt đầu</button>
  <button disabled={pausing || !status.running} onclick={pauseRun}>Tạm dừng</button>
  <button disabled={!failed.length || busy} onclick={() => retry(failed)}>Thử lại {failed.length} dòng lỗi</button>
  <button disabled={!picked.size || busy} onclick={() => reprocess([...picked])}>Chỉ hậu kỳ lại ({picked.size})</button>
  <button onclick={() => api.openPath(project.preset.output.folder ?? `${project.imageDir}\\Output`)}>Mở folder Output</button>
</div>
<div class="list">
  {#each project.rows as row (row.stt)}
    <div class="item">
      <input type="checkbox" checked={picked.has(row.stt)} onchange={() => toggle(row.stt)} disabled={!row.rawVideo} />
      <b>{String(row.stt).padStart(3, "0")}</b>
      <span class="name">{row.imagePath.split(/[\\/]/).pop()}</span>
      <span class="st {row.status.state}">{statusLabel(row.status)}</span>
      {#if row.status.state === "rendering"}<progress max="100" value={row.status.percent}></progress>{/if}
      {#if row.status.state === "failed"}<span class="err">{row.status.message}</span><button onclick={() => retry([row.stt])}>Thử lại</button>{/if}
      {#if row.output}<button onclick={() => api.openPath(row.output!)}>Xem</button>{/if}
    </div>
  {/each}
</div>

<style>
  .bar { display: flex; gap: 8px; align-items: center; padding: 12px; flex-wrap: wrap; }
  .grow { flex: 1; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--bad); } .dot.on { background: var(--ok); }
  .list { padding: 0 12px; height: calc(100vh - 170px); overflow-y: auto; }
  .item { display: flex; gap: 10px; align-items: center; padding: 8px; background: var(--panel); border-bottom: 1px solid var(--line); }
  .name { width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .err { color: var(--bad); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st.done { color: var(--ok); } .st.failed { color: var(--bad); } .st.rendering, .st.sending, .st.postProcessing { color: var(--warn); }
  progress { width: 140px; }
</style>
