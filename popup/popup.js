const el = {
  text: document.getElementById("text"),
  voice: document.getElementById("voice"),
  rate: document.getElementById("rate"),
  rateValue: document.getElementById("rate-value"),
  doc: document.getElementById("doc"),
  tamDung: document.getElementById("tam-dung"),
  tiepTuc: document.getElementById("tiep-tuc"),
  dung: document.getElementById("dung"),
  status: document.getElementById("status"),
  layDoan: document.getElementById("lay-doan-da-chon"),
  moCaiDat: document.getElementById("mo-cai-dat")
};

const send = (message) => chrome.runtime.sendMessage(message);

function showStatus(text, loi = false) {
  el.status.textContent = text;
  el.status.dataset.loi = loi ? "1" : "0";
}

function showState(state) {
  const { status, index, total, message } = state;

  if (message) {
    showStatus(message, true);
  } else if (status === "speaking") {
    showStatus(total > 1 ? `Đang đọc đoạn ${index + 1} trên ${total}` : "Đang đọc");
  } else if (status === "paused") {
    showStatus("Đã tạm dừng");
  } else {
    showStatus("Đang chờ");
  }

  el.doc.disabled = status === "speaking";
  el.tamDung.disabled = status !== "speaking";
  el.tiepTuc.disabled = status !== "paused";
  el.dung.disabled = status === "idle";
}

async function fillVoices(settings) {
  el.voice.innerHTML = "";
  const macDinh = document.createElement("option");
  macDinh.value = "";
  macDinh.textContent = "Giọng mặc định";
  el.voice.append(macDinh);

  let voices = [];
  try {
    voices = await send({ type: "voices" });
  } catch (err) {
    showStatus("Không đọc được danh sách giọng: " + err.message, true);
    return;
  }

  if (!Array.isArray(voices)) {
    showStatus(voices?.message || "Không đọc được danh sách giọng", true);
    return;
  }

  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = voice.lang ? `${voice.name} (${voice.lang})` : voice.name;
    el.voice.append(option);
  }

  const dangChon = settings.engine === "server" ? settings.server.voice : settings.voiceName;
  el.voice.value = dangChon || "";
}

function showRate(value) {
  el.rateValue.textContent = Number(value).toFixed(1).replace(".", ",");
}

async function start() {
  const settings = await send({ type: "settings" });
  el.rate.value = settings.rate;
  showRate(settings.rate);
  await fillVoices(settings);

  showState(await send({ type: "state" }));

  const { text } = await send({ type: "selection" });
  if (text.trim()) el.text.value = text.trim();
}

el.doc.addEventListener("click", async () => {
  const text = el.text.value.trim();
  if (!text) {
    showStatus("Chưa có văn bản nào để đọc", true);
    return;
  }
  const result = await send({ type: "speak", text });
  if (result && result.ok === false) showStatus(result.message, true);
});

el.tamDung.addEventListener("click", () => send({ type: "pause" }));
el.tiepTuc.addEventListener("click", () => send({ type: "resume" }));
el.dung.addEventListener("click", () => send({ type: "stop" }));

el.layDoan.addEventListener("click", async () => {
  const { text } = await send({ type: "selection" });
  if (text.trim()) el.text.value = text.trim();
  else showStatus("Không có văn bản nào được chọn", true);
});

el.moCaiDat.addEventListener("click", () => chrome.runtime.openOptionsPage());

el.rate.addEventListener("input", () => showRate(el.rate.value));
el.rate.addEventListener("change", () => send({ type: "saveSettings", patch: { rate: Number(el.rate.value) } }));

el.voice.addEventListener("change", async () => {
  const settings = await send({ type: "settings" });
  const patch =
    settings.engine === "server"
      ? { server: { voice: el.voice.value } }
      : { voiceName: el.voice.value };
  await send({ type: "saveSettings", patch });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.from === "background" && message.type === "state") showState(message.state);
});

start();
