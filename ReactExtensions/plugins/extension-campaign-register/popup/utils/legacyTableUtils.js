export function escHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escAttr(text) {
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function formatReportDateSlash(ymd) {
  if (!ymd) return '';
  return String(ymd).slice(0, 10).replace(/-/g, '/');
}

export function toNum(value) {
  const num = value != null ? Number(value) : 0;
  return Number.isNaN(num) ? 0 : num;
}

export function manualToInputValue(stored) {
  if (stored == null || stored === '') return '';
  const num = Number(stored);
  if (Number.isNaN(num)) return '';
  return String(num);
}
