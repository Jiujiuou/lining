export function estimateBytes(value) {
  try {
    return JSON.stringify(value == null ? null : value).length;
  } catch (error) {
    return 0;
  }
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function countMapEntries(mapObj) {
  if (!mapObj || typeof mapObj !== 'object') return 0;
  return Object.keys(mapObj).filter((key) => key !== '__meta').length;
}

export function displayMoneyCell(value) {
  if (value == null || typeof value !== 'number' || Number.isNaN(value)) return '';
  return value === 0 ? '' : value.toFixed(2);
}

export function displayRoiCell(charge, amount) {
  const cost = charge != null ? Number(charge) : 0;
  if (cost === 0 || Number.isNaN(cost)) return '';
  const income = amount != null ? Number(amount) : 0;
  if (Number.isNaN(income)) return '';
  const roi = income / cost;
  return roi === 0 ? '' : roi.toFixed(2);
}

export function makeExportFilename() {
  const now = new Date();
  const pad2 = (num) => (num < 10 ? `0${num}` : String(num));
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  const hh = pad2(now.getHours());
  const mm = pad2(now.getMinutes());
  const ss = pad2(now.getSeconds());
  return `推广登记_${y}${m}${d}_${hh}${mm}${ss}.xls`;
}
