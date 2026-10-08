// 1Click Video Tool bridge (service worker). Connects to the desktop tool over a localhost
// WebSocket and runs its jobs through the same AUTO_FILL_VIDS flow the side panel uses.
const TOOL_URL = globalThis.__ONECLICK_TOOL_URL__ || "ws://127.0.0.1:17890";
const VIDS_MATCH = "*://docs.google.com/videos/*";
const CREATE_URL = "https://docs.google.com/videos/create";
const FOLDER_ROOT = "1ClickBridge";
const FILE_RE = /[\\/]1ClickBridge[\\/]([^\\/]+)[\\/](\d{3})_/;

let ws = null;
let reconnectTimer = null;
const images = new Map(); // imageId -> { base64, name } until the job is submitted
const submitting = new Set();
let jobs = {}; // jobId -> { tabId, items: { [index]: { state, filePath?, error? } } }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg));
const saveJobs = () => chrome.storage.session.set({ oneclickJobs: jobs }).catch(() => {});

function retryConnect() {
  if (reconnectTimer !== null) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 5000);
}

function connect() {
  if (ws && ws.readyState <= 1) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  try {
    ws = new WebSocket(TOOL_URL);
  } catch {
    ws = null;
    retryConnect();
    return;
  }
  ws.onopen = () => send({ type: "hello", extVersion: chrome.runtime.getManifest().version });
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    handle(msg).catch((e) => console.warn("[1Click bridge]", e));
  };
  const socket = ws;
  ws.onclose = () => { if (ws === socket) { ws = null; retryConnect(); } };
  ws.onerror = () => {};
}

async function ensureVidsTab() {
  const tabs = await chrome.tabs.query({ url: VIDS_MATCH });
  let tab = tabs.find((t) => /\/videos\/d\//.test(t.url || "")) || tabs[0];
  if (!tab) {
    const win = await chrome.windows.create({ url: CREATE_URL, focused: false });
    tab = win.tabs[0];
  }
  for (let i = 0; i < 120; i++) {
    const t = await chrome.tabs.get(tab.id);
    if ((t.url || "").includes("accounts.google.com")) throw new Error("Cần đăng nhập Google trong Chrome rồi thử lại");
    if (t.status === "complete" && /docs\.google\.com\/videos\//.test(t.url || "")) {
      try {
        const r = await chrome.tabs.sendMessage(t.id, { type: "CHECK_VIDS_PAGE" });
        if (r && r.isVidsPage) return t.id;
      } catch {}
    }
    await sleep(500);
  }
  throw new Error("Không mở được Google Vids");
}

async function handle(msg) {
  switch (msg.type) {
    case "ping":
      return send({ type: "pong" });
    case "image.put":
      images.set(msg.id, { base64: msg.base64, name: msg.name });
      return;
    case "job.submit": {
      const { jobId, settings, items } = msg;
      if (submitting.has(jobId)) return;
      if (jobs[jobId]) {
        items.forEach((it) => images.delete(it.imageId));
        return send({ type: "job.accepted", jobId });
      }
      submitting.add(jobId);
      let tabId;
      try {
        tabId = await ensureVidsTab();
        for (const it of items) {
          const data = images.get(it.imageId);
          if (!data) throw new Error(`Thiếu ảnh ${it.imageId}`);
          const prepared = await chrome.tabs.sendMessage(tabId, { type: "PREPARE_IMAGE", id: it.imageId, data });
          if (!prepared || prepared.success === false) throw new Error((prepared && prepared.error) || "Extension không nhận ảnh");
        }
        const payloads = items.map((it) => ({
          prompt: it.prompt, mode: settings.mode, imageIds: [it.imageId], aspectRatio: settings.aspectRatio, outputCount: 1,
          promptIndex: it.index, autoDownloadResourceQuality: settings.quality, isConcat: false, maxRetries: settings.maxRetries,
          autoChangeFileName: true, folderName: `${FOLDER_ROOT}/${jobId}`,
        }));
        // The content script broadcasts queued/running status before acknowledging this call.
        jobs[jobId] = { tabId, items: Object.fromEntries(items.map((it) => [it.index, { state: "pending" }])) };
        saveJobs();
        const r = await chrome.tabs.sendMessage(tabId, { type: "AUTO_FILL_VIDS", payloads, groupId: jobId, concurrentPrompts: settings.concurrency });
        if (!r || r.success === false) throw new Error((r && r.error) || "Extension không nhận job");
      } catch (e) {
        delete jobs[jobId];
        saveJobs();
        items.forEach((it) => images.delete(it.imageId));
        return send({ type: "job.rejected", jobId, error: String((e && e.message) || e) });
      } finally {
        submitting.delete(jobId);
      }
      items.forEach((it) => images.delete(it.imageId));
      return send({ type: "job.accepted", jobId });
    }
    case "job.cancel": {
      const job = jobs[msg.jobId];
      if (job) await chrome.tabs.sendMessage(job.tabId, { type: "CANCEL_PROMPT_GROUP", groupId: msg.jobId }).catch(() => {});
      return;
    }
    case "job.query": {
      const job = jobs[msg.jobId];
      if (!job) return send({ type: "job.status", jobId: msg.jobId, known: false, done: [], failed: [], pending: [] });
      const entries = Object.entries(job.items).map(([i, v]) => [Number(i), v]);
      return send({
        type: "job.status", jobId: msg.jobId, known: true,
        done: entries.filter(([, v]) => v.state === "done").map(([index, v]) => ({ index, filePath: v.filePath })),
        failed: entries.filter(([, v]) => v.state === "failed").map(([index, v]) => ({ index, error: v.error })),
        pending: entries.filter(([, v]) => v.state === "pending").map(([index]) => index),
      });
    }
  }
}

function setItem(jobId, index, patch) {
  const item = jobs[jobId] && jobs[jobId].items[index];
  if (!item || item.state !== "pending") return false;
  Object.assign(item, patch);
  saveJobs();
  return true;
}

chrome.runtime.onMessage.addListener((m) => {
  if (!m || !m.data) return false;
  if (m.type === "VIDEO_GENERATION_PROGRESS") {
    const { groupId, promptIndex, percentage } = m.data;
    if (jobs[groupId]) send({ type: "item.progress", jobId: groupId, index: promptIndex, percent: Math.round(percentage || 0) });
  } else if (m.type === "PROMPT_GROUP_STATUS") {
    const jobId = m.data.id;
    // The content script records a final generation failure as success:false with
    // downloadComplete:false (no download will follow), so success:false alone means failed.
    for (const r of m.data.results || []) {
      const error = r.error || "Tạo video lỗi";
      if (!r.success && setItem(jobId, r.promptIndex, { state: "failed", error })) {
        send({ type: "item.failed", jobId, index: r.promptIndex, error });
      }
    }
    // A group-level error (e.g. config not loaded) leaves no per-item results.
    if (m.data.status === "error" && jobs[jobId]) {
      for (const index of Object.keys(jobs[jobId].items).map(Number)) {
        if (setItem(jobId, index, { state: "failed", error: "Extension báo lỗi khi chạy nhóm" })) {
          send({ type: "item.failed", jobId, index, error: "Extension báo lỗi khi chạy nhóm" });
        }
      }
    }
  }
  return false;
});

chrome.downloads.onChanged.addListener(async (delta) => {
  const state = delta.state && delta.state.current;
  if (state !== "complete" && state !== "interrupted") return;
  const [item] = await chrome.downloads.search({ id: delta.id });
  const match = item && item.filename && FILE_RE.exec(item.filename);
  if (!match) return;
  const [, jobId, nnn] = match;
  const index = Number(nnn);
  if (state === "complete" && setItem(jobId, index, { state: "done", filePath: item.filename })) {
    send({ type: "item.downloaded", jobId, index, filePath: item.filename });
  } else if (state === "interrupted" && setItem(jobId, index, { state: "failed", error: "Tải video bị gián đoạn" })) {
    send({ type: "item.failed", jobId, index, error: "Tải video bị gián đoạn" });
  }
});

// Retry every five seconds while awake; the alarm also wakes an idle service worker.
chrome.alarms.create("oneclick-bridge", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => a.name === "oneclick-bridge" && connect());

chrome.storage.session.get("oneclickJobs").then((r) => { jobs = (r && r.oneclickJobs) || {}; }).catch(() => {}).finally(connect);
