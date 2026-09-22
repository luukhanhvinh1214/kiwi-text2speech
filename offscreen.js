const state = {
  audio: null,
  stopped: true,
  volume: 1,
  rate: 1
};

function report(event) {
  chrome.runtime.sendMessage({ from: "offscreen", ...event }).catch(() => {});
}

async function fetchAudio(request) {
  const res = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error("máy chủ trả về mã " + res.status + (detail ? ": " + detail.slice(0, 200) : ""));
  }
  return URL.createObjectURL(await res.blob());
}

function playUrl(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.volume = state.volume;
    audio.playbackRate = state.rate;
    state.audio = audio;

    audio.addEventListener("ended", resolve, { once: true });
    audio.addEventListener(
      "error",
      () => reject(new Error("không phát được đoạn âm thanh máy chủ trả về")),
      { once: true }
    );
    audio.play().catch(reject);
  });
}

async function run(requests) {
  let pending = fetchAudio(requests[0]);

  for (let index = 0; index < requests.length; index++) {
    let url;
    try {
      url = await pending;
    } catch (err) {
      report({ type: "error", index, message: err.message });
      return;
    }

    if (state.stopped) {
      URL.revokeObjectURL(url);
      return;
    }

    // Tải đoạn kế tiếp trong lúc đoạn này đang phát, để giữa hai đoạn không có
    // khoảng lặng bằng đúng thời gian máy chủ tổng hợp.
    pending =
      index + 1 < requests.length
        ? fetchAudio(requests[index + 1]).catch((err) => {
            report({ type: "error", index: index + 1, message: err.message });
            return null;
          })
        : null;

    report({ type: "start", index, total: requests.length });
    try {
      await playUrl(url);
    } catch (err) {
      if (!state.stopped) report({ type: "error", index, message: err.message });
      URL.revokeObjectURL(url);
      return;
    } finally {
      URL.revokeObjectURL(url);
    }

    if (state.stopped) return;
    if (pending === null && index + 1 < requests.length) return;
  }

  state.stopped = true;
  report({ type: "end" });
}

function stop() {
  state.stopped = true;
  if (state.audio) {
    state.audio.pause();
    state.audio.src = "";
    state.audio = null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target !== "offscreen") return;

  if (message.type === "play") {
    stop();
    state.stopped = false;
    state.volume = message.volume ?? 1;
    state.rate = message.rate ?? 1;
    run(message.requests).catch((err) => report({ type: "error", message: err.message }));
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "pause") {
    if (state.audio) state.audio.pause();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "resume") {
    if (state.audio) state.audio.play().catch(() => {});
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "stop") {
    stop();
    sendResponse({ ok: true });
    return;
  }

  sendResponse({ error: "không hiểu lệnh " + message.type });
});
