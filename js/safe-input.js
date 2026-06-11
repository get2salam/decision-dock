const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const IMPORT_LIMITS = Object.freeze({
  maxFieldLength: 2000,
  maxImportItems: 500,
});

export function boundedString(value, maxLen = IMPORT_LIMITS.maxFieldLength) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  return value.length > maxLen ? value.slice(0, maxLen) : value;
}

export function safeFiniteNumber(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function safeISODate(value, fallback = '') {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return fallback;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return fallback;
  }
  return value;
}

export function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function sanitizeImportPayload(parsed, { maxItems = IMPORT_LIMITS.maxImportItems } = {}) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, items: [], ui: {}, skipped: { invalid: 0, overflow: 0 } };
  }
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const skipped = { invalid: 0, overflow: 0 };
  const items = [];
  for (const raw of rawItems) {
    if (items.length >= maxItems) {
      skipped.overflow += 1;
      continue;
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      skipped.invalid += 1;
      continue;
    }
    items.push(raw);
  }
  const ui =
    parsed.ui && typeof parsed.ui === 'object' && !Array.isArray(parsed.ui) ? parsed.ui : {};
  return { ok: true, items, ui, skipped };
}
