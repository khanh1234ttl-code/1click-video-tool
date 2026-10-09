<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { onMount, untrack } from "svelte";
  import { api } from "./lib/api";
  import { PresetStore } from "./lib/presetStore.svelte";
  import type { Project, Status } from "./lib/types";
  import GenerateTab from "./tabs/GenerateTab.svelte";
  import PostTab from "./tabs/PostTab.svelte";
  let tab: "generate" | "post" = $state("generate");
  let project: Project | null = $state(null);
  let status: Status = $state({ connected: false, extId: null, extVersion: null, ffmpeg: null, running: false });
  let toasts: { id: number; text: string }[] = $state([]);
  let n = 0;
  let store: PresetStore | null = $state(null);
  // One store per open project; the old one stops writing before the new project's store exists.
  $effect(() => {
    const p = project;
    untrack(() => {
      if (store?.imageDir === p?.imageDir) return;
      store?.destroy();
      store = p ? new PresetStore(p, toast) : null;
      presetName = "";
    });
  });
  let presetName = $state("");
  let showConn = $state(false);
  let navigation = 0;
  let projectRevision = 0;
  let navigating = $state(false);
  let stepBusy = $state(false);
  async function beforeNavigate(projectOpening = false) {
    // Opening a folder runs inside step 1's own busy window, so only other work blocks it.
    if (stepBusy && !projectOpening) throw new Error("Đang xử lý thao tác hiện tại; vui lòng chờ hoàn tất");
    if (!store) return;
    await store.flush();
    // Command acknowledgement can precede the project event; the next step needs the durable snapshot.
    const latest = await api.getProject();
    if (latest?.imageDir !== project?.imageDir) throw new Error("Dự án đã thay đổi");
    project = latest;
  }
  async function navigate(next: typeof tab) {
    const revision = ++navigation;
    navigating = true;
    try { await beforeNavigate(); if (revision === navigation) tab = next; }
    catch (e) { toast(e); }
    finally { if (revision === navigation) navigating = false; }
  }
  async function receiveProject(p: Project) {
    const revision = ++projectRevision;
    const changed = project && project.imageDir !== p.imageDir;
    if (changed) {
      ++navigation;
      try { await store?.flush(); } catch (e) { toast(e); }
    }
    if (revision === projectRevision) {
      project = p;
      if (changed) navigating = false;
    }
  }
  function toast(t: unknown) {
    const id = ++n;
    toasts = [...toasts, { id, text: String(t) }];
    setTimeout(() => (toasts = toasts.filter((x) => x.id !== id)), 6000);
  }
  async function pickFfmpeg() {
    const dir = await open({ directory: true, title: "Chọn thư mục chứa ffmpeg và ffprobe" });
    if (typeof dir === "string") await api.setFfmpegDir(dir).catch(toast);
  }
  onMount(() => {
    api.getProject().then((p) => (project = p));
    api.getStatus().then((s) => (status = s));
    const offs = [api.onProject(receiveProject), api.onStatus((s) => (status = s)), api.onToast(toast)];
    return () => { offs.forEach((o) => o.then((f) => f())); store?.destroy(); };
  });
</script>

<header>
  <strong>1Click Video Tool</strong>
  <nav>
    <button class:active={tab === "generate"} onclick={() => navigate("generate")} disabled={stepBusy}>1. Tạo video</button>
    <button class:active={tab === "post"} onclick={() => navigate("post")} disabled={!project || stepBusy}>2. Hậu kỳ</button>
  </nav>
  <span class="grow"></span>
  {#if store}
    <select aria-label="Nạp preset" value="" onchange={(e) => { const n = e.currentTarget.value; e.currentTarget.value = ""; if (n) store!.load(n).then(() => (presetName = store!.name)); }} disabled={navigating}>
      <option value="">Preset…</option>
      {#each store.presets as p}<option value={p}>{p}</option>{/each}
    </select>
    <input class="pname" placeholder="Tên preset" bind:value={presetName} disabled={navigating} />
    <button onclick={() => store!.save(presetName)} disabled={navigating}>Lưu</button>
  {/if}
  {#if status.connected}
    <button onclick={() => api.setHideChrome(!status.hideChrome).catch(toast)} title={status.hideChrome ? "Cho cửa sổ Chrome tạo video hiện lại" : "Ẩn hẳn cửa sổ Chrome tạo video (màn hình và taskbar)"}>{status.hideChrome ? "Hiện Chrome" : "Ẩn Chrome"}</button>
  {/if}
  {#if !status.ffmpeg}<button class="warn" onclick={pickFfmpeg}>Thiếu FFmpeg — chọn thư mục</button>{/if}
  <button class="conn" class:on={status.connected} onclick={() => (showConn = !showConn)}>
    {status.connected ? `● Extension v${status.extVersion ?? "?"}` : "○ Extension chưa kết nối"}
  </button>
  {#if showConn}
    <div class="menu">
      <p>{status.connected ? `Đã kết nối ${status.extId ?? ""}` : "Mở Chrome có cài extension 1Click"}</p>
      {#if status.extId}<button onclick={() => { api.resetExtension(); showConn = false; }}>Quên extension</button>{/if}
      {#if status.bundledBrowser}<button onclick={() => { showConn = false; api.openVidsBrowser().catch(toast); }}>Mở trình duyệt Vids</button>{/if}
      <button onclick={() => { showConn = false; pickFfmpeg(); }}>Chọn thư mục FFmpeg</button>
    </div>
  {/if}
</header>
<main inert={navigating}>
  {#if tab === "generate"}<GenerateTab {project} {store} {status} {toast} beforeNavigate={() => beforeNavigate(true)} onBusyChange={(b) => (stepBusy = b)} />
  {:else if tab === "post" && project && store}{#key project.imageDir}<PostTab {project} {store} {toast} onBusyChange={(b) => (stepBusy = b)} />{/key}{/if}
</main>
<div class="toasts">{#each toasts as t (t.id)}<div class="toast">{t.text}</div>{/each}</div>

<style>
  header { position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--panel); border-bottom: 1px solid var(--line); }
  nav { display: flex; gap: 4px; margin-left: 8px; }
  nav button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .grow { flex: 1; }
  .pname { width: 120px; }
  .conn { border: 0; background: none; color: var(--bad); } .conn.on { color: var(--ok); }
  .warn { color: var(--bad); border-color: var(--bad); }
  .menu { position: absolute; right: 12px; top: 44px; z-index: 10; display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); }
  .menu p { margin: 0; color: var(--muted); font-size: 12px; }
  .toasts { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
  .toast { background: #1d2330; color: #fff; padding: 10px 14px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
</style>
