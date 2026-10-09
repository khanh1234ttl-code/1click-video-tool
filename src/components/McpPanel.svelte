<script lang="ts">
  import { onMount } from "svelte";
  import { api, type McpInfo } from "../lib/api";

  let { onclose, toast }: { onclose: () => void; toast: (t: string) => void } = $props();
  let info: McpInfo | null = $state(null);
  onMount(() => { api.mcpInfo().then((i) => (info = i)).catch((e) => toast(String(e))); });
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast("Đã copy"); } catch { toast("Không copy được, hãy chọn và copy tay"); }
  }
</script>

<div class="mcp" role="dialog" aria-label="Kết nối agent (MCP)">
  <div class="head"><b>Kết nối agent (MCP)</b><span class="grow"></span><button onclick={onclose}>Đóng</button></div>
  <p class="hint">Agent (Claude Code, Claude Desktop, Codex…) điều khiển được tool này khi tool đang mở: mở folder, thêm prompt và ảnh, tạo video, xuất video. Tạo video tốn lượt Veo; agent được dặn hỏi bạn trước.</p>
  {#if info}
    {#each [["Claude Code (chạy trong Terminal)", info.claudeCode], ["Claude Desktop (thêm vào claude_desktop_config.json)", info.claudeDesktop], ["Codex (thêm vào ~/.codex/config.toml)", info.codex]] as [label, text]}
      <div class="block">
        <div class="row"><span>{label}</span><span class="grow"></span><button onclick={() => copy(text)}>Copy</button></div>
        <pre>{text}</pre>
      </div>
    {/each}
  {:else}
    <p class="hint">Đang lấy đường dẫn…</p>
  {/if}
</div>

<style>
  .mcp { position: absolute; right: 12px; top: 44px; z-index: 11; width: min(640px, calc(100vw - 24px)); max-height: 80vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.15); }
  .head, .row { display: flex; align-items: center; gap: 8px; }
  .grow { flex: 1; }
  .hint { margin: 0; color: var(--muted); font-size: 12px; }
  .block span { font-size: 12px; color: var(--muted); }
  pre { margin: 4px 0 0; padding: 8px; background: var(--bg); border: 1px solid var(--line); border-radius: 6px; white-space: pre-wrap; word-break: break-all; font-size: 12px; user-select: text; }
</style>
