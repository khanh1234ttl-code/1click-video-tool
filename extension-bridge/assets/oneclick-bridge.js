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
const submitting = new Map();
let jobs = {}; // jobId -> { tabId, items: { [index]: { state, filePath?, error? } } }
const jobsReady = chrome.storage.session.get("oneclickJobs")
  .then((r) => { jobs = (r && r.oneclickJobs) || {}; }).catch(() => {});

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

// The Vids tab runs in a window of its own, so the desktop tool can hide that window without
// touching the user's other Chrome windows. The tool finds it by these bounds (DIP).
let trackedWindow = null;
const windowReady = chrome.storage.session.get("oneclickWindow")
  .then((r) => { trackedWindow = (r && r.oneclickWindow) || null; }).catch(() => {});

async function reportWindow(windowId) {
  const w = await chrome.windows.get(windowId);
  trackedWindow = w.id;
  chrome.storage.session.set({ oneclickWindow: w.id }).catch(() => {});
  send({ type: "window.info", windowId: w.id, left: w.left, top: w.top, width: w.width, height: w.height });
}

async function ensureOwnWindow(tab) {
  const siblings = await chrome.tabs.query({ windowId: tab.windowId });
  if (siblings.length <= 1) return tab.windowId;
  const win = await chrome.windows.create({ tabId: tab.id, focused: false });
  return win.id;
}

async function findVidsTab() {
  const tabs = await chrome.tabs.query({ url: VIDS_MATCH });
  return tabs.find((t) => /\/videos\/d\//.test(t.url || "")) || tabs[0];
}

async function ensureVidsTab() {
  let tab = await findVidsTab();
  if (!tab) {
    const win = await chrome.windows.create({ url: CREATE_URL, focused: false });
    tab = win.tabs[0];
    tab.windowId = tab.windowId ?? win.id;
  }
  await reportWindow(await ensureOwnWindow(tab)).catch(() => {});
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
  await jobsReady;
  switch (msg.type) {
    case "ping":
      return send({ type: "pong" });
    case "window.state": {
      // Where the tool cannot hide the window itself (macOS) it minimizes or restores it here.
      if (!["minimized", "normal"].includes(msg.state)) return;
      await windowReady;
      if (trackedWindow !== null) await chrome.windows.update(trackedWindow, { state: msg.state }).catch(() => {});
      return;
    }
    case "window.query": {
      const tab = await findVidsTab();
      if (tab) await reportWindow(tab.windowId);
      return;
    }
    case "image.put":
      images.set(msg.id, { base64: msg.base64, name: msg.name });
      return;
    case "job.submit": {
      const { jobId, settings, items } = msg;
      if (submitting.has(jobId)) return;
      // A prompt may use several images, and several prompts may share one (sent once).
      const idsOf = (it) => (Array.isArray(it.imageIds) && it.imageIds.length ? it.imageIds : [it.imageId]);
      const allIds = [...new Set(items.flatMap(idsOf))];
      const forget = () => allIds.forEach((id) => images.delete(id));
      if (jobs[jobId]) {
        forget();
        return send({ type: "job.accepted", jobId });
      }
      const submission = { cancelled: false };
      submitting.set(jobId, submission);
      const checkCancelled = () => { if (submission.cancelled) throw new Error("Đã hủy job"); };
      let tabId;
      try {
        tabId = await ensureVidsTab();
        checkCancelled();
        for (const id of allIds) {
          const data = images.get(id);
          if (!data) throw new Error(`Thiếu ảnh ${id}`);
          const prepared = await chrome.tabs.sendMessage(tabId, { type: "PREPARE_IMAGE", id, data });
          checkCancelled();
          if (!prepared || prepared.success === false) throw new Error((prepared && prepared.error) || "Extension không nhận ảnh");
        }
        const payloads = items.map((it) => ({
          prompt: it.prompt, mode: settings.mode, imageIds: idsOf(it), aspectRatio: settings.aspectRatio, outputCount: 1,
          promptIndex: it.index, autoDownloadResourceQuality: settings.quality, isConcat: false, maxRetries: settings.maxRetries,
          autoChangeFileName: true, folderName: `${FOLDER_ROOT}/${jobId}`,
        }));
        // The content script broadcasts queued/running status before acknowledging this call.
        jobs[jobId] = { tabId, items: Object.fromEntries(items.map((it) => [it.index, { state: "pending" }])) };
        saveJobs();
        const r = await chrome.tabs.sendMessage(tabId, { type: "AUTO_FILL_VIDS", payloads, groupId: jobId, concurrentPrompts: settings.concurrency });
        checkCancelled();
        if (!r || r.success === false) throw new Error((r && r.error) || "Extension không nhận job");
      } catch (e) {
        delete jobs[jobId];
        saveJobs();
        forget();
        return send({ type: "job.rejected", jobId, error: String((e && e.message) || e) });
      } finally {
        submitting.delete(jobId);
      }
      forget();
      return send({ type: "job.accepted", jobId });
    }
    case "job.cancel": {
      const submission = submitting.get(msg.jobId);
      if (submission) submission.cancelled = true;
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

function handleRuntimeMessage(m) {
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
}

chrome.runtime.onMessage.addListener((m) => {
  jobsReady.then(() => handleRuntimeMessage(m));
  return false;
});

chrome.downloads.onChanged.addListener(async (delta) => {
  const state = delta.state && delta.state.current;
  if (state !== "complete" && state !== "interrupted") return;
  await jobsReady;
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

chrome.windows.onBoundsChanged.addListener((w) => {
  windowReady.then(() => { if (w && w.id === trackedWindow) reportWindow(w.id).catch(() => {}); });
});

// Retry every five seconds while awake; the alarm also wakes an idle service worker.
chrome.alarms.create("oneclick-bridge", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => a.name === "oneclick-bridge" && connect());

jobsReady.finally(connect);
