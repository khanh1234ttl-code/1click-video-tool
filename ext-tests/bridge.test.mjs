// Runs the extension's service-worker bridge in Node against a mocked chrome.* API and a real
// WebSocket server playing the desktop tool.
import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";

const BRIDGE = path.resolve(import.meta.dirname, "../../Vids_Automation_1ClickStudio_v1.1.9.6/assets/oneclick-bridge.js");

async function within(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function mockChrome({ loginRedirect = false, reply, storedJobs } = {}) {
  const listeners = { runtime: [], downloads: [], alarms: [] };
  const sent = [];
  const tabs = loginRedirect ? [] : [{ id: 7, url: "https://docs.google.com/videos/d/abc/edit", status: "complete" }];
  const store = { oneclickJobs: storedJobs };
  const chrome = {
    runtime: { getManifest: () => ({ version: "1.1.10.0" }), onMessage: { addListener: (f) => listeners.runtime.push(f) } },
    tabs: {
      query: async () => tabs,
      get: async (id) => tabs.find((t) => t.id === id) ?? { id, url: "https://accounts.google.com/signin", status: "complete" },
      sendMessage: async (tabId, msg) => {
        sent.push({ tabId, msg: structuredClone(msg) });
        const override = await reply?.(msg, listeners);
        return override ?? (msg.type === "CHECK_VIDS_PAGE" ? { isVidsPage: true } : { success: true });
      },
    },
    windows: { create: async () => ({ tabs: [{ id: 99 }] }) },
    downloads: { onChanged: { addListener: (f) => listeners.downloads.push(f) }, search: async ({ id }) => [{ id, filename: chrome.__files[id] }] },
    alarms: { create: () => {}, onAlarm: { addListener: (f) => listeners.alarms.push(f) } },
    storage: { session: { get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) } },
    __files: {},
  };
  return { chrome, listeners, sent };
}

async function setup(t, opts) {
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  const timers = new Set();
  const clients = new Set();
  let stopped = false;
  t.after(async () => {
    stopped = true;
    for (const timer of timers) clearTimeout(timer);
    for (const client of clients) { client.onclose = null; client.close(); }
    for (const client of wss.clients) client.terminate();
    await new Promise((r) => wss.close(r));
  });
  await new Promise((r) => wss.on("listening", r));
  const { chrome, listeners, sent } = mockChrome(opts);
  const inbox = [];
  const conn = new Promise((resolve) => wss.on("connection", (ws) => { ws.on("message", (d) => inbox.push(JSON.parse(String(d)))); resolve(ws); }));
  const context = vm.createContext({
    chrome, console,
    __ONECLICK_TOOL_URL__: `ws://127.0.0.1:${wss.address().port}`,
    WebSocket: class extends WebSocket {
      constructor(url) { super(url); clients.add(this); }
    },
    setTimeout: (fn, ms) => {
      if (stopped) return;
      const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms);
      timers.add(timer);
      return timer;
    },
    clearTimeout: (timer) => { clearTimeout(timer); timers.delete(timer); },
  });
  vm.runInContext(await readFile(BRIDGE, "utf8"), context, { filename: BRIDGE });
  const ws = await within(conn, 2000, "bridge did not connect");
  const next = async (type, timeout = 2000) => {
    for (let i = 0; i < timeout / 20; i++) {
      const k = inbox.findIndex((m) => m.type === type);
      if (k >= 0) return inbox.splice(k, 1)[0];
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`no ${type}; inbox=${JSON.stringify(inbox)}`);
  };
  return { wss, ws, next, inbox, listeners, sent, chrome, context };
}

const submit = {
  type: "job.submit", jobId: "j1",
  settings: { mode: "imageToVideo", aspectRatio: "16:9", quality: "720p", concurrency: 2, maxRetries: 1 },
  items: [{ index: 1, prompt: "mèo", imageId: "j1-1" }, { index: 2, prompt: "chó", imageId: "j1-2" }],
};

test("full job flow", async (t) => {
  const { ws, next, inbox, listeners, sent, chrome } = await setup(t);
  assert.equal((await next("hello")).extVersion, "1.1.10.0");
  ws.send(JSON.stringify({ type: "ping" }));
  await next("pong");
  for (const i of [1, 2]) ws.send(JSON.stringify({ type: "image.put", id: `j1-${i}`, name: `a${i}.jpg`, base64: "data:image/jpeg;base64,AAA" }));
  ws.send(JSON.stringify(submit));
  assert.equal((await next("job.accepted")).jobId, "j1");

  const prep = sent.filter((s) => s.msg.type === "PREPARE_IMAGE");
  assert.deepEqual(prep.map((s) => s.msg.id), ["j1-1", "j1-2"]);
  assert.equal(prep[0].msg.data.name, "a1.jpg");
  const fill = sent.find((s) => s.msg.type === "AUTO_FILL_VIDS").msg;
  assert.equal(fill.groupId, "j1");
  assert.equal(fill.concurrentPrompts, 2);
  assert.deepEqual(fill.payloads[1], {
    prompt: "chó", mode: "imageToVideo", imageIds: ["j1-2"], aspectRatio: "16:9", outputCount: 1, promptIndex: 2,
    autoDownloadResourceQuality: "720p", isConcat: false, maxRetries: 1, autoChangeFileName: true, folderName: "1ClickBridge/j1",
  });

  listeners.runtime.forEach((f) => f({ type: "VIDEO_GENERATION_PROGRESS", data: { groupId: "j1", promptIndex: 2, percentage: 35 } }, {}, () => {}));
  assert.deepEqual(await next("item.progress"), { type: "item.progress", jobId: "j1", index: 2, percent: 35 });

  chrome.__files[5] = "E:\\AFF cám\\THÁNG 10\\1ClickBridge\\j1\\002_cho_a.mp4";
  listeners.downloads.forEach((f) => f({ id: 5, state: { current: "complete" } }));
  assert.deepEqual(await next("item.downloaded"), { type: "item.downloaded", jobId: "j1", index: 2, filePath: chrome.__files[5] });

  // final generation failure as the real content script reports it (downloadComplete stays false);
  // the successful item 2 also appears and must not be reported again
  const statusMsg = { type: "PROMPT_GROUP_STATUS", data: { id: "j1", status: "completed", results: [
    { promptIndex: 2, success: true, downloadComplete: true },
    { promptIndex: 1, success: false, downloadComplete: false, error: "Veo từ chối" },
  ] } };
  listeners.runtime.forEach((f) => f(statusMsg, {}, () => {}));
  listeners.runtime.forEach((f) => f(statusMsg, {}, () => {})); // duplicate broadcast
  assert.deepEqual(await next("item.failed"), { type: "item.failed", jobId: "j1", index: 1, error: "Veo từ chối" });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(inbox.filter((m) => m.type === "item.failed").length, 0);

  ws.send(JSON.stringify({ type: "job.query", jobId: "j1" }));
  const st = await next("job.status");
  assert.equal(st.known, true);
  assert.deepEqual(st.done, [{ index: 2, filePath: chrome.__files[5] }]);
  assert.deepEqual(st.failed, [{ index: 1, error: "Veo từ chối" }]);
  assert.deepEqual(st.pending, []);

  ws.send(JSON.stringify({ type: "job.cancel", jobId: "j1" }));
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(sent.some((s) => s.msg.type === "CANCEL_PROMPT_GROUP" && s.msg.groupId === "j1"));

  ws.send(JSON.stringify({ type: "job.query", jobId: "nope" }));
  assert.equal((await next("job.status")).known, false);
});

function putImages(ws) {
  for (const i of [1, 2]) ws.send(JSON.stringify({ type: "image.put", id: `j1-${i}`, name: `a${i}.jpg`, base64: "data:image/jpeg;base64,AAA" }));
}

test("duplicate submits do not enqueue a second generation or reset completed rows", async (t) => {
  const { ws, next, sent, listeners, chrome } = await setup(t);
  await next("hello");
  putImages(ws);
  ws.send(JSON.stringify(submit));
  ws.send(JSON.stringify(submit));
  await next("job.accepted");
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(sent.filter((s) => s.msg.type === "AUTO_FILL_VIDS").length, 1);
  chrome.__files[8] = "D:/1ClickBridge/j1/001_cat_a.mp4";
  await Promise.all(listeners.downloads.map((f) => f({ id: 8, state: { current: "complete" } })));
  await next("item.downloaded");
  putImages(ws);
  ws.send(JSON.stringify(submit));
  await next("job.accepted");
  ws.send(JSON.stringify({ type: "job.query", jobId: "j1" }));
  assert.deepEqual((await next("job.status")).done, [{ index: 1, filePath: chrome.__files[8] }]);
  assert.equal(sent.filter((s) => s.msg.type === "AUTO_FILL_VIDS").length, 1);
});

test("broadcasts before AUTO_FILL_VIDS acknowledgement retain progress and failures", async (t) => {
  const { ws, next } = await setup(t, { reply: (msg, listeners) => {
    if (msg.type === "AUTO_FILL_VIDS") {
      for (const f of listeners.runtime) {
        f({ type: "VIDEO_GENERATION_PROGRESS", data: { groupId: "j1", promptIndex: 2, percentage: 35 } });
        f({ type: "PROMPT_GROUP_STATUS", data: { id: "j1", status: "error", results: [] } });
      }
    }
  } });
  await next("hello");
  putImages(ws);
  ws.send(JSON.stringify(submit));
  await next("job.accepted");
  assert.equal((await next("item.progress")).index, 2);
  assert.equal((await next("item.failed")).index, 1);
  assert.equal((await next("item.failed")).index, 2);
  ws.send(JSON.stringify({ type: "job.query", jobId: "j1" }));
  assert.deepEqual((await next("job.status")).pending, []);
});

test("PREPARE_IMAGE rejection never starts a generation", async (t) => {
  const { ws, next, sent } = await setup(t, { reply: (msg) => msg.type === "PREPARE_IMAGE" ? { success: false, error: "Không nhận được ảnh" } : undefined });
  await next("hello");
  putImages(ws);
  ws.send(JSON.stringify(submit));
  assert.match((await next("job.rejected")).error, /Không nhận được ảnh/);
  assert.equal(sent.filter((s) => s.msg.type === "AUTO_FILL_VIDS").length, 0);
});

test("reconnects around five seconds after disconnect and keeps query state", async (t) => {
  const { ws, next, wss } = await setup(t, { storedJobs: { saved: { tabId: 7, items: { 1: { state: "done", filePath: "E:/thư mục/001.mp4" }, 2: { state: "pending" } } } } });
  await next("hello");
  const started = Date.now();
  const reconnect = new Promise((resolve) => wss.once("connection", (client) => {
    client.on("message", (d) => { if (JSON.parse(String(d)).type === "hello") resolve(client); });
  }));
  ws.close();
  const client = await within(reconnect, 7000, "no reconnect within 7 seconds");
  assert.ok(Date.now() - started >= 4500 && Date.now() - started < 7000);
  const status = new Promise((resolve) => client.on("message", (d) => { const m = JSON.parse(String(d)); if (m.type === "job.status") resolve(m); }));
  client.send(JSON.stringify({ type: "job.query", jobId: "saved" }));
  assert.deepEqual((await within(status, 2000, "no restored job status")).done, [{ index: 1, filePath: "E:/thư mục/001.mp4" }]);
});

test("interrupted downloads fail once and unknown downloads are ignored", async (t) => {
  const { ws, next, listeners, chrome, inbox } = await setup(t);
  await next("hello");
  putImages(ws);
  ws.send(JSON.stringify(submit));
  await next("job.accepted");
  chrome.__files[5] = "E:/1ClickBridge/j1/002_cho_a.mp4";
  for (let n = 0; n < 2; n++) await Promise.all(listeners.downloads.map((f) => f({ id: 5, state: { current: "interrupted" } })));
  assert.deepEqual(await next("item.failed"), { type: "item.failed", jobId: "j1", index: 2, error: "Tải video bị gián đoạn" });
  chrome.__files[7] = "D:/other/001.mp4";
  await Promise.all(listeners.downloads.map((f) => f({ id: 7, state: { current: "complete" } })));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(inbox.filter((m) => m.type === "item.failed" || m.type === "item.downloaded").length, 0);
});

test("not logged in → job.rejected", async (t) => {
  const { ws, next } = await setup(t, { loginRedirect: true });
  await next("hello");
  ws.send(JSON.stringify({ type: "image.put", id: "j1-1", name: "a.jpg", base64: "x" }));
  ws.send(JSON.stringify({ ...submit, items: [submit.items[0]] }));
  const r = await next("job.rejected");
  assert.match(r.error, /đăng nhập Google/);
});
