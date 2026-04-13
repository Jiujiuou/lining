function parsePair(pair) {
  const index = pair.indexOf('=');
  if (index < 0) {
    return [pair, ''];
  }
  return [pair.slice(0, index), pair.slice(index + 1)];
}

function decodeValue(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  } catch {
    return String(value || '');
  }
}

export function parseQueryParam(url, key) {
  if (!url || !key) {
    return '';
  }

  try {
    const parsed = new URL(url, 'https://placeholder.local');
    const value = parsed.searchParams.get(String(key));
    return value == null ? '' : String(value).trim();
  } catch {
    const text = String(url);
    const queryIndex = text.indexOf('?');
    if (queryIndex < 0) {
      return '';
    }
    const query = text.slice(queryIndex + 1);
    const parts = query.split('&');
    for (let i = 0; i < parts.length; i += 1) {
      const [rawKey, rawValue] = parsePair(parts[i]);
      if (decodeValue(rawKey) !== key) {
        continue;
      }
      return decodeValue(rawValue).trim();
    }
    return '';
  }
}

export function parseKeyWordFromUrl(url) {
  return parseQueryParam(url, 'keyWord');
}

export function resolveRelativeUrl(targetUrl, baseUrl) {
  if (!targetUrl) {
    return '';
  }

  const rawTarget = String(targetUrl).trim();
  if (!rawTarget) {
    return '';
  }

  try {
    if (baseUrl) {
      return new URL(rawTarget, baseUrl).toString();
    }
    return new URL(rawTarget).toString();
  } catch {
    return rawTarget;
  }
}

