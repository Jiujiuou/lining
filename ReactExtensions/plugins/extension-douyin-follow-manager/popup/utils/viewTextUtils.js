export function formatCount(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return '-';
  }
  const n = Number(value);
  if (n >= 100000000) {
    return `${(n / 100000000).toFixed(1)}亿`;
  }
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  return String(n);
}
