export function getPopupRuntime(runtimeKey = '__AMCR_POPUP_RUNTIME__') {
  if (!runtimeKey) {
    return null;
  }
  return globalThis[runtimeKey] || null;
}
