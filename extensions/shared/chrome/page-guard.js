export function isTopWindow() {
  return window === window.top;
}

export function hostEquals(hostname) {
  return location.hostname === hostname;
}

export function pathIncludes(fragment) {
  return (location.pathname || '').indexOf(fragment) !== -1;
}

export function pathStartsWith(prefix) {
  return (location.pathname || '').indexOf(prefix) === 0;
}
