export function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

export function getEast8TimeString(date = new Date()) {
  const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
  const east8 = new Date(utcTime + 8 * 60 * 60 * 1000);

  return (
    `${east8.getFullYear()}-${pad2(east8.getMonth() + 1)}-${pad2(east8.getDate())}:` +
    `${pad2(east8.getHours())}:${pad2(east8.getMinutes())}:${pad2(east8.getSeconds())}`
  );
}

export function toEast8TimestampISO(recordedAtString) {
  const source = String(recordedAtString).trim();

  if (source.length >= 19 && source[10] === ':') {
    return `${source.slice(0, 10)}T${source.slice(11, 19)}+08:00`;
  }

  return source;
}

export function getTimeSlotKey(recordedAtString, throttleMinutes) {
  const source = String(recordedAtString).trim();
  const minutes = Number(throttleMinutes);

  if (source.length < 19 || source[10] !== ':' || !(minutes > 0)) {
    return '';
  }

  const datePart = source.slice(0, 10);
  const hour = source.slice(11, 13);
  const minute = parseInt(source.slice(14, 16), 10);

  if (Number.isNaN(minute)) {
    return '';
  }

  const slotMinute = Math.floor(minute / minutes) * minutes;
  return `${datePart}:${hour}:${pad2(slotMinute)}`;
}

export function getTimeSlotTimestampISO(recordedAtString, throttleMinutes) {
  const slotKey = getTimeSlotKey(recordedAtString, throttleMinutes);
  if (!slotKey) return '';
  return `${slotKey.slice(0, 10)}T${slotKey.slice(11)}:00+08:00`;
}

export function formatMetric(value) {
  if (value == null) return 'N/A';

  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return String(value);
  }

  return String(numberValue);
}

export function formatRate(value) {
  if (value == null) return 'N/A';

  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return String(value);
  }

  return `${(Math.round(numberValue * 10000) / 100).toFixed(2)}%`;
}
