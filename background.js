import { loadSettings, saveSettings, withoutSecrets } from "./src/settings.js";
import { splitIntoSegments } from "./src/chunker.js";
import * as systemEngine from "./src/systemEngine.js";
import * as serverEngine from "./src/serverEngine.js";
import { SERVER_PRESETS, buildCatalog, parseVoiceId, resolveVoice, serverOf } from "./src/voices.js";

const MENU_ID = "kiwi-doc-doan-da-chon";
const PROBE_TIMEOUT = 2000;

const state = {
  status: "idle",
  engine: "system",
  index: 0,
  total: 0,
  message: "",
  text: ""
};

function broadcast() {
  chrome.runtime.sendMessage({ from: "background", type: "state", state }).catch(() => {});
}

function setState(patch) {
  Object.assign(state, patch);
  broadcast();
}

function onEngineEvent(event) {
  if (event.type === "start") {
    setState({ status: "speaking", index: event.index, total: event.total || state.total, message: "" });
  } else if (event.type === "end") {
    setState({ status: "idle", index: 0, message: "" });
  } else if (event.type === "stopped") {
    setState({ status: "idle", message: "" });
  } else if (event.type === "error") {
    setState({ status: "idle", message: event.message || "không đọc được" });
  }
}

async function probePreset(preset, settings) {
  try {
    const voices = await serverEngine.listVoices(serverOf(preset, settings), PROBE_TIMEOUT);
    return { presetId: preset.id, ready: true, voices };
  } catch (err) {
    return { presetId: preset.id, ready: false, message: err.message };
  }
}

// Giọng mặc định không bao giờ được ghi vào cài đặt: ngay sau khi Chrome khởi
// động, chrome.tts.getVoices có thể còn thiếu giọng của hệ điều hành, ghi lúc đó
// là chốt nhầm một giọng rồi giữ mãi. Chọn lại mỗi lần đọc, và bỏ qua giọng đã
// lưu nếu máy không còn giọng đó.
async function targetOf(settings) {
  const parsed = parseVoiceId(settings.voiceId);
  if (parsed && parsed.kind === "server") return resolveVoice(settings.voiceId, settings);

  const { groups, defaultId } = buildCatalog(await systemEngine.listVoices());
  const heThong = groups.find((group) => group.id === "system");
  const conTren = heThong.items.some((item) => item.id === settings.voiceId);
  return resolveVoice(conTren ? settings.voiceId : defaultId, settings);
}

async function speak(text) {
  const settings = await loadSettings();
  const target = await targetOf(settings);
  const segments = splitIntoSegments(text, settings.maxCharsPerSegment);

  if (!segments.length) {
    setState({ status: "idle", message: "Không có văn bản nào để đọc" });
    return { ok: false, message: state.message };
  }

  // Máy chủ chưa chạy thì báo ngay kèm lệnh chạy, thay vì để lỗi "Failed to
  // fetch" của từng đoạn dội về sau đó.
  if (target.engine === "server") {
    const probe = await probePreset(target.preset, settings);
    if (!probe.ready) {
      const message = `${target.preset.label} chưa chạy. Chạy lệnh: ${target.preset.run}`;
      setState({ status: "idle", message });
      return { ok: false, message };
    }
  }

  await stopEngines();
  setState({
    status: "preparing",
    engine: target.engine,
    index: 0,
    total: segments.length,
    message: "",
    text
  });

  try {
    if (target.engine === "server") {
      await serverEngine.speak(segments, { ...settings, server: target.server });
    } else {
      await systemEngine.speak(segments, { ...settings, voiceName: target.voiceName }, onEngineEvent);
    }
  } catch (err) {
    setState({ status: "idle", message: err.message });
    return { ok: false, message: err.message };
  }

  return { ok: true, total: segments.length };
}

function engineInUse() {
  return state.engine === "server" ? serverEngine : systemEngine;
}

async function pause() {
  await engineInUse().pause();
  setState({ status: "paused" });
}

async function resume() {
  await engineInUse().resume();
  setState({ status: "speaking" });
}

async function stopEngines() {
  await systemEngine.stop();
  await serverEngine.stop();
}

// Dừng để đọc tiếp thì dùng stopEngines: stop() hạ trạng thái về idle, gọi nó
// ngay trước khi bật "preparing" là bắn ra một nhịp idle thừa cho popup.
async function stop() {
  await stopEngines();
  setState({ status: "idle", index: 0, message: "" });
}

async function selectionOfActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return "";

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.getSelection().toString()
    });
    return (result && result.result) || "";
  } catch (err) {
    return "";
  }
}

// Service worker ngủ dậy với state trắng trong khi chrome.tts vẫn đang đọc dở.
// Hỏi lại chính bộ đọc trước khi trả lời, nếu không popup sẽ hiện "Đang chờ"
// giữa lúc loa vẫn kêu.
async function currentState() {
  if (state.engine === "system" && state.status === "idle") {
    const speaking = await new Promise((resolve) => chrome.tts.isSpeaking(resolve));
    if (speaking) return { ...state, status: "speaking" };
  }
  return { ...state };
}

async function voices() {
  const settings = await loadSettings();
  const system = await systemEngine.listVoices();
  const probes = await Promise.all(SERVER_PRESETS.map((preset) => probePreset(preset, settings)));
  return buildCatalog(system, probes);
}

const handlers = {
  speak: (message) => speak(message.text),
  speakSelection: async () => {
    const text = await selectionOfActiveTab();
    if (!text.trim()) {
      setState({ status: "idle", message: "Không có văn bản nào được chọn" });
      return { ok: false, message: state.message };
    }
    return speak(text);
  },
  pause: () => pause().then(() => ({ ok: true })),
  resume: () => resume().then(() => ({ ok: true })),
  stop: () => stop().then(() => ({ ok: true })),
  state: () => currentState(),
  voices: () => voices(),
  selection: () => selectionOfActiveTab().then((text) => ({ text })),
  settings: () => loadSettings().then(withoutSecrets),
  saveSettings: (message) => saveSettings(message.patch).then(withoutSecrets)
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target === "offscreen") return;

  if (message.from === "offscreen") {
    onEngineEvent(message);
    return;
  }

  const handler = handlers[message.type];
  if (!handler) return;

  Promise.resolve(handler(message))
    .then((result) => sendResponse(result ?? { ok: true }))
    .catch((err) => sendResponse({ ok: false, message: err.message }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Đọc đoạn đã chọn",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID && info.selectionText) speak(info.selectionText);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "doc-doan-da-chon") handlers.speakSelection();
  else if (command === "dung-doc") stop();
});
