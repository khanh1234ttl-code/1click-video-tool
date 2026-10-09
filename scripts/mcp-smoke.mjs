// Drives `<app> --mcp` like an agent would: initialize, list tools, then the given tool calls.
// usage: node scripts/mcp-smoke.mjs <app exe> '<json array of [name, arguments]>'
import { spawn } from "node:child_process";
import readline from "node:readline";

const [exe, callsJson = "[]"] = process.argv.slice(2);
const calls = JSON.parse(callsJson);
const child = spawn(exe, ["--mcp"], { stdio: ["pipe", "pipe", "inherit"] });
const lines = readline.createInterface({ input: child.stdout });
const pending = new Map();
lines.on("line", (l) => {
  const msg = JSON.parse(l);
  pending.get(msg.id)?.(msg);
  pending.delete(msg.id);
});
let id = 0;
const rpc = (method, params) => new Promise((resolve) => {
  const my = ++id;
  pending.set(my, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: my, method, params }) + "\n");
});

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-smoke", version: "1" } });
console.log("initialize:", init.result.serverInfo.name, init.result.protocolVersion);
child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
const list = await rpc("tools/list", {});
console.log("tools:", list.result.tools.map((t) => t.name).join(", "));
for (const [name, args] of calls) {
  const r = await rpc("tools/call", { name, arguments: args ?? {} });
  console.log(`\n== ${name} ${r.result.isError ? "(LỖI)" : ""}\n${r.result.content[0].text.slice(0, 1500)}`);
}
child.stdin.end();
