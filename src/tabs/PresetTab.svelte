<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { onDestroy, onMount, tick } from "svelte";
  import { api } from "../lib/api";
  import { resolutionFor } from "../lib/textLayout";
  import type { Preset, Project } from "../lib/types";
  import TextPreview from "../components/TextPreview.svelte";
  import TextStyleEditor from "../components/TextStyleEditor.svelte";

  let { project, toast, locked = false }: { project: Project; toast: (t: string) => void; locked?: boolean } = $props();
  let preset: Preset = $state(structuredClone($state.snapshot(project.preset)));
  let presets: string[] = $state([]);
  let presetName = $state("");
  const imageDir = project.imageDir;
  let live = true;
  let queue: Promise<void> = Promise.resolve();
  let lastWritten = JSON.stringify($state.snapshot(preset));
  let observed = lastWritten;
  let loadRevision = 0;
  let loading = false;
  const res = $derived(resolutionFor(preset.gen));
  const sample = $derived(project.rows.find((r) => r.text)?.text ?? "Chữ mẫu trên video");
  onMount(() => { api.listPresets().then((p) => { if (live) presets = p; }).catch((e) => toast(String(e))); });

  let timer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => { live = false; clearTimeout(timer); loadRevision++; });
  function enqueue(work: () => Promise<void>) {
    const result = queue.then(async () => {
      if (!live) throw new Error("Dự án đã thay đổi");
      await work();
    });
    // Failed writes remain dirty and are retried by the next explicit flush.
    queue = result.catch(() => {});
    return result;
  }
  async function writeSnapshot(snap: Preset) {
    const json = JSON.stringify(snap);
    if (json === lastWritten) return;
    await api.setPreset(snap, imageDir);
    lastWritten = json;
  }
  export async function flush(): Promise<void> {
    do {
      await tick();
      clearTimeout(timer);
      if (loading) await queue;
      const snap = $state.snapshot(preset) as Preset;
      await enqueue(() => writeSnapshot(snap));
      await tick();
    } while (JSON.stringify($state.snapshot(preset)) !== lastWritten);
    clearTimeout(timer);
  }
  $effect(() => {
    const snap = $state.snapshot(preset) as Preset;
    const json = JSON.stringify(snap);
    if (json === observed) return;
    observed = json;
    clearTimeout(timer);
    timer = setTimeout(() => enqueue(() => writeSnapshot(snap)).catch((e) => toast(String(e))), 400);
  });

  async function pickDir(target: "music" | "output") {
    const dir = await open({ directory: true });
    if (!live || typeof dir !== "string") return;
    if (target === "music") preset.music.folder = dir; else preset.output.folder = dir;
  }
  async function savePreset() {
    if (!presetName.trim()) return toast("Nhập tên preset");
    await tick();
    clearTimeout(timer);
    if (loading) await queue;
    const snap = $state.snapshot(preset) as Preset;
    const name = presetName;
    try {
      await enqueue(async () => {
        await writeSnapshot(snap);
        if (!live) throw new Error("Dự án đã thay đổi");
        await api.savePreset(name, imageDir);
      });
      if (!live) return;
      toast("Đã lưu preset");
      presets = await api.listPresets();
    } catch (e) { if (live) toast(String(e)); }
  }
  async function loadPreset(name: string) {
    await tick();
    clearTimeout(timer);
    const snap = $state.snapshot(preset) as Preset;
    const flushLocal = !loading;
    const revision = ++loadRevision;
    loading = true;
    try {
      await enqueue(async () => {
        // A second queued load must not restore the pre-load local snapshot.
        if (flushLocal) await writeSnapshot(snap);
        if (!live) throw new Error("Dự án đã thay đổi");
        const loaded = await api.loadPreset(name, imageDir);
        if (!live || revision !== loadRevision) return;
        lastWritten = observed = JSON.stringify(loaded);
        preset = loaded;
        presetName = name;
      });
    } catch (e) { if (live) toast(String(e)); }
    finally { if (revision === loadRevision) loading = false; }
  }
</script>

<fieldset class="cols" disabled={locked} inert={locked}>
  <section>
    <h3>Tạo video</h3>
    <label>Chế độ
      <select bind:value={preset.gen.mode}>
        <option value="imageToVideo">Ảnh làm khung hình đầu</option>
        <option value="componentsToVideo">Ảnh làm ảnh tham chiếu</option>
      </select>
    </label>
    <label>Tỉ lệ <select bind:value={preset.gen.aspectRatio}><option>16:9</option><option>9:16</option></select></label>
    <label>Chất lượng <select bind:value={preset.gen.quality}><option>720p</option><option>1080p</option></select></label>
    <label>Số luồng (1–10) <input type="number" min="1" max="10" bind:value={preset.gen.concurrency} /></label>
    <label>Số lần thử lại <input type="number" min="0" max="5" bind:value={preset.gen.maxRetries} /></label>

    <h3>Nhạc nền</h3>
    <label>Folder nhạc <button onclick={() => pickDir("music")}>{preset.music.folder ?? "Chọn…"}</button></label>
    <label>Chế độ
      <select bind:value={preset.music.mode}>
        <option value="random">Ngẫu nhiên</option><option value="sequential">Lần lượt</option><option value="assigned">Gán theo dòng</option>
      </select>
    </label>
    {#if preset.music.mode === "assigned"}
      <label>Dòng chưa gán dùng
        <select bind:value={preset.music.fallback}><option value="random">Ngẫu nhiên</option><option value="sequential">Lần lượt</option></select>
      </label>
    {/if}
    <label>Âm lượng nhạc {Math.round(preset.music.musicVolume * 100)}% <input type="range" min="0" max="1.5" step="0.05" bind:value={preset.music.musicVolume} /></label>
    <label>Âm gốc {Math.round(preset.music.originalVolume * 100)}% <input type="range" min="0" max="1.5" step="0.05" bind:value={preset.music.originalVolume} /></label>
    <label>Fade vào (giây) <input type="number" min="0" max="10" step="0.5" bind:value={preset.music.fadeIn} /></label>
    <label>Fade ra (giây) <input type="number" min="0" max="10" step="0.5" bind:value={preset.music.fadeOut} /></label>

    <h3>Đầu ra</h3>
    <label>Folder Output <button onclick={() => pickDir("output")}>{preset.output.folder ?? "Mặc định: <folder ảnh>\\Output"}</button></label>
    <label class="inline"><input type="checkbox" bind:checked={preset.output.overwrite} /> Ghi đè file trùng tên</label>

    <h3>Preset</h3>
    <div class="row"><input placeholder="Tên preset" bind:value={presetName} /><button onclick={savePreset}>Lưu</button></div>
    <div class="row">{#each presets as p}<button onclick={() => loadPreset(p)}>{p}</button>{/each}</div>
  </section>
  <section>
    <h3>Text (chung cho mọi video)</h3>
    <TextPreview bind:style={preset.text} text={sample} w={res.w} h={res.h} imagePath={project.rows[0]?.imagePath} />
    <TextStyleEditor bind:style={preset.text} />
  </section>
</fieldset>

<style>
  .cols { border: 0; margin: 0; min-width: 0; display: grid; grid-template-columns: 360px 1fr; gap: 24px; padding: 16px; height: calc(100vh - 110px); overflow-y: auto; }
  section { display: flex; flex-direction: column; gap: 10px; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; }
  .inline { flex-direction: row; align-items: center; color: var(--text); font-size: 14px; }
</style>
