function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

export function toYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getLocalDateYmd(dayOffset = 0, baseDate = new Date()) {
  const d = new Date(baseDate);
  if (dayOffset !== 0) {
    d.setDate(d.getDate() + Number(dayOffset));
  }
  return toYmd(d);
}
