export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatLogTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const pad = (value) => (value < 10 ? `0${value}` : String(value));
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch (_error) {
    return '';
  }
}
