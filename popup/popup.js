import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from "../src/kt_translate.js";

const el = {
  text: document.getElementById("text"),
  textField: document.getElementById("text-field"),
  expand: document.getElementById("expand"),
  overlay: document.getElementById("overlay"),
  textSlot: document.getElementById("text-slot"),
  shrink: document.getElementById("shrink"),
  closeExpand: document.getElementById("close-expand"),
  voice: document.getElementById("voice"),
  hint: document.getElementById("hint"),
  rate: document.getElementById("rate"),
  rateValue: document.getElementById("rate-value"),
  play: document.getElementById("play"),
  pause: document.getElementById("pause"),
  resume: document.getElementById("resume"),
  stop: document.getElementById("stop"),
  status: document.getElementById("status"),
  theme: document.getElementById("theme"),
  serverNote: document.getElementById("server-note"),
  copyRun: document.getElementById("copy-run"),
  tabTts: document.getElementById("tab-tts"),
  tabTranslate: document.getElementById("tab-translate"),
  panelTts: document.getElementById("panel-tts"),
  panelTranslate: document.getElementById("panel-translate"),
  sourceLang: document.getElementById("source-lang"),
  targetLang: document.getElementById("target-lang"),
  swapLang: document.getElementById("swap-lang"),
  doTranslate: document.getElementById("do-translate"),
  translatedText: document.getElementById("translated-text"),
  copyTranslation: document.getElementById("copy-translation"),
  speakTranslation: document.getElementById("speak-translation"),
  openWebTranslate: document.getElementById("open-web-translate")
};

const send = (message) => chrome.runtime.sendMessage(message);

let catalog = { groups: [], defaultId: "" };
let state = { status: "idle", index: 0, total: 0, message: "" };
let ready = false;

function showStatus(text, kind = "") {
  el.status.textContent = text;
  el.status.dataset.kind = kind;
}

function render() {
  const { status, message } = state;

  if (message) showStatus(message, "error");
  else if (status === "preparing") showStatus("");
  else if (status === "speaking") showStatus("Đang đọc");
  else if (status === "paused") showStatus("Đã tạm dừng");
  else if (ready) showStatus("Sẵn sàng", "ready");
  else showStatus("Đang chờ");

  const waiting = status === "preparing";
  el.play.dataset.waiting = waiting ? "1" : "0";
  el.play.disabled = waiting || status === "speaking";
  el.pause.disabled = status !== "speaking";
  el.resume.disabled = status !== "paused";
  el.stop.disabled = status === "idle";
}

function showState(next) {
  state = next;
  render();
}

function groupOf(voiceId) {
  return catalog.groups.find((group) => group.items.some((item) => item.id === voiceId)) || null;
}

function showHint(voiceId) {
  const group = groupOf(voiceId);
  const missing = group && !group.ready;

  el.hint.textContent = missing ? group.hint : "";
  el.serverNote.hidden = !(missing && group.run);

  ready = !!voiceId && !!group && group.ready;
  render();
}

function fillVoices(chosen) {
  el.voice.innerHTML = "";

  for (const group of catalog.groups) {
    if (!group.items.length) continue;

    const optGroup = document.createElement("optgroup");
    optGroup.label = group.ready ? group.label : `${group.label} (chưa chạy)`;

    for (const item of group.items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.lang ? `${item.label} (${item.lang})` : item.label;
      optGroup.append(option);
    }

    el.voice.append(optGroup);
  }

  el.voice.value = chosen;
}

async function loadVoices(voiceId) {
  let result;
  try {
    result = await send({ type: "voices" });
  } catch (err) {
    showState({ ...state, message: "Không đọc được danh sách giọng: " + err.message });
    return;
  }

  if (!result || !Array.isArray(result.groups)) {
    showState({ ...state, message: result?.message || "Không đọc được danh sách giọng" });
    return;
  }

  catalog = result;

  // Giọng đã lưu có thể không còn trên máy này, nhưng đừng ghi đè cài đặt của người dùng.
  const kept = catalog.groups.some((group) => group.items.some((item) => item.id === voiceId));
  const chosen = kept ? voiceId : catalog.defaultId;

  fillVoices(chosen);
  showHint(chosen);

  if (!chosen) showState({ ...state, message: "Máy này chưa có giọng nào trong danh sách" });
}

function showTheme() {
  const theme = window.ktTheme.current();
  const label = theme === "dark" ? "Chuyển sang nền sáng" : "Chuyển sang nền tối";

  el.theme.dataset.theme = theme;
  el.theme.title = label;
  el.theme.setAttribute("aria-label", label);
}

function showRate(value) {
  el.rateValue.textContent = Number(value).toFixed(1).replace(".", ",");
}

function expandText(on) {
  el.overlay.hidden = !on;
  document.body.classList.toggle("expanded", on);

  if (on) el.textSlot.append(el.text);
  else el.textField.append(el.text);

  el.text.focus();
}

async function start() {
  showTheme();

  const settings = await send({ type: "settings" });
  el.rate.value = settings.rate;
  showRate(settings.rate);

  showState(await send({ type: "state" }));

  const { text: draft } = await send({ type: "takeDraft" });
  if (draft) {
    el.text.value = draft;
  } else {
    const { text } = await send({ type: "selection" });
    if (text.trim()) el.text.value = text.trim();
  }

  await loadVoices(settings.voiceId);
  fillLanguages(settings.sourceLang, settings.targetLang);
}

function fillLanguages(source = "auto", target = "vi") {
  el.sourceLang.innerHTML = "";
  for (const item of SOURCE_LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = item.code;
    opt.textContent = item.label;
    el.sourceLang.append(opt);
  }
  el.sourceLang.value = SOURCE_LANGUAGES.some((l) => l.code === source) ? source : "auto";

  el.targetLang.innerHTML = "";
  for (const item of TARGET_LANGUAGES) {
    const opt = document.createElement("option");
    opt.value = item.code;
    opt.textContent = item.label;
    el.targetLang.append(opt);
  }
  el.targetLang.value = TARGET_LANGUAGES.some((l) => l.code === target) ? target : "vi";
}

function switchTab(name) {
  const isTts = name === "tts";
  el.tabTts.classList.toggle("active", isTts);
  el.tabTts.setAttribute("aria-selected", String(isTts));
  el.tabTranslate.classList.toggle("active", !isTts);
  el.tabTranslate.setAttribute("aria-selected", String(!isTts));
  el.panelTts.hidden = !isTts;
  el.panelTranslate.hidden = isTts;
}

el.tabTts.addEventListener("click", () => switchTab("tts"));
el.tabTranslate.addEventListener("click", () => switchTab("translate"));

el.sourceLang.addEventListener("change", () => {
  send({ type: "saveSettings", patch: { sourceLang: el.sourceLang.value } });
});

el.targetLang.addEventListener("change", () => {
  send({ type: "saveSettings", patch: { targetLang: el.targetLang.value } });
});

el.swapLang.addEventListener("click", () => {
  const currentSource = el.sourceLang.value;
  const currentTarget = el.targetLang.value;

  if (currentSource === "auto") {
    el.sourceLang.value = currentTarget;
    el.targetLang.value = currentTarget === "vi" ? "en" : "vi";
  } else {
    el.sourceLang.value = currentTarget;
    el.targetLang.value = currentSource;
  }

  send({
    type: "saveSettings",
    patch: { sourceLang: el.sourceLang.value, targetLang: el.targetLang.value }
  });
});

el.doTranslate.addEventListener("click", async () => {
  const text = el.text.value.trim();
  if (!text) {
    showStatus("Vui lòng nhập nội dung.", "error");
    return;
  }

  el.doTranslate.disabled = true;
  showStatus("Đang dịch...");

  try {
    const result = await send({
      type: "translate",
      text,
      sl: el.sourceLang.value,
      tl: el.targetLang.value
    });

    if (result && result.ok) {
      el.translatedText.value = result.translation;
      showStatus("Đã dịch xong", "ready");
    } else {
      showStatus(result?.message || "Không dịch được", "error");
    }
  } catch (err) {
    showStatus("Lỗi dịch: " + err.message, "error");
  } finally {
    el.doTranslate.disabled = false;
  }
});

el.copyTranslation.addEventListener("click", async () => {
  const text = el.translatedText.value.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    el.copyTranslation.textContent = "Đã sao chép";
    setTimeout(() => {
      el.copyTranslation.textContent = "Sao chép";
    }, 2000);
  } catch (err) {
    showStatus("Không sao chép được: " + err.message, "error");
  }
});

el.speakTranslation.addEventListener("click", async () => {
  const text = el.translatedText.value.trim();
  if (!text) return;

  showState({ ...state, status: "preparing", message: "" });
  const result = await send({ type: "speak", text });
  if (result && result.ok === false) {
    showState({ ...state, status: "idle", message: result.message });
  }
});

el.openWebTranslate.addEventListener("click", () => {
  const text = el.text.value.trim();
  send({
    type: "openWebTranslate",
    text,
    sl: el.sourceLang.value,
    tl: el.targetLang.value
  });
});

el.play.addEventListener("click", async () => {
  const text = el.text.value.trim();
  if (!text) {
    showState({ ...state, message: "Vui lòng nhập nội dung." });
    return;
  }

  // Thăm dò máy chủ mất tới 2 giây, nên bật con quay ngay chứ không chờ báo về.
  showState({ ...state, status: "preparing", message: "" });

  const result = await send({ type: "speak", text });
  if (result && result.ok === false) showState({ ...state, status: "idle", message: result.message });
});

el.pause.addEventListener("click", () => send({ type: "pause" }));
el.resume.addEventListener("click", () => send({ type: "resume" }));
el.stop.addEventListener("click", () => send({ type: "stop" }));

el.theme.addEventListener("click", () => {
  window.ktTheme.toggle();
  showTheme();
});

// Trang chrome:// và vài trang bị Chrome cấm chèn mã, ở đó rơi về ô mở rộng nằm trong popup.
el.expand.addEventListener("click", async () => {
  await send({ type: "saveDraft", text: el.text.value });
  const result = await send({ type: "openFrame" });

  if (result && result.ok === false) {
    await send({ type: "takeDraft" });
    expandText(true);
    return;
  }

  window.close();
});
el.shrink.addEventListener("click", () => expandText(false));
el.closeExpand.addEventListener("click", () => expandText(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.overlay.hidden) {
    event.preventDefault();
    expandText(false);
  }
});

el.rate.addEventListener("input", () => showRate(el.rate.value));
el.rate.addEventListener("change", () => send({ type: "saveSettings", patch: { rate: Number(el.rate.value) } }));

el.voice.addEventListener("change", async () => {
  showHint(el.voice.value);
  await send({ type: "saveSettings", patch: { voiceId: el.voice.value } });
});

el.copyRun.addEventListener("click", async () => {
  const commands = catalog.groups
    .filter((group) => group.run && !group.ready)
    .map((group) => group.run)
    .join("\n");
  try {
    await navigator.clipboard.writeText(commands);
    el.copyRun.textContent = "Đã sao chép";
    setTimeout(() => {
      el.copyRun.textContent = "Sao chép lệnh khởi động";
    }, 2000);
  } catch (err) {
    showState({ ...state, message: "Không sao chép được: " + err.message });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.from === "background" && message.type === "state") showState(message.state);
});

start();
