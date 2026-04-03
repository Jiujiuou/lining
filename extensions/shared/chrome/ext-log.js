export function sendPrefixedRuntimeLog(type, prefix, msg) {
  try {
    chrome.runtime.sendMessage({ type, msg: `${prefix} ${msg}` });
  } catch {
    // ignore runtime delivery failures
  }
}

export function createPrefixedRuntimeLogger(type, prefix) {
  return function log(msg) {
    sendPrefixedRuntimeLog(type, prefix, msg);
  };
}
