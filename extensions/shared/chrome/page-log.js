export function dispatchPageLog(eventName, level, msg) {
  try {
    document.dispatchEvent(new CustomEvent(eventName, { detail: { level, msg } }));
  } catch {
    // ignore dispatch failures
  }
}
