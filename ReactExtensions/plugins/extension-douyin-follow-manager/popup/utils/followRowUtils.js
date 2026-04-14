export function rowKey(user, index) {
  if (user && user.uid) {
    return `uid:${user.uid}`;
  }
  if (user && user.secUid) {
    return `sec:${user.secUid}`;
  }
  return `idx:${index}`;
}

export function buildUserUrl(user) {
  if (!user) {
    return '';
  }
  if (user.secUid) {
    return `https://www.douyin.com/user/${encodeURIComponent(String(user.secUid))}?from_tab_name=main`;
  }
  if (user.uid) {
    return `https://www.douyin.com/user/${encodeURIComponent(String(user.uid))}?from_tab_name=main`;
  }
  return '';
}

