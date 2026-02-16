/**
 * 市场排名：与加购/流量来源对齐，按 20 分钟一个数据点聚合。
 * 槽位 9:00, 9:20, 9:40, ..., 24:00，共 46 个（与 supabaseCartLogToChart 一致）。
 */

const SLOT_COUNT = 46;
const MINUTES_FROM_9 = 20;

/** 生成 46 个槽位标签 "9:00", "9:20", ..., "24:00" */
export const MARKET_RANK_SLOT_LABELS = (() => {
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const h = 9 + Math.floor((i * MINUTES_FROM_9) / 60);
    const mm = (i * MINUTES_FROM_9) % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return out;
})();

function getRowValue(row, key) {
  const snake = row[key];
  if (snake !== undefined && snake !== null) return snake;
  const camel = key === 'recorded_at' ? 'recordedAt' : key === 'shop_title' ? 'shopTitle' : key;
  return row[camel];
}

/**
 * 解析 recorded_at "YYYY-MM-DD:HH:mm:ss" 得到 dateStr 与 20 分钟槽位索引 [0..45]
 * 规则与加购表一致：仅 9～24 点参与，0 点视为前一日 24 点。
 */
function parseRecordedAtToSlot(recordedAt) {
  if (!recordedAt || typeof recordedAt !== 'string') return null;
  const parts = recordedAt.trim().split(/[:\s-]/);
  if (parts.length < 5) return null;
  const y = parseInt(parts[0], 10);
  const m = parts[1];
  const d = parts[2];
  const h = parseInt(parts[3], 10);
  const min = parseInt(parts[4], 10) || 0;
  if (!Number.isFinite(h)) return null;
  const dateStr = `${y}-${m}-${d}`;
  let hour = h;
  if (hour === 0) {
    hour = 24;
    const prev = new Date(Date.UTC(y, parseInt(m, 10) - 1, parseInt(d, 10) - 1));
    return { dateStr: prev.toISOString().slice(0, 10), slotIndex: SLOT_COUNT - 1 };
  }
  if (hour < 9 || hour > 24) return null;
  const minutesFrom9 = (hour - 9) * 60 + min;
  const slotIndex = Math.min(Math.floor(minutesFrom9 / MINUTES_FROM_9), SLOT_COUNT - 1);
  return { dateStr, slotIndex };
}

/**
 * 按 20 分钟槽位聚合：byDateSlot[dateStr][slotIndex][shopName] = rank（槽位内取最新）
 * @param {Array<{ recorded_at: string, shop_title: string, rank: number }>} rows
 * @returns {{ byDateSlot: Record<string, Record<number, Record<string, number>>>, shopNames: string[] }}
 */
export function marketRankRowsToChartData(rows) {
  const byDateSlot = {};
  const shopSet = new Set();
  if (!Array.isArray(rows) || rows.length === 0) {
    return { byDateSlot, shopNames: [] };
  }
  for (const row of rows) {
    const recordedAt = getRowValue(row, 'recorded_at');
    if (recordedAt == null) continue;
    const parsed = parseRecordedAtToSlot(recordedAt);
    if (!parsed) continue;
    const { dateStr, slotIndex } = parsed;
    const shop = getRowValue(row, 'shop_title');
    const shopStr = shop != null ? String(shop) : '';
    const rankVal = getRowValue(row, 'rank');
    const rank = Number(rankVal);
    if (!Number.isFinite(rank)) continue;
    shopSet.add(shopStr);
    if (!byDateSlot[dateStr]) byDateSlot[dateStr] = {};
    if (!byDateSlot[dateStr][slotIndex]) byDateSlot[dateStr][slotIndex] = {};
    const existing = byDateSlot[dateStr][slotIndex][shopStr];
    const recStr = String(recordedAt);
    if (existing === undefined || recStr > String(existing.recorded_at)) {
      byDateSlot[dateStr][slotIndex][shopStr] = { rank, recorded_at: recStr };
    }
  }
  const shopNames = Array.from(shopSet).filter(Boolean).sort();
  // 只保留 rank 数值，便于上层使用
  const byDateSlotRank = {};
  for (const dateStr of Object.keys(byDateSlot)) {
    byDateSlotRank[dateStr] = {};
    for (const slotIndex of Object.keys(byDateSlot[dateStr])) {
      const slot = byDateSlot[dateStr][slotIndex];
      byDateSlotRank[dateStr][slotIndex] = {};
      for (const shop of Object.keys(slot)) {
        byDateSlotRank[dateStr][slotIndex][shop] = slot[shop].rank;
      }
    }
  }
  return { byDateSlot: byDateSlotRank, shopNames };
}

/**
 * 生成与趋势图一致的格子数据：单日/多日时 x 为 20 分钟槽位（9:00～24:00）；趋势时 x 为日期、取当日 19:00 槽位值。
 * @param {{ byDateSlot: Record<string, Record<number, Record<string, number>>>, shopNames: string[] }} chart
 * @param {{ viewMode: string, selectedDate: string | null, selectedDates: string[], trendDates: string[] }} context
 */
export function marketRankChartToGridItems(chart, context) {
  const { byDateSlot, shopNames } = chart || {};
  if (!shopNames?.length) return [];
  const { viewMode, selectedDate, selectedDates = [], trendDates = [] } = context || {};
  const isTrend = viewMode === 'trend';
  const SLOT_19 = 30; // 19:00 对应槽位 30 (9 + 30*20/60 = 19)

  return shopNames.map((name) => {
    let data;
    if (isTrend && trendDates.length > 0) {
      data = trendDates.map((date) => ({
        date,
        value: byDateSlot[date]?.[SLOT_19]?.[name] ?? null,
      }));
    } else {
      const dateStr = selectedDate || selectedDates[0];
      if (!dateStr || !byDateSlot[dateStr]) {
        data = MARKET_RANK_SLOT_LABELS.map((date, i) => ({ date, value: null }));
      } else {
        data = MARKET_RANK_SLOT_LABELS.map((slotLabel, i) => ({
          date: slotLabel,
          value: byDateSlot[dateStr][i]?.[name] ?? null,
        }));
      }
    }
    return {
      key: 'market-rank-' + name,
      title: '市场排名 - ' + name,
      data,
      isRate: false,
    };
  });
}
