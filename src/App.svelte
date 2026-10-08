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
  function toast(t: unknown) {
    const id = ++n;
    toasts = [...toasts, { id, text: String(t) }];
    setTimeout(() => (toasts = toasts.filter((x) => x.id !== id)), 6000);
  }
  onMount(() => {
    api.getProject().then((p) => (project = p));
    api.getStatus().then((s) => (status = s));
    const offs = [api.onProject((p) => (project = p)), api.onStatus((s) => (status = s)), api.onToast(toast)];
    return () => offs.forEach((o) => o.then((f) => f()));
  });
</script>

<header>
  <strong>1Click Video Tool</strong>
  <nav>
    <button class:active={tab === "source"} onclick={() => (tab = "source")}>Nguồn</button>
    <button class:active={tab === "preset"} onclick={() => (tab = "preset")} disabled={!project}>Preset</button>
    <button class:active={tab === "run"} onclick={() => (tab = "run")} disabled={!project}>Chạy</button>
  </nav>
  <span class="conn" class:on={status.connected}>{status.connected ? "● Extension" : "○ Extension"}</span>
</header>
<main>
  {#if tab === "source"}<SourceTab {project} {toast} />
  {:else if tab === "preset" && project}{#key project.imageDir}<PresetTab {project} {toast} />{/key}
  {:else if tab === "run" && project}<RunTab {project} {status} {toast} />{/if}
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
