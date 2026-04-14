export function formatCount(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return '-';
  }
  const n = Number(value);
  if (n >= 100000000) {
    return `${(n / 100000000).toFixed(1)}亿`;
  }
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}万`;
  }
  return String(n);
}

function toAgoText(iso) {
  if (!iso) {
    return '-';
  }
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) {
    return '-';
  }
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) {
    return `${diffSec} 秒前`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} 分钟前`;
  }
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} 小时前`;
}

export function buildMetaText(snapshot, crawlState) {
  const captured = snapshot && Array.isArray(snapshot.users) ? snapshot.users.length : 0;
  const total = snapshot && snapshot.total != null ? snapshot.total : '?';
  const nextOffset = snapshot && snapshot.nextOffset != null ? snapshot.nextOffset : '?';
  const hasMore = snapshot && snapshot.hasMore ? '是' : '否';
  const running = crawlState && crawlState.running ? '采集中' : '空闲';
  const ticks = crawlState && crawlState.ticks != null ? crawlState.ticks : 0;
  const lastCaptureAgo = toAgoText(crawlState && crawlState.lastCaptureAt);
  const reqAttempt = crawlState && crawlState.requestAttempt != null ? crawlState.requestAttempt : 0;
  const reqSuccess = crawlState && crawlState.requestSuccess != null ? crawlState.requestSuccess : 0;
  const reqFail = crawlState && crawlState.requestFail != null ? crawlState.requestFail : 0;
  const warn =
    running === '采集中' && ticks > 10 && (!crawlState || !crawlState.lastCaptureAt)
      ? '；提示：已滚动较久仍无数据，请确认当前页确为“关注列表”并继续下拉'
      : '';
  return `状态=${running}，已抓取 ${captured}/${total}，hasMore=${hasMore}，nextOffset=${nextOffset}，请求=${reqAttempt}（成功${reqSuccess}/失败${reqFail}），滚动心跳=${ticks}，最近捕获=${lastCaptureAgo}${warn}`;
}
