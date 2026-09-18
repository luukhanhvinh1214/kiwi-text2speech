export function listVoices() {
  return new Promise((resolve) => {
    chrome.tts.getVoices((voices) => {
      resolve(
        (voices || []).map((v) => ({
          name: v.voiceName,
          lang: v.lang || "",
          remote: !!v.remote
        }))
      );
    });
  });
}

function optionsFor(settings, index, total, onEvent) {
  const options = {
    enqueue: index > 0,
    rate: settings.rate,
    pitch: settings.pitch,
    volume: settings.volume,
    onEvent: (event) => {
      if (event.type === "start") onEvent({ type: "start", index, total });
      else if (event.type === "end" && index === total - 1) onEvent({ type: "end", index, total });
      else if (event.type === "error") onEvent({ type: "error", index, message: event.errorMessage });
      else if (event.type === "interrupted" || event.type === "cancelled") onEvent({ type: "stopped", index });
    }
  };

  // Đặt cả voiceName lẫn lang thì Chrome lấy lang làm điều kiện lọc và có thể
  // bỏ qua giọng đã chọn. Chọn giọng cụ thể thì để giọng đó tự quyết ngôn ngữ.
  if (settings.voiceName) options.voiceName = settings.voiceName;
  else if (settings.lang) options.lang = settings.lang;

  return options;
}

export async function speak(segments, settings, onEvent) {
  await stop();

  for (let index = 0; index < segments.length; index++) {
    const options = optionsFor(settings, index, segments.length, onEvent);
    await new Promise((resolve, reject) => {
      chrome.tts.speak(segments[index], options, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }
}

export function pause() {
  chrome.tts.pause();
  return Promise.resolve();
}

export function resume() {
  chrome.tts.resume();
  return Promise.resolve();
}

export function stop() {
  chrome.tts.stop();
  return Promise.resolve();
}
