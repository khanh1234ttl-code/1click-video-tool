<script lang="ts">
  import { api } from "../lib/api";
  import { renderOverlays } from "../lib/exportOverlays";
  import type { PresetStore } from "../lib/presetStore.svelte";
  import { resolutionFor } from "../lib/textLayout";
  import type { Project } from "../lib/types";
  import TextPreview from "../components/TextPreview.svelte";
  import TextStyleEditor from "../components/TextStyleEditor.svelte";

  let { project, store, toast, onBusyChange = () => {} }: { project: Project; store: PresetStore; toast: (t: string) => void; onBusyChange?: (b: boolean) => void } = $props();
  let busy = $state(false);
  $effect(() => onBusyChange(busy));
  let selected = $state(project.rows[0]?.stt ?? 0);
  const row = $derived(project.rows.find((r) => r.stt === selected));
  const res = $derived(resolutionFor(store.preset.gen));
  const ready = $derived(project.rows.filter((r) => r.rawVideo).map((r) => r.stt));

  async function exportRows(stts: number[]) {
    if (busy) return;
    busy = true;
    try {
      await store.flush();
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

{#if row}<TextPreview bind:style={store.preset.text} text={row.text || "Chữ mẫu trên video"} w={res.w} h={res.h} imagePath={row.imagePath} videoPath={row.rawVideo} />{/if}
<TextStyleEditor bind:style={store.preset.text} />
<button class="primary" disabled={busy || !ready.length} onclick={() => exportRows(ready)}>Xuất tất cả ({ready.length})</button>
