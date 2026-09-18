const el = {
  text: document.getElementById("text"),
  thuNho: document.getElementById("thu-nho"),
  dong: document.getElementById("dong-mo-rong")
};

const send = (message) => chrome.runtime.sendMessage(message);

el.thuNho.addEventListener("click", async () => {
  await send({ type: "luuNhap", text: el.text.value });
  await send({ type: "thuNhoKhungRong" });
});

el.dong.addEventListener("click", () => send({ type: "dongKhungRong" }));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") send({ type: "dongKhungRong" });
});

async function start() {
  const { text } = await send({ type: "layNhap" });
  el.text.value = text;
  el.text.focus();
}

start();
