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
  const body = {
    model: server.model,
    input: text,
    voice: server.voice || undefined,
    response_format: "wav"
  };

  // Máy chủ nào không khai sample_rate thì đừng gửi: có bản dựng từ chối nguyên
  // lời gọi khi gặp trường lạ.
  if (server.sampleRate) body.sample_rate = server.sampleRate;

  return {
    url: server.baseUrl.replace(/\/+$/, "") + "/v1/audio/speech",
    headers: authHeaders(server),
    body
  };
}

async function getJson(server, path, timeoutMs) {
  const base = server.baseUrl.replace(/\/+$/, "");
  const res = await fetch(base + path, {
    headers: authHeaders(server),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
  });
  if (!res.ok) throw new Error("máy chủ trả về mã " + res.status);
  return res.json();
}

// Mỗi máy chủ trả danh sách giọng một kiểu: mảng thuần, {data:[...]}, hoặc một
// đối tượng lấy tên giọng làm khoá.
export function voiceNamesFrom(data) {
  const rows = Array.isArray(data) ? data : data?.data || data?.voices;
  if (Array.isArray(rows)) {
    return rows.map((row) => (typeof row === "string" ? row : row.name || row.id || "")).filter(Boolean);
  }
  if (data && typeof data === "object") return Object.keys(data);
  return [];
}

export async function listVoices(server, timeoutMs) {
  return voiceNamesFrom(await getJson(server, "/v1/voices", timeoutMs));
}

export async function check(server, timeoutMs) {
  return getJson(server, "/v1/models", timeoutMs);
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
