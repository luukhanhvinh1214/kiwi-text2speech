export const SOURCE_LANGUAGES = [
  { code: "auto", label: "Tự động phát hiện" },
  { code: "en", label: "Tiếng Anh" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "zh-CN", label: "Tiếng Trung" },
  { code: "ja", label: "Tiếng Nhật" },
  { code: "ko", label: "Tiếng Hàn" },
  { code: "fr", label: "Tiếng Pháp" },
  { code: "de", label: "Tiếng Đức" },
  { code: "ru", label: "Tiếng Nga" },
  { code: "es", label: "Tiếng Tây Ban Nha" }
];

export const TARGET_LANGUAGES = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "Tiếng Anh" },
  { code: "zh-CN", label: "Tiếng Trung" },
  { code: "ja", label: "Tiếng Nhật" },
  { code: "ko", label: "Tiếng Hàn" },
  { code: "fr", label: "Tiếng Pháp" },
  { code: "de", label: "Tiếng Đức" },
  { code: "ru", label: "Tiếng Nga" },
  { code: "es", label: "Tiếng Tây Ban Nha" }
];

export function buildWebTranslateUrl({ text = "", sl = "auto", tl = "vi" }) {
  const query = encodeURIComponent(text);
  const source = encodeURIComponent(sl || "auto");
  const target = encodeURIComponent(tl || "vi");
  return `https://translate.google.com/?sl=${source}&tl=${target}&text=${query}&op=translate`;
}

export function parseTranslateResponse(data) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return "";
  return data[0]
    .filter((item) => Array.isArray(item) && typeof item[0] === "string")
    .map((item) => item[0])
    .join("");
}

export async function translateText({ text = "", sl = "auto", tl = "vi" }, fetchFn = fetch) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return { ok: false, message: "Không có văn bản để dịch" };

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(trimmed)}`;

  try {
    const response = await fetchFn(url);
    if (!response.ok) {
      return { ok: false, message: `Lỗi dịch (${response.status})` };
    }

    const data = await response.json();
    const translation = parseTranslateResponse(data);
    if (!translation) {
      return { ok: false, message: "Không nhận được bản dịch" };
    }

    return { ok: true, translation };
  } catch (err) {
    return { ok: false, message: err.message || "Lỗi kết nối mạng" };
  }
}
