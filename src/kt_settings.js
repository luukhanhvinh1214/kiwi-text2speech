const KEY = "settings";

// Chỉ giọng và tốc độ là thứ người dùng đổi được, và đổi ngay trong popup.
// Những giá trị còn lại đặt cứng ở đây, không có trang cài đặt nào sửa.
export const DEFAULTS = {
  voiceId: "",
  rate: 1,
  pitch: 1,
  volume: 1,
  lang: "vi-VN",
  maxCharsPerSegment: 280,
  apiKeys: {},
  sourceLang: "auto",
  targetLang: "vi"
};

export async function loadSettings() {
  const stored = await chrome.storage.local.get(KEY);
  const saved = stored[KEY] || {};
  return {
    ...DEFAULTS,
    ...saved,
    apiKeys: { ...DEFAULTS.apiKeys, ...(saved.apiKeys || {}) }
  };
}

export async function saveSettings(patch) {
  const current = await loadSettings();
  const next = {
    ...current,
    ...patch,
    apiKeys: { ...current.apiKeys, ...(patch.apiKeys || {}) }
  };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

// Máy chủ đọc chạy trên chính máy người dùng nên mặc định không cần khoá. Ai bật
// xác thực thì đặt khoá thẳng vào chrome.storage, khoá đó không bao giờ đi ngược
// ra giao diện và không có trong mã nguồn.
export function withoutSecrets(settings) {
  const { apiKeys, ...rest } = settings;
  return { ...rest, apiKeysSet: Object.keys(apiKeys || {}).filter((id) => apiKeys[id]) };
}
