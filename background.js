import { loadSettings, saveSettings, withoutSecrets } from "./src/kt_settings.js";
import { splitIntoSegments } from "./src/kt_chunk.js";
import * as systemEngine from "./src/kt_system.js";
import * as serverEngine from "./src/kt_server.js";
import {
  SERVER_PRESETS,
  autoRate,
  buildCatalog,
  groupOfVoice,
  isVietnameseText,
  parseVoiceId,
  pickVoiceForLanguage,
  resolveVoice,
  serverOf
} from "./src/kt_voices.js";
import { translateText, buildWebTranslateUrl } from "./src/kt_translate.js";

const MENU_ID = "kt-speak-selection";
const PROBE_TIMEOUT = 2000;
const FRAME_ID = "kt-expand-frame";
const DRAFT_KEY = "draft";
const SPEECH_PREFIX = "   ";

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
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { from: "background", type: "state", state }).catch(() => {});
    }
  }).catch(() => {});
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
async function voiceIdFor(text, chosenId) {
  const parsed = parseVoiceId(chosenId);
  if (parsed && parsed.kind === "server") return chosenId;

  if (parsed && parsed.kind === "system") {
    const stillHere = groupOfVoice(buildCatalog(await systemEngine.listVoices()), chosenId);
    if (stillHere) return chosenId;
  }

  return pickVoiceForLanguage(await voices(), isVietnameseText(text));
}

async function speak(text, options = {}) {
  const settings = await loadSettings();
  const chosenId = options.voiceId || settings.voiceId;
  const voiceId = await voiceIdFor(text, chosenId);
  const target = resolveVoice(voiceId, settings);
  const segments = splitIntoSegments(text, settings.maxCharsPerSegment);

  if (!segments.length) {
    setState({ status: "idle", message: "Không có văn bản nào để đọc" });
    return { ok: false, message: state.message };
  }

  // Thêm khoảng trắng đầu để bộ đọc không nuốt âm đầu khi bắt đầu phát.
  segments[0] = SPEECH_PREFIX + segments[0];

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

  const rate = options.rate ?? (voiceId === chosenId ? settings.rate : autoRate(settings.rate, voiceId));

  try {
    if (target.engine === "server") {
      await serverEngine.speak(segments, { ...settings, rate, server: target.server });
    } else {
      await systemEngine.speak(segments, { ...settings, rate, voiceName: target.voiceName }, onEngineEvent);
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

// Dừng để đọc tiếp thì dùng stopEngines, vì stop() bắn thêm một nhịp idle.
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

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab && tab.id ? tab.id : null;
}

async function openFrame() {
  const tabId = await activeTabId();
  if (tabId === null) return { ok: false, message: "Không thấy tab nào đang mở" };

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id, url) => {
        if (document.getElementById(id)) return;
        const frame = document.createElement("iframe");
        frame.id = id;
        frame.src = url;
        frame.style.cssText =
          "position:fixed;inset:0;width:100vw;height:100vh;border:0;margin:0;padding:0;z-index:2147483647;background:transparent;color-scheme:normal";
        document.documentElement.append(frame);
      },
      args: [FRAME_ID, chrome.runtime.getURL("popup/expand.html")]
    });
  } catch (err) {
    return { ok: false, message: err.message };
  }

  return { ok: true };
}

async function closeFrame() {
  const tabId = await activeTabId();
  if (tabId === null) return { ok: false, message: "Không thấy tab nào đang mở" };

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id) => {
        const frame = document.getElementById(id);
        if (frame) frame.remove();
      },
      args: [FRAME_ID]
    });
  } catch (err) {
    return { ok: false, message: err.message };
  }

  return { ok: true };
}

async function takeDraft() {
  const stored = await chrome.storage.session.get(DRAFT_KEY);
  await chrome.storage.session.remove(DRAFT_KEY);
  return { text: stored[DRAFT_KEY] || "" };
}

const handlers = {
  speak: (message) => speak(message.text, { voiceId: message.voiceId, rate: message.rate }),
  openFrame: () => openFrame(),
  closeFrame: () => closeFrame(),
  shrinkFrame: async () => {
    const closed = await closeFrame();
    if (!closed.ok) return closed;

    try {
      await chrome.action.openPopup();
    } catch (err) {
      return { ok: false, message: err.message };
    }
    return { ok: true };
  },
  saveDraft: (message) => chrome.storage.session.set({ [DRAFT_KEY]: message.text }).then(() => ({ ok: true })),
  takeDraft: () => takeDraft(),
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
  saveSettings: (message) => saveSettings(message.patch).then(withoutSecrets),
  translate: (message) => translateText({ text: message.text, sl: message.sl, tl: message.tl }),
  translateSelection: async (message) => {
    const settings = await loadSettings();
    const sl = message.sl || settings.sourceLang || "auto";
    const tl = message.tl || settings.targetLang || "vi";
    return translateText({ text: message.text, sl, tl });
  },
  openWebTranslate: (message) => {
    const url = buildWebTranslateUrl({ text: message.text, sl: message.sl, tl: message.tl });
    return chrome.tabs.create({ url }).then(() => ({ ok: true }));
  }
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
  if (command === "speak-selection") handlers.speakSelection();
  else if (command === "stop-speaking") stop();
});
