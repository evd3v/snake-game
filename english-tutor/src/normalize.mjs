export function normalizeHeadword(s) {
  return String(s || '')
    .replace(/&#x2026;|…|\.\.\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
