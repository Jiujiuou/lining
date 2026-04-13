const DEFAULT_THROTTLE_MINUTES = 20;

function pad2(num) {
  return (num < 10 ? '0' : '') + num;
}

function resolveThrottleMinutes(throttleMinutes) {
  const parsed = Number(throttleMinutes);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_THROTTLE_MINUTES;
  }
  return Math.floor(parsed);
}

export function getEast8TimeStr(date = new Date()) {
  const current = date instanceof Date ? date : new Date(date);
  const utc = current.getTime() + current.getTimezoneOffset() * 60000;
  const east8 = new Date(utc + 8 * 60 * 60 * 1000);

  return [
    east8.getFullYear(),
    '-',
    pad2(east8.getMonth() + 1),
    '-',
    pad2(east8.getDate()),
    ':',
    pad2(east8.getHours()),
    ':',
    pad2(east8.getMinutes()),
    ':',
    pad2(east8.getSeconds()),
  ].join('');
}

export function getSlotKey(recordedAtStr, throttleMinutes = DEFAULT_THROTTLE_MINUTES) {
  const text = String(recordedAtStr || '').trim();
  if (text.length < 19 || text[10] !== ':') {
    return '';
  }

  const throttle = resolveThrottleMinutes(throttleMinutes);
  const datePart = text.slice(0, 10);
  const hour = text.slice(11, 13);
  const minute = Number.parseInt(text.slice(14, 16), 10);
  if (Number.isNaN(minute)) {
    return '';
  }

  const slotMinute = Math.floor(minute / throttle) * throttle;
  return `${datePart}:${hour}:${pad2(slotMinute)}`;
}

export function toCreatedAtISO(recordedAtStr) {
  const text = String(recordedAtStr || '').trim();
  if (text.length >= 19 && text[10] === ':') {
    return `${text.slice(0, 10)}T${text.slice(11, 19)}+08:00`;
  }
  return text;
}

export function getSlotTsISO(recordedAtStr, throttleMinutes = DEFAULT_THROTTLE_MINUTES) {
  const slotKey = getSlotKey(recordedAtStr, throttleMinutes);
  if (!slotKey) {
    return '';
  }
  return `${slotKey.slice(0, 10)}T${slotKey.slice(11)}:00+08:00`;
}

