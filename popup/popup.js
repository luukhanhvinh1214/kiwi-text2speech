const el = {
  text: document.getElementById("text"),
  oVanBan: document.getElementById("o-van-ban"),
  moRong: document.getElementById("mo-rong"),
  lopPhu: document.getElementById("lop-phu"),
  choVanBan: document.getElementById("cho-van-ban"),
  thuNho: document.getElementById("thu-nho"),
  dongMoRong: document.getElementById("dong-mo-rong"),
  voice: document.getElementById("voice"),
  goiY: document.getElementById("goi-y"),
  rate: document.getElementById("rate"),
  rateValue: document.getElementById("rate-value"),
  doc: document.getElementById("doc"),
  tamDung: document.getElementById("tam-dung"),
  tiepTuc: document.getElementById("tiep-tuc"),
  dung: document.getElementById("dung"),
  status: document.getElementById("status"),
  doiNen: document.getElementById("doi-nen"),
  khoiDong: document.getElementById("khoi-dong"),
  btnKhoiDong: document.getElementById("btn-khoi-dong")
};

const send = (message) => chrome.runtime.sendMessage(message);

let catalog = { groups: [], defaultId: "" };
let state = { status: "idle", index: 0, total: 0, message: "" };
let sanSang = false;

function showStatus(text, kieu = "") {
  el.status.textContent = text;
  el.status.dataset.kieu = kieu;
}

function render() {
  const { status, message } = state;

  if (message) showStatus(message, "loi");
  else if (status === "preparing") showStatus("");
  else if (status === "speaking") showStatus("Đang đọc");
  else if (status === "paused") showStatus("Đã tạm dừng");
  else if (sanSang) showStatus("Sẵn sàng", "san-sang");
  else showStatus("Đang chờ");

  const dangCho = status === "preparing";
  el.doc.dataset.dangCho = dangCho ? "1" : "0";
  el.doc.disabled = dangCho || status === "speaking";
  el.tamDung.disabled = status !== "speaking";
  el.tiepTuc.disabled = status !== "paused";
  el.dung.disabled = status === "idle";
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
  const thieu = group && !group.ready;

  el.goiY.textContent = thieu ? group.hint : "";
  el.khoiDong.hidden = !(thieu && group.run);

  sanSang = !!voiceId && !!group && group.ready;
  render();
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
    showState({ ...state, message: "Không đọc được danh sách giọng: " + err.message });
    return;
  }

  if (!ketQua || !Array.isArray(ketQua.groups)) {
    showState({ ...state, message: ketQua?.message || "Không đọc được danh sách giọng" });
    return;
  }

  catalog = ketQua;

  // Giọng đã lưu có thể không còn trên máy này, nhưng đừng ghi đè cài đặt của người dùng.
  const conGiu = catalog.groups.some((group) => group.items.some((item) => item.id === voiceId));
  const chon = conGiu ? voiceId : catalog.defaultId;

  fillVoices(chon);
  showHint(chon);

  if (!chon) showState({ ...state, message: "Máy này chưa có giọng nào trong danh sách" });
}

function showNen() {
  const nen = window.kiwiNen.dangDung();
  const nhan = nen === "toi" ? "Chuyển sang nền sáng" : "Chuyển sang nền tối";

  el.doiNen.dataset.nen = nen;
  el.doiNen.title = nhan;
  el.doiNen.setAttribute("aria-label", nhan);
}

function showRate(value) {
  el.rateValue.textContent = Number(value).toFixed(1).replace(".", ",");
}

function moRongOVanBan(bat) {
  el.lopPhu.hidden = !bat;
  document.body.classList.toggle("mo-rong", bat);

  if (bat) el.choVanBan.append(el.text);
  else el.oVanBan.append(el.text);

  el.text.focus();
}

async function start() {
  showNen();

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
    showState({ ...state, message: "Vui lòng nhập nội dung." });
    return;
  }

  // Thăm dò máy chủ mất tới 2 giây, nên bật con quay ngay chứ không chờ báo về.
  showState({ ...state, status: "preparing", message: "" });

  const result = await send({ type: "speak", text });
  if (result && result.ok === false) showState({ ...state, status: "idle", message: result.message });
});

el.tamDung.addEventListener("click", () => send({ type: "pause" }));
el.tiepTuc.addEventListener("click", () => send({ type: "resume" }));
el.dung.addEventListener("click", () => send({ type: "stop" }));

el.doiNen.addEventListener("click", () => {
  window.kiwiNen.doi();
  showNen();
});

el.moRong.addEventListener("click", () => moRongOVanBan(true));
el.thuNho.addEventListener("click", () => moRongOVanBan(false));
el.dongMoRong.addEventListener("click", () => moRongOVanBan(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.lopPhu.hidden) {
    event.preventDefault();
    moRongOVanBan(false);
  }
});

el.rate.addEventListener("input", () => showRate(el.rate.value));
el.rate.addEventListener("change", () => send({ type: "saveSettings", patch: { rate: Number(el.rate.value) } }));

el.voice.addEventListener("change", async () => {
  showHint(el.voice.value);
  await send({ type: "saveSettings", patch: { voiceId: el.voice.value } });
});

el.btnKhoiDong.addEventListener("click", async () => {
  const lenh = catalog.groups
    .filter((group) => group.run && !group.ready)
    .map((group) => group.run)
    .join("\n");
  try {
    await navigator.clipboard.writeText(lenh);
    el.btnKhoiDong.textContent = "Đã sao chép";
    setTimeout(() => {
      el.btnKhoiDong.textContent = "Sao chép lệnh khởi động";
    }, 2000);
  } catch (err) {
    showState({ ...state, message: "Không sao chép được: " + err.message });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.from === "background" && message.type === "state") showState(message.state);
});

start();
