<script lang="ts">
  import { onMount } from "svelte";
  import { api } from "./lib/api";
  import type { Project, Status } from "./lib/types";
  import PresetTab from "./tabs/PresetTab.svelte";
  import RunTab from "./tabs/RunTab.svelte";
  import SourceTab from "./tabs/SourceTab.svelte";

  let tab: "source" | "preset" | "run" = $state("source");
  let project: Project | null = $state(null);
  let status: Status = $state({ connected: false, extId: null, extVersion: null, ffmpeg: null, running: false });
  let toasts: { id: number; text: string }[] = $state([]);
  let n = 0;
  let presetEditor: { flush: () => Promise<void> } | undefined = $state();
  let navigation = 0;
  let projectRevision = 0;
  let navigating = $state(false);
  let runBusy = $state(false);
  let sourceBusy = $state(false);
  async function beforeNavigate(projectOpening = false) {
    if (runBusy || (sourceBusy && !projectOpening)) throw new Error("Đang xử lý thao tác hiện tại; vui lòng chờ hoàn tất");
    if (!presetEditor) return;
    await presetEditor.flush();
    // Command acknowledgement can precede the project event. Run needs the durable snapshot.
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
      try { await presetEditor?.flush(); } catch (e) { toast(e); }
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
  onMount(() => {
    api.getProject().then((p) => (project = p));
    api.getStatus().then((s) => (status = s));
    const offs = [api.onProject(receiveProject), api.onStatus((s) => (status = s)), api.onToast(toast)];
    return () => offs.forEach((o) => o.then((f) => f()));
  });
</script>

<header>
  <strong>1Click Video Tool</strong>
  <nav>
    <button class:active={tab === "source"} onclick={() => navigate("source")} disabled={runBusy || sourceBusy}>Nguồn</button>
    <button class:active={tab === "preset"} onclick={() => navigate("preset")} disabled={!project || runBusy || sourceBusy}>Preset</button>
    <button class:active={tab === "run"} onclick={() => navigate("run")} disabled={!project || runBusy || sourceBusy}>Chạy</button>
  </nav>
  <span class="conn" class:on={status.connected}>{status.connected ? "● Extension" : "○ Extension"}</span>
</header>
<main>
  {#if tab === "source"}<SourceTab {project} {toast} beforeNavigate={() => beforeNavigate(true)} onBusyChange={(busy) => (sourceBusy = busy)} />
  {:else if tab === "preset" && project}{#key project.imageDir}<PresetTab bind:this={presetEditor} {project} {toast} locked={navigating} />{/key}
  {:else if tab === "run" && project}<RunTab {project} {status} {toast} onBusyChange={(busy) => (runBusy = busy)} />{/if}
</main>
<div class="toasts">{#each toasts as t (t.id)}<div class="toast">{t.text}</div>{/each}</div>

<style>
  header { display: flex; align-items: center; gap: 16px; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
  nav { display: flex; gap: 4px; }
  nav button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .conn { margin-left: auto; color: var(--bad); } .conn.on { color: var(--ok); }
  .toasts { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; max-width: 420px; }
  .toast { background: #1d2330; color: #fff; padding: 10px 14px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
</style>
