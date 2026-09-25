// Danh sách giọng của extension nằm hết ở đây, không có trang cài đặt nào sửa
// được. Giọng trên máy bị lọc theo danh sách cho phép; giọng tiếng Việt chạy qua
// máy chủ trên máy được khai sẵn kèm địa chỉ và lệnh chạy.

const SYSTEM_VOICE_RULES = [
  { prefix: "microsoft an", lang: "vi-VN" },
  { prefix: "microsoft david", lang: "en-US" },
  { prefix: "microsoft mark", lang: "en-US" },
  { prefix: "microsoft zira", lang: "en-US" },
  { prefix: "google uk english", lang: "en-GB" },
  { prefix: "google us english", lang: "en-US" }
];

export const SERVER_PRESETS = [
  {
    id: "vieneu",
    label: "VieNeu-TTS v3 Turbo",
    baseUrl: "http://127.0.0.1:8000",
    model: "vieneu-v3-turbo",
    sampleRate: 48000,
    lang: "vi-VN",
    run: "uv run python -m apps.openai_speech",
    voices: [
      "Trúc Ly",
      "Anh Khôi",
      "Minh Quân Pro",
      "Thiền Tâm Đức",
      "Adam bựa",
      "Thục Đoan",
      "Quỳnh Anh",
      "Đức Trí",
      "Mạnh Dũng"
    ]
  }
];

export function presetById(id) {
  return SERVER_PRESETS.find((preset) => preset.id === id) || null;
}

// "Microsoft David Desktop - English (United States)" và "Microsoft David -
// English (United States)" là cùng một giọng dưới hai bộ máy của Windows. Cắt
// đuôi rồi mới so, để trong danh sách chỉ còn một dòng.
function tidyName(name) {
  return String(name)
    .split(" - ")[0]
    .replace(/\s+Desktop$/i, "")
    .trim();
}

export function matchSystemVoices(voices) {
  const items = [];
  const seen = new Set();

  for (const rule of SYSTEM_VOICE_RULES) {
    for (const voice of voices || []) {
      const name = String(voice?.name || "");
      if (!name.toLowerCase().startsWith(rule.prefix)) continue;

      const label = tidyName(name);
      if (seen.has(label)) continue;
      seen.add(label);

      items.push({ id: "system:" + name, label, lang: voice.lang || rule.lang });
    }
  }

  return items;
}

export function serverVoiceItems(preset, liveNames = []) {
  const names = preset.voices && preset.voices.length ? [...preset.voices] : [...liveNames];

  if (!names.length) {
    return [{ id: `server:${preset.id}:`, label: `Giọng mặc định của ${preset.label}`, lang: preset.lang }];
  }

  return names.map((name) => ({ id: `server:${preset.id}:${name}`, label: name, lang: preset.lang }));
}

export function parseVoiceId(id) {
  const text = String(id || "");
  if (text.startsWith("system:")) return { kind: "system", name: text.slice(7) };

  if (text.startsWith("server:")) {
    const rest = text.slice(7);
    const cut = rest.indexOf(":");
    if (cut < 0) return null;
    return { kind: "server", presetId: rest.slice(0, cut), name: rest.slice(cut + 1) };
  }

  return null;
}

export function serverOf(preset, settings = {}, voice = "") {
  return {
    baseUrl: preset.baseUrl,
    model: preset.model,
    voice,
    sampleRate: preset.sampleRate,
    apiKey: (settings.apiKeys && settings.apiKeys[preset.id]) || ""
  };
}

export function resolveVoice(voiceId, settings = {}) {
  const parsed = parseVoiceId(voiceId);

  if (parsed && parsed.kind === "server") {
    const preset = presetById(parsed.presetId);
    if (preset) return { engine: "server", preset, server: serverOf(preset, settings, parsed.name) };
  }

  return { engine: "system", voiceName: parsed && parsed.kind === "system" ? parsed.name : "" };
}

export function defaultVoiceId(groups) {
  const system = groups.find((group) => group.id === "system");
  const vietnamese = system?.items.find((item) => String(item.lang).toLowerCase().startsWith("vi"));
  if (vietnamese) return vietnamese.id;
  if (system?.items.length) return system.items[0].id;

  const filled = groups.find((group) => group.items.length);
  return filled ? filled.items[0].id : "";
}

export function buildCatalog(systemVoices, probes = []) {
  const groups = [
    {
      id: "system",
      label: "Giọng trên máy",
      ready: true,
      hint: "",
      items: matchSystemVoices(systemVoices)
    }
  ];

  for (const preset of SERVER_PRESETS) {
    const probe = probes.find((item) => item.presetId === preset.id) || {};
    groups.push({
      id: preset.id,
      label: preset.label,
      ready: !!probe.ready,
      hint: probe.ready ? "" : `${preset.label} chưa chạy. Chạy lệnh: ${preset.run}`,
      run: preset.run,
      items: serverVoiceItems(preset, probe.voices || [])
    });
  }

  return { groups, defaultId: defaultVoiceId(groups) };
}

export function groupOfVoice(catalog, voiceId) {
  return catalog.groups.find((group) => group.items.some((item) => item.id === voiceId)) || null;
}

export function defaultRateForVoice(voiceId) {
  const parsed = parseVoiceId(voiceId);
  if (parsed && parsed.kind === "server") return 1;
  return 0.8;
}

const VIETNAMESE_CHARS_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export function isVietnameseText(text, langCode = "auto") {
  if (langCode === "vi") return true;
  if (langCode && langCode !== "auto") return false;
  return VIETNAMESE_CHARS_REGEX.test(text || "");
}

const VIETNAMESE_SERVER_VOICE_ID = "server:vieneu:Anh Khôi";

export function pickVoiceForLanguage(catalog, isVietnamese) {
  const allItems = (catalog.groups || []).flatMap((g) => g.items || []);
  if (isVietnamese) {
    const serverReady = (catalog.groups || []).some(
      (group) => group.ready && group.items.some((item) => item.id === VIETNAMESE_SERVER_VOICE_ID)
    );
    if (serverReady) return VIETNAMESE_SERVER_VOICE_ID;
    const msAn = allItems.find(
      (item) =>
        item.label.toLowerCase().includes("microsoft an") ||
        item.id.toLowerCase().includes("microsoft an")
    );
    if (msAn) return msAn.id;
    const anyVi = allItems.find(
      (item) => item.lang && String(item.lang).toLowerCase().startsWith("vi")
    );
    if (anyVi) return anyVi.id;
  } else {
    const googleUkMale = allItems.find(
      (item) =>
        item.label.toLowerCase().includes("google uk english male") ||
        item.id.toLowerCase().includes("google uk english male")
    );
    if (googleUkMale) return googleUkMale.id;
    const googleUk = allItems.find(
      (item) =>
        item.label.toLowerCase().includes("google uk english") ||
        item.id.toLowerCase().includes("google uk english")
    );
    if (googleUk) return googleUk.id;
    const anyEn = allItems.find(
      (item) => item.lang && String(item.lang).toLowerCase().startsWith("en")
    );
    if (anyEn) return anyEn.id;
  }
  return catalog.defaultId || "";
}
