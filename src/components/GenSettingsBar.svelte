<script lang="ts">
  import type { GenSettings } from "../lib/types";
  let { gen = $bindable() }: { gen: GenSettings } = $props();
</script>

<div class="gen">
  <label>Chế độ
    <select bind:value={gen.mode}>
      <option value="imageToVideo">Ảnh làm khung đầu</option>
      <option value="componentsToVideo">Ảnh tham chiếu</option>
    </select>
  </label>
  <label>Tỉ lệ <select bind:value={gen.aspectRatio}><option>16:9</option><option>9:16</option></select></label>
  <label>Chất lượng <select bind:value={gen.quality}><option>720p</option><option>1080p</option></select></label>
  <label>Luồng <input type="number" min="1" max="10" bind:value={gen.concurrency} /></label>
  <label title="Extension tự tạo/tải lại video lỗi trước khi báo lỗi">Tự thử lại <input type="number" min="0" max="5" bind:value={gen.maxRetries} /></label>
  <label class="check"><input type="checkbox" bind:checked={gen.autoPostProcess} /> Tự hậu kỳ luôn sau khi tạo</label>
</div>

<style>
  .gen { display: flex; gap: 12px; align-items: center; padding: 6px 12px; overflow-x: auto; white-space: nowrap; }
  .gen label { flex-direction: row; align-items: center; gap: 6px; }
  .gen input[type="number"] { width: 56px; }
  .check { color: var(--text); }
</style>
