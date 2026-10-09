<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import type { OutputSettings } from "../lib/types";
  let { output = $bindable() }: { output: OutputSettings } = $props();
  async function pick() {
    const dir = await open({ directory: true, title: "Chọn folder Output" });
    if (typeof dir === "string") output.folder = dir;
  }
</script>

<div class="row">
  <label>Folder Output <button onclick={pick} title={output.folder ?? ""}>{output.folder ?? "Mặc định: thư mục Output trong folder ảnh"}</button></label>
  <label class="check"><input type="checkbox" bind:checked={output.overwrite} /> Ghi đè file trùng tên</label>
  {#if output.folder}<button onclick={() => (output.folder = null)}>Dùng mặc định</button>{/if}
</div>

<style>
  .row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  .check { flex-direction: row; align-items: center; color: var(--text); }
</style>
