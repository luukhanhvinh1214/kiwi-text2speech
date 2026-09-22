const el = {
  engine: document.querySelectorAll('input[name="engine"]'),
  lang: document.getElementById("lang"),
  pitch: document.getElementById("pitch"),
  pitchValue: document.getElementById("pitch-value"),
  baseUrl: document.getElementById("base-url"),
  model: document.getElementById("model"),
  serverVoice: document.getElementById("server-voice"),
  sampleRate: document.getElementById("sample-rate"),
  apiKey: document.getElementById("api-key"),
  apiKeyNote: document.getElementById("api-key-note"),
  volume: document.getElementById("volume"),
  volumeValue: document.getElementById("volume-value"),
  maxChars: document.getElementById("max-chars"),
  thuKetNoi: document.getElementById("thu-ket-noi"),
  luu: document.getElementById("luu"),
  status: document.getElementById("status")
};

const send = (message) => chrome.runtime.sendMessage(message);

function showStatus(text, loi = false) {
  el.status.textContent = text;
  el.status.dataset.loi = loi ? "1" : "0";
}

const soThapPhan = (value) => Number(value).toFixed(1).replace(".", ",");

function show(settings) {
  for (const radio of el.engine) radio.checked = radio.value === settings.engine;

  el.lang.value = settings.lang;
  el.pitch.value = settings.pitch;
  el.pitchValue.textContent = soThapPhan(settings.pitch);
  el.volume.value = settings.volume;
  el.volumeValue.textContent = soThapPhan(settings.volume);
  el.maxChars.value = settings.maxCharsPerSegment;

  el.baseUrl.value = settings.server.baseUrl;
  el.model.value = settings.server.model;
  el.serverVoice.value = settings.server.voice;
  el.sampleRate.value = String(settings.server.sampleRate);

  // Khoá đã lưu không bao giờ được gửi ngược ra trang này. Ô trống nghĩa là
  // giữ nguyên khoá cũ, chứ không phải chưa có khoá.
  el.apiKey.value = "";
  el.apiKey.placeholder = settings.server.apiKeyDaDat ? "Đã lưu một khoá, để trống nếu giữ nguyên" : "";
}

function collect() {
  const engine = [...el.engine].find((radio) => radio.checked);
  const patch = {
    engine: engine ? engine.value : "system",
    lang: el.lang.value.trim(),
    pitch: Number(el.pitch.value),
    volume: Number(el.volume.value),
    maxCharsPerSegment: Number(el.maxChars.value),
    server: {
      baseUrl: el.baseUrl.value.trim(),
      model: el.model.value.trim(),
      voice: el.serverVoice.value.trim(),
      sampleRate: Number(el.sampleRate.value)
    }
  };

  if (el.apiKey.value) patch.server.apiKey = el.apiKey.value;
  return patch;
}

el.pitch.addEventListener("input", () => (el.pitchValue.textContent = soThapPhan(el.pitch.value)));
el.volume.addEventListener("input", () => (el.volumeValue.textContent = soThapPhan(el.volume.value)));

el.luu.addEventListener("click", async () => {
  const settings = await send({ type: "saveSettings", patch: collect() });
  show(settings);
  showStatus("Đã lưu");
});

el.thuKetNoi.addEventListener("click", async () => {
  showStatus("Đang thử kết nối");
  await send({ type: "saveSettings", patch: collect() });
  const result = await send({ type: "checkServer" });

  if (result && result.ok === false) {
    showStatus("Không kết nối được: " + result.message, true);
    return;
  }

  const ten = result?.data?.[0]?.id || result?.id || "không rõ tên mô hình";
  showStatus("Kết nối được. Máy chủ báo mô hình " + ten);
});

send({ type: "settings" }).then(show);
