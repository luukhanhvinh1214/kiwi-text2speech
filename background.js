import { loadSettings, saveSettings, withoutSecrets } from "./src/settings.js";
import { splitIntoSegments } from "./src/chunker.js";
import * as systemEngine from "./src/systemEngine.js";
import * as serverEngine from "./src/serverEngine.js";

const MENU_ID = "kiwi-doc-doan-da-chon";

const state = {
  status: "idle",
  engine: "system",
  index: 0,
  total: 0,
  message: "",
  text: ""
};

function engineOf(settings) {
  return settings.engine === "server" ? serverEngine : systemEngine;
}

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

async function speak(text) {
  const settings = await loadSettings();
  const segments = splitIntoSegments(text, settings.maxCharsPerSegment);

  if (!segments.length) {
    setState({ status: "idle", message: "Không có văn bản nào để đọc" });
    return { ok: false, message: state.message };
  }

  await stop();
  setState({
    status: "speaking",
    engine: settings.engine,
    index: 0,
    total: segments.length,
    message: "",
    text
  });

  try {
    await engineOf(settings).speak(segments, settings, onEngineEvent);
  } catch (err) {
    setState({ status: "idle", message: err.message });
    return { ok: false, message: err.message };
  }

  return { ok: true, total: segments.length };
}

async function pause() {
  const settings = await loadSettings();
  await engineOf(settings).pause();
  setState({ status: "paused" });
}

async function resume() {
  const settings = await loadSettings();
  await engineOf(settings).resume();
  setState({ status: "speaking" });
}

async function stop() {
  const settings = await loadSettings();
  await systemEngine.stop();
  if (settings.engine === "server") await serverEngine.stop();
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
  const settings = await loadSettings();
  if (settings.engine === "system" && state.status === "idle") {
    const speaking = await new Promise((resolve) => chrome.tts.isSpeaking(resolve));
    if (speaking) return { ...state, status: "speaking", engine: settings.engine };
  }
  return { ...state, engine: settings.engine };
}

async function voices() {
  const settings = await loadSettings();
  if (settings.engine === "server") return serverEngine.listVoices(settings);
  return systemEngine.listVoices();
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
  saveSettings: (message) => saveSettings(message.patch).then(withoutSecrets),
  checkServer: async () => {
    const settings = await loadSettings();
    return serverEngine.check(settings);
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
  if (command === "doc-doan-da-chon") handlers.speakSelection();
  else if (command === "dung-doc") stop();
});
