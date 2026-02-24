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
  const camel = key === 'recorded_at' ? 'recordedAt' : key === 'created_at' ? 'createdAt' : key === 'shop_title' ? 'shopTitle' : key;
  return row[camel];
}

function isISOStamp(s) {
  if (typeof s !== 'string' || s.length < 16) return false;
  return s.includes('T') && (s.includes('Z') || s.includes('+') || /T\d{2}:\d{2}/.test(s));
}

function parseISOToEast8DateAndSlot(isoStr) {
  const d = new Date(isoStr.trim());
  if (Number.isNaN(d.getTime())) return null;
  const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
  let h = 0, m = 0;
  parts.forEach((p) => { if (p.type === 'hour') h = parseInt(p.value, 10); if (p.type === 'minute') m = parseInt(p.value, 10); });
  if (h === 0 && m === 0) {
    const prevDate = new Date(d.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
    return { dateStr: prevDate, slotIndex: SLOT_COUNT - 1 };
  }
  if (h < 9 || h > 24) return null;
  const minutesFrom9 = (h - 9) * 60 + m;
  const slotIndex = Math.min(Math.floor(minutesFrom9 / MINUTES_FROM_9), SLOT_COUNT - 1);
  return { dateStr, slotIndex };
}

/**
 * 解析时间 "YYYY-MM-DD:HH:mm:ss" 或 ISO "YYYY-MM-DDTHH:mm:ss" 得到 dateStr 与 20 分钟槽位索引 [0..45]
 * ISO 时按东八区取 dateStr。
 */
function parseRecordedAtToSlot(recordedAt) {
  if (!recordedAt || typeof recordedAt !== 'string') return null;
  const s = recordedAt.trim();
  if (s.length < 16) return null;
  if (isISOStamp(s)) return parseISOToEast8DateAndSlot(s);
  const dateStr = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const sep = s[10];
  const timeStart = sep === 'T' || sep === ' ' || sep === ':' ? 11 : 10;
  const timePart = s.slice(timeStart);
  const parts = timePart.split(':');
  let h = parseInt(parts[0], 10) || 0;
  const min = parseInt(parts[1], 10) || 0;
  if (h >= 0 && h < 9) h += 8;
  if (h === 0) {
    const prev = new Date(dateStr + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 1);
    return { dateStr: prev.toISOString().slice(0, 10), slotIndex: SLOT_COUNT - 1 };
  }
  if (h < 9 || h > 24) return null;
  const minutesFrom9 = (h - 9) * 60 + min;
  const slotIndex = Math.min(Math.floor(minutesFrom9 / MINUTES_FROM_9), SLOT_COUNT - 1);
  return { dateStr, slotIndex };
}

/**
 * 按 20 分钟槽位聚合：byDateSlot[dateStr][slotIndex][shopName] = rank（槽位内取最新）
 * @param {Array<{ created_at?: string, recorded_at?: string, shop_title: string, rank: number }>} rows
 * @returns {{ byDateSlot: Record<string, Record<number, Record<string, number>>>, shopNames: string[] }}
 */
export function marketRankRowsToChartData(rows) {
  const byDateSlot = {};
  const shopSet = new Set();
  if (!Array.isArray(rows) || rows.length === 0) {
    return { byDateSlot, shopNames: [] };
  }
  for (const row of rows) {
    const created = getRowValue(row, 'created_at');
    const recordedAt = created != null ? created : getRowValue(row, 'recorded_at');
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
 * 生成格子数据：单日/多日时返回 seriesItem（46 槽位 slotValues，与小图/大图 20 分钟粒度统一）；趋势时返回 data 供 TrendChartCell 使用。
 * @param {{ byDateSlot: Record<string, Record<number, Record<string, number>>>, shopNames: string[] }} chart
 * @param {{ viewMode: string, selectedDate: string | null, selectedDates: string[], trendDates: string[] }} context
 */
export function marketRankChartToGridItems(chart, context) {
  const { byDateSlot, shopNames } = chart || {};
  if (!shopNames || !shopNames.length) return [];
  const { viewMode, selectedDate, selectedDates = [], trendDates = [] } = context || {};
  const isTrend = viewMode === 'trend';
  const SLOT_19 = 30; // 19:00 对应槽位 30

  return shopNames.map((name) => {
    if (isTrend && trendDates.length > 0) {
      return {
        key: 'market-rank-' + name,
        title: '市场排名 - ' + name,
        data: trendDates.map((date) => ({
          date,
          value: (function (d, n) {
            var daySlot = byDateSlot[d];
            var slot19 = daySlot && daySlot[SLOT_19];
            var v = slot19 && slot19[n];
            return v != null ? v : null;
          })(date, name),
        })),
        isRate: false,
      };
    }
    const dateStr = selectedDate || selectedDates[0];
    const daySlots = dateStr && byDateSlot[dateStr] ? byDateSlot[dateStr] : {};
    const slotValues = [];
    for (var i = 0; i < SLOT_COUNT; i++) {
      var slotRow = daySlots[i];
      var v = slotRow && slotRow[name];
      slotValues.push(v != null ? v : null);
    }
    return {
      key: 'market-rank-' + name,
      title: '市场排名 - ' + name,
      seriesItem: {
        category: '市场排名',
        subCategory: name,
        isRate: false,
        slotValues,
      },
      isRate: false,
    };
  });
}
