/**
 * 将 sycm_cart_log 表数据转为与 parseWorkbook 一致的结构，用于图表展示。
 * 表字段：item_cart_cnt, recorded_at (东八区 "YYYY-MM-DD:HH:mm:ss")
 * 指标名：商品加购件数；时间轴：9～24 点。
 */

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

/**
 * 解析 recorded_at 字符串 "YYYY-MM-DD:HH:mm:ss" 为 { dateStr, hour }
 * hour 仅取 9～24：0 点视为前一日 24 点，1～8 点不参与 9～24 轴
 */
function parseRecordedAt(recordedAt) {
  if (!recordedAt || typeof recordedAt !== 'string') return null;
  const parts = recordedAt.trim().split(/[:\s-]/);
  if (parts.length < 4) return null;
  const y = parseInt(parts[0], 10);
  const m = parts[1];
  const d = parts[2];
  const h = parseInt(parts[3], 10);
  if (!Number.isFinite(h)) return null;
  const dateStr = `${y}-${m}-${d}`;
  let hour = h;
  if (hour === 0) {
    hour = 24;
    const prev = new Date(Date.UTC(y, parseInt(m, 10) - 1, parseInt(d, 10) - 1));
    const prevStr = prev.toISOString().slice(0, 10);
    return { dateStr: prevStr, hour: 24 };
  }
  if (hour < 9 || hour > 24) return null;
  return { dateStr, hour };
}

/**
 * @param {Array<{ item_cart_cnt: number, recorded_at: string }>} rows
 * @returns {{ dates: string[], byDate: Record<string, { series: Array<...>, actions: Record<number, string[]> }> }}
 */
export function cartLogRowsToChartData(rows) {
  const byDate = {};
  const dateSet = new Set();

  // (dateStr, hour) -> 保留 recorded_at 最新的一条的 item_cart_cnt
  const keyToLatest = {};
  for (const row of rows || []) {
    if (row == null || typeof row.item_cart_cnt === 'undefined' || !row.recorded_at) continue;
    const parsed = parseRecordedAt(row.recorded_at);
    if (!parsed) continue;
    const { dateStr, hour } = parsed;
    const cnt = Number(row.item_cart_cnt);
    if (!Number.isFinite(cnt)) continue;
    const key = `${dateStr}-${hour}`;
    const existing = keyToLatest[key];
    if (!existing || String(row.recorded_at) > String(existing.recorded_at)) {
      keyToLatest[key] = { dateStr, hour, item_cart_cnt: cnt, recorded_at: row.recorded_at };
    }
  }

  for (const entry of Object.values(keyToLatest)) {
    const { dateStr, hour, item_cart_cnt: cnt } = entry;
    dateSet.add(dateStr);
    if (!byDate[dateStr]) {
      byDate[dateStr] = { series: [], actions: {}, hourValue: {} };
      HOURS.forEach((h) => {
        byDate[dateStr].actions[h] = [];
      });
    }
    byDate[dateStr].hourValue[hour] = cnt;
  }

  // 每个日期生成一个 series：商品加购件数，values 为 9～24 点
  const dates = Array.from(dateSet).filter(Boolean).sort();
  dates.forEach((dateStr) => {
    const hourValue = byDate[dateStr].hourValue || {};
    const values = {};
    HOURS.forEach((h) => {
      values[h] = hourValue[h] ?? null;
    });
    byDate[dateStr].series = [
      {
        category: '小贝壳',
        subCategory: '商品加购件数',
        isRate: false,
        values,
      },
    ];
    delete byDate[dateStr].hourValue;
  });

  return { dates, byDate };
}

/** 20 分钟间隔的槽位：9:00, 9:20, 9:40, ..., 24:00，共 46 个；x 为小时小数 9, 9+1/3, 9+2/3, 10, ... */
const SLOT_COUNT = 46;
const MINUTES_FROM_9 = 20;

/**
 * 解析 recorded_at 为 (dateStr, slotIndex)，与加购/排名 20 分钟槽位一致
 * 支持 "YYYY-MM-DD:HH:mm:ss" 与 Supabase 返回的 ISO "YYYY-MM-DDTHH:mm:ss.sssZ"
 * @param {string} recordedAt
 * @returns {{ dateStr: string, slotIndex: number } | null}
 */
function parseRecordedAtToSlot(recordedAt) {
  if (recordedAt == null) return null;
  const s = typeof recordedAt === 'string' ? recordedAt.trim() : String(recordedAt);
  if (s.length < 16) return null;
  const dateStr = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const sep = s[10];
  const timeStart = sep === 'T' || sep === ' ' || sep === ':' ? 11 : 10;
  const timePart = s.slice(timeStart);
  const parts = timePart.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const minutesFrom9 = (h - 9) * 60 + m;
  if (minutesFrom9 < 0 || minutesFrom9 > (24 - 9) * 60) return null;
  const slotIndex = Math.min(Math.floor(minutesFrom9 / MINUTES_FROM_9), SLOT_COUNT - 1);
  return { dateStr, slotIndex };
}

/**
 * 从原始行中取出某日的数据，按 20 分钟一个点聚合（取每段内最新值），用于大图。
 * 横坐标仍用 9～24 整点，数据点用 x=9, 9.333, 9.667, 10... 以便落在整点之间。
 * @param {Array<{ item_cart_cnt: number, recorded_at: string }>} rows
 * @param {string} dateStr 如 "2026-02-16"
 * @returns {Array<{ x: number, time: string, value: number }>}
 */
export function getCartLog20MinPointsForDate(rows, dateStr) {
  if (!dateStr || !Array.isArray(rows)) return [];
  const prefix = dateStr + ':';
  const slotToLatest = {};
  for (const row of rows) {
    const r = row.recorded_at;
    if (typeof r !== 'string' || !r.startsWith(prefix)) continue;
    const value = Number(row.item_cart_cnt);
    if (!Number.isFinite(value)) continue;
    const timePart = r.slice(prefix.length);
    const parts = timePart.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const minutesFrom9 = (h - 9) * 60 + m;
    if (minutesFrom9 < 0 || minutesFrom9 > (24 - 9) * 60) continue;
    const slotIndex = Math.min(Math.floor(minutesFrom9 / MINUTES_FROM_9), SLOT_COUNT - 1);
    const existing = slotToLatest[slotIndex];
    if (!existing || String(r) > String(existing.recorded_at)) {
      slotToLatest[slotIndex] = { value, recorded_at: r };
    }
  }
  const out = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const x = 9 + (i * MINUTES_FROM_9) / 60;
    const h = 9 + Math.floor((i * MINUTES_FROM_9) / 60);
    const mm = (i * MINUTES_FROM_9) % 60;
    const time = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const entry = slotToLatest[i];
    out.push({ x, time, value: entry ? entry.value : null });
  }
  return out;
}

// ========== 流量来源 sycm_flow_source_log ==========
const FLOW_SERIES = [
  { key: 'search_uv', category: '流量来源', subCategory: '搜索访客数', isRate: false },
  { key: 'search_pay_rate', category: '流量来源', subCategory: '搜索支付转化率', isRate: true },
  { key: 'cart_uv', category: '流量来源', subCategory: '购物车访客数', isRate: false },
  { key: 'cart_pay_rate', category: '流量来源', subCategory: '购物车支付转化率', isRate: true },
];

/**
 * 按 20 分钟槽位聚合（与加购/排名一致），每槽位保留 recorded_at 最新的一条，输出 slotValues 供 46 点图使用。
 * @param {Array<{ recorded_at: string, search_uv: number, search_pay_rate: number, cart_uv: number, cart_pay_rate: number }>} rows
 * @returns {{ dates: string[], byDate: Record<string, { series: Array<{ ... slotValues }>, actions: Record<number, string[]> }> }}
 */
export function flowSourceRowsToChartData(rows) {
  const byDate = {};
  const dateSet = new Set();
  const keyToLatest = {};

  for (const row of rows || []) {
    if (!row || row.recorded_at == null || row.recorded_at === '') continue;
    const parsed = parseRecordedAtToSlot(row.recorded_at);
    if (!parsed) continue;
    const { dateStr, slotIndex } = parsed;
    const key = `${dateStr}-${slotIndex}`;
    const existing = keyToLatest[key];
    if (!existing || String(row.recorded_at) > String(existing.recorded_at)) {
      const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
      keyToLatest[key] = {
        dateStr,
        slotIndex,
        search_uv: num(row.search_uv),
        search_pay_rate: num(row.search_pay_rate),
        cart_uv: num(row.cart_uv),
        cart_pay_rate: num(row.cart_pay_rate),
        recorded_at: row.recorded_at,
      };
    }
  }

  for (const entry of Object.values(keyToLatest)) {
    const { dateStr, slotIndex } = entry;
    dateSet.add(dateStr);
    if (!byDate[dateStr]) {
      byDate[dateStr] = { series: [], actions: {} };
    }
    if (!byDate[dateStr].slotValue) byDate[dateStr].slotValue = {};
    if (!byDate[dateStr].slotValue[slotIndex]) byDate[dateStr].slotValue[slotIndex] = {};
    FLOW_SERIES.forEach((s) => {
      byDate[dateStr].slotValue[slotIndex][s.key] = entry[s.key];
    });
  }

  const dates = Array.from(dateSet).filter(Boolean).sort();
  dates.forEach((dateStr) => {
    const slotValue = byDate[dateStr].slotValue || {};
    byDate[dateStr].series = FLOW_SERIES.map((s) => {
      const slotValues = Array.from({ length: SLOT_COUNT }, (_, i) =>
        slotValue[i] && slotValue[i][s.key] != null ? slotValue[i][s.key] : null
      );
      return { category: s.category, subCategory: s.subCategory, isRate: s.isRate, slotValues };
    });
    delete byDate[dateStr].slotValue;
    HOURS.forEach((h) => {
      byDate[dateStr].actions[h] = [];
    });
  });

  return { dates, byDate };
}

/**
 * 合并加购与流量来源的图表数据：日期取并集，按日期合并 series。
 */
export function mergeCartAndFlowChartData(cartData, flowData) {
  if (!cartData || !cartData.dates) return flowData || { dates: [], byDate: {} };
  if (!flowData || !flowData.dates) return cartData;
  const dates = [...new Set([...cartData.dates, ...flowData.dates])].sort();
  const byDate = {};
  dates.forEach((d) => {
    if (!byDate[d]) byDate[d] = { series: [], actions: {} };
    const cartDay = cartData.byDate[d] || { series: [], actions: {} };
    const flowDay = flowData.byDate[d] || { series: [], actions: {} };
    HOURS.forEach((h) => {
      byDate[d].actions[h] = [...(cartDay.actions[h] || []), ...(flowDay.actions[h] || [])];
    });
    byDate[d].series = [...(cartDay.series || []), ...(flowDay.series || [])];
  });
  return { dates, byDate };
}
