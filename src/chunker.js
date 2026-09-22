const SENTENCE_END = /(?<=[.!?…:])\s+|(?<=[.!?…])(?=["'”’)\]])/;
const CLAUSE_END = /(?<=[,;–—])\s+/;

function normalize(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function splitLong(piece, maxChars) {
  const out = [];
  let rest = piece;

  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const clauses = window.split(CLAUSE_END);
    let head = clauses.length > 1 ? clauses.slice(0, -1).join(" ") : "";

    if (!head) {
      const lastSpace = window.lastIndexOf(" ");
      head = lastSpace > maxChars * 0.4 ? window.slice(0, lastSpace) : window;
    }

    out.push(head.trim());
    rest = rest.slice(head.length).trim();
  }

  if (rest) out.push(rest);
  return out;
}

// Bộ đọc nào cũng xuống giọng ở cuối mỗi đoạn được đưa vào, nên ranh giới đoạn
// phải trùng với ranh giới câu. Cắt giữa câu nghe như đọc vấp.
export function splitIntoSegments(text, maxChars = 280) {
  const clean = normalize(text);
  if (!clean) return [];

  const sentences = [];
  for (const line of clean.split("\n")) {
    for (const sentence of line.split(SENTENCE_END)) {
      const piece = sentence.trim();
      if (!piece) continue;
      if (piece.length > maxChars) sentences.push(...splitLong(piece, maxChars));
      else sentences.push(piece);
    }
  }

  const segments = [];
  for (const sentence of sentences) {
    const last = segments[segments.length - 1];
    if (last && last.length + 1 + sentence.length <= maxChars) {
      segments[segments.length - 1] = last + " " + sentence;
    } else {
      segments.push(sentence);
    }
  }

  return segments;
}
