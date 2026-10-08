// usage: node cdp.mjs eval "<js expression>" | node cdp.mjs shot out.png
import WebSocket from "ws";
import fs from "node:fs";
const [cmd, arg] = process.argv.slice(2);
const targets = await (await fetch("http://127.0.0.1:9333/json")).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.on("open", r));
let id = 0;
const call = (method, params = {}) => new Promise((res) => {
  const my = ++id;
  ws.on("message", function h(d) { const m = JSON.parse(d); if (m.id === my) { ws.off("message", h); res(m); } });
  ws.send(JSON.stringify({ id: my, method, params }));
});
if (cmd === "eval") {
  const r = await call("Runtime.evaluate", { expression: arg, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result.result?.value ?? r.result.exceptionDetails ?? r.result, null, 1).slice(0, 4000));
} else if (cmd === "shot") {
  const r = await call("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(arg, Buffer.from(r.result.data, "base64"));
  console.log("saved", arg);
}
ws.close();
