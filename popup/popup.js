const el = {
  text: document.getElementById("text"),
  voice: document.getElementById("voice"),
  goiY: document.getElementById("goi-y"),
  rate: document.getElementById("rate"),
  rateValue: document.getElementById("rate-value"),
  doc: document.getElementById("doc"),
  tamDung: document.getElementById("tam-dung"),
  tiepTuc: document.getElementById("tiep-tuc"),
  dung: document.getElementById("dung"),
  status: document.getElementById("status"),
  layDoan: document.getElementById("lay-doan-da-chon")
};

const send = (message) => chrome.runtime.sendMessage(message);

let catalog = { groups: [], defaultId: "" };

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

function groupOf(voiceId) {
  return catalog.groups.find((group) => group.items.some((item) => item.id === voiceId)) || null;
}

function showHint(voiceId) {
  const group = groupOf(voiceId);
  el.goiY.textContent = group && !group.ready ? group.hint : "";
}

function fillVoices(chon) {
  el.voice.innerHTML = "";

  for (const group of catalog.groups) {
    if (!group.items.length) continue;

    const nhom = document.createElement("optgroup");
    nhom.label = group.ready ? group.label : `${group.label} (chưa chạy)`;

    for (const item of group.items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.lang ? `${item.label} (${item.lang})` : item.label;
      nhom.append(option);
    }

    el.voice.append(nhom);
  }

  el.voice.value = chon;
}

async function loadVoices(voiceId) {
  let ketQua;
  try {
    ketQua = await send({ type: "voices" });
  } catch (err) {
    showStatus("Không đọc được danh sách giọng: " + err.message, true);
    return;
  }

  if (!ketQua || !Array.isArray(ketQua.groups)) {
    showStatus(ketQua?.message || "Không đọc được danh sách giọng", true);
    return;
  }

  catalog = ketQua;

  // Giọng đã lưu có thể không còn trên máy này nữa. Hiện giọng mặc định nhưng
  // không ghi đè cài đặt: chỗ chọn giọng là của người dùng, popup chỉ bày ra.
  const conGiu = catalog.groups.some((group) => group.items.some((item) => item.id === voiceId));
  const chon = conGiu ? voiceId : catalog.defaultId;

  fillVoices(chon);
  showHint(chon);

  if (!chon) showStatus("Máy này chưa có giọng nào trong danh sách", true);
}

function showRate(value) {
  el.rateValue.textContent = Number(value).toFixed(1).replace(".", ",");
}

async function start() {
  const settings = await send({ type: "settings" });
  el.rate.value = settings.rate;
  showRate(settings.rate);

  showState(await send({ type: "state" }));

  const { text } = await send({ type: "selection" });
  if (text.trim()) el.text.value = text.trim();

  await loadVoices(settings.voiceId);
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

el.rate.addEventListener("input", () => showRate(el.rate.value));
el.rate.addEventListener("change", () => send({ type: "saveSettings", patch: { rate: Number(el.rate.value) } }));

el.voice.addEventListener("change", async () => {
  showHint(el.voice.value);
  await send({ type: "saveSettings", patch: { voiceId: el.voice.value } });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.from === "background" && message.type === "state") showState(message.state);
});

start();
