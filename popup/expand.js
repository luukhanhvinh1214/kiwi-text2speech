const el = {
  text: document.getElementById("text"),
  shrink: document.getElementById("shrink"),
  close: document.getElementById("close-expand")
};

const send = (message) => chrome.runtime.sendMessage(message);

el.shrink.addEventListener("click", async () => {
  await send({ type: "saveDraft", text: el.text.value });
  await send({ type: "shrinkFrame" });
});

el.close.addEventListener("click", () => send({ type: "closeFrame" }));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") send({ type: "closeFrame" });
});

async function start() {
  const { text } = await send({ type: "takeDraft" });
  el.text.value = text;
  el.text.focus();
}

start();
