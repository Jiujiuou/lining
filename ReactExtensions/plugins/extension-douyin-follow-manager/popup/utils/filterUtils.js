export function includesKeyword(user, keyword) {
  const k = (keyword || '').trim().toLowerCase();
  if (!k) {
    return true;
  }
  const text = [
    user.nickname || '',
    user.signature || '',
    user.uid || '',
    user.secUid || '',
  ]
    .join(' ')
    .toLowerCase();
  return text.includes(k);
}

