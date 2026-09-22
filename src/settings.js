const KEY = "settings";

export const DEFAULTS = {
  engine: "system",
  lang: "vi-VN",
  voiceName: "",
  rate: 1,
  pitch: 1,
  volume: 1,
  maxCharsPerSegment: 280,
  server: {
    baseUrl: "http://127.0.0.1:8000",
    model: "vieneu-v3-turbo",
    voice: "",
    apiKey: "",
    sampleRate: 24000
  }
};

export async function loadSettings() {
  const stored = await chrome.storage.local.get(KEY);
  const saved = stored[KEY] || {};
  return {
    ...DEFAULTS,
    ...saved,
    server: { ...DEFAULTS.server, ...(saved.server || {}) }
  };
}

export async function saveSettings(patch) {
  const current = await loadSettings();
  const next = {
    ...current,
    ...patch,
    server: { ...current.server, ...(patch.server || {}) }
  };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

// Khoá của máy chủ chỉ nằm trong chrome.storage.local của máy người dùng.
// Không ghi vào mã nguồn và không đồng bộ lên tài khoản.
export function withoutSecrets(settings) {
  const { apiKey, ...server } = settings.server;
  return { ...settings, server: { ...server, apiKeyDaDat: !!apiKey } };
}
