const OFFSCREEN_URL = "offscreen.html";

let creating = null;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });
  if (contexts.length) return;

  // Hai lời gọi createDocument chồng nhau thì lời thứ hai ném lỗi. Dùng chung
  // một promise để lần gọi sau chờ lần trước thay vì tạo thêm.
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Phát âm thanh do máy chủ chuyển văn bản thành tiếng trả về"
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}

async function callOffscreen(message) {
  await ensureOffscreen();
  const reply = await chrome.runtime.sendMessage({ target: "offscreen", ...message });
  if (reply && reply.error) throw new Error(reply.error);
  return reply;
}

function authHeaders(server) {
  const headers = { "Content-Type": "application/json" };
  if (server.apiKey) headers.Authorization = "Bearer " + server.apiKey;
  return headers;
}

export function speechRequest(text, server) {
  return {
    url: server.baseUrl.replace(/\/+$/, "") + "/v1/audio/speech",
    headers: authHeaders(server),
    body: {
      model: server.model,
      input: text,
      voice: server.voice || undefined,
      response_format: "wav",
      sample_rate: server.sampleRate
    }
  };
}

export async function listVoices(settings) {
  const base = settings.server.baseUrl.replace(/\/+$/, "");
  const res = await fetch(base + "/v1/voices", { headers: authHeaders(settings.server) });
  if (!res.ok) throw new Error("máy chủ trả về mã " + res.status);
  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.data || data.voices || [];
  return rows.map((v) => ({
    name: typeof v === "string" ? v : v.name || v.id,
    lang: (typeof v === "object" && (v.lang || v.language)) || ""
  }));
}

export async function check(settings) {
  const base = settings.server.baseUrl.replace(/\/+$/, "");
  const res = await fetch(base + "/v1/models", { headers: authHeaders(settings.server) });
  if (!res.ok) throw new Error("máy chủ trả về mã " + res.status);
  return res.json();
}

export async function speak(segments, settings) {
  const requests = segments.map((text) => speechRequest(text, settings.server));
  await callOffscreen({ type: "play", requests, volume: settings.volume, rate: settings.rate });
}

export async function pause() {
  await callOffscreen({ type: "pause" });
}

export async function resume() {
  await callOffscreen({ type: "resume" });
}

export async function stop() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });
  if (!contexts.length) return;
  await callOffscreen({ type: "stop" });
}
