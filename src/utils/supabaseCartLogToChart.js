/**
 * 将 sycm_cart_log 表数据转为与 parseWorkbook 一致的结构，用于图表展示。
 * 表字段：item_cart_cnt, created_at (timestamptz/ISO 或东八区 "YYYY-MM-DD:HH:mm:ss")，兼容 recorded_at
 * 指标名：商品加购件数；时间轴：9～24 点。
 */

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

/** 规范为 YYYY-MM-DD，避免日期选择出现 2026-02-16T04 等格式 */
function toDateOnly(s) {
  if (s == null || typeof s !== 'string') return null;
  const m = String(s).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** 判断是否为 ISO 时间（Supabase 返回的 UTC 等），需按东八区解析日期 */
function isISOStamp(s) {
  if (typeof s !== 'string' || s.length < 16) return false;
  return s.includes('T') && (s.includes('Z') || s.includes('+') || /T\d{2}:\d{2}/.test(s));
}

/** 将 ISO 时间解析为东八区日期 YYYY-MM-DD 与 9～24 点的小时 */
function parseISOToEast8DateAndHour(isoStr) {
  const d = new Date(isoStr.trim());
  if (Number.isNaN(d.getTime())) return null;
  const dateStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
  let h = 0, m = 0;
  parts.forEach((p) => { if (p.type === 'hour') h = parseInt(p.value, 10); if (p.type === 'minute') m = parseInt(p.value, 10); });
  if (h === 0 && m === 0) {
    const prevDate = new Date(d.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
    return { dateStr: prevDate, hour: 24 };
  }
  if (h < 9 || h > 24) return null;
  return { dateStr, hour: h };
}

/**
 * 解析时间字符串 "YYYY-MM-DD:HH:mm:ss" 或 ISO "YYYY-MM-DDTHH:mm:ss" 为 { dateStr, hour }
 * hour 仅取 9～24；UTC 0-8 点转为东八区 +8；0 点视为前一日 24 点。
 * ISO 时按东八区取 dateStr，避免 UTC 日期与界面「今天」不一致。
 */
function parseRecordedAt(recordedAt) {
  if (!recordedAt || typeof recordedAt !== 'string') return null;
  const s = recordedAt.trim();
  if (s.length < 16) return null;
  if (isISOStamp(s)) {
    return parseISOToEast8DateAndHour(s);
  }
  const dateStr = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const sep = s[10];
  const timeStart = sep === 'T' || sep === ' ' || sep === ':' ? 11 : 10;
  const timePart = s.slice(timeStart);
  const parts = timePart.split(':');
  let h = parseInt(parts[0], 10) || 0;
  if (h >= 0 && h < 9) h += 8;
  if (h === 0) {
    const prev = new Date(dateStr + 'T00:00:00Z');
    prev.setUTCDate(prev.getUTCDate() - 1);
    return { dateStr: prev.toISOString().slice(0, 10), hour: 24 };
  }
  if (h < 9 || h > 24) return null;
  return { dateStr, hour: h };
}

/**
 * @param {Array<{ item_cart_cnt: number, created_at?: string, recorded_at?: string }>} rows
 * @returns {{ dates: string[], byDate: Record<string, { series: Array<...>, actions: Record<number, string[]> }> }}
 */
export function cartLogRowsToChartData(rows) {
  const byDate = {};
  const dateSet = new Set();

  // (dateStr, hour) -> 保留 recorded_at 最新的一条的 item_cart_cnt
  const keyToLatest = {};
  for (const row of rows || []) {
    const timeStr = row?.created_at ?? row?.recorded_at;
    if (row == null || typeof row.item_cart_cnt === 'undefined' || !timeStr) continue;
    const parsed = parseRecordedAt(timeStr);
    if (!parsed) continue;
    const { dateStr, hour } = parsed;
    const cnt = Number(row.item_cart_cnt);
    if (!Number.isFinite(cnt)) continue;
    const key = `${dateStr}-${hour}`;
    const existing = keyToLatest[key];
    if (!existing || String(timeStr) > String(existing.recorded_at)) {
      keyToLatest[key] = { dateStr, hour, item_cart_cnt: cnt, recorded_at: timeStr };
    }
  }

  for (const entry of Object.values(keyToLatest)) {
    const { dateStr, hour, item_cart_cnt: cnt } = entry;
    const d = toDateOnly(dateStr) || dateStr;
    dateSet.add(d);
    if (!byDate[d]) {
      byDate[d] = { series: [], actions: {}, hourValue: {} };
      HOURS.forEach((h) => {
        byDate[d].actions[h] = [];
      });
    }
    byDate[d].hourValue[hour] = cnt;
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

/** 将 ISO 时间解析为东八区日期与 20 分钟槽位索引 */
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
  const minutesFrom9 = (h - 9) * 60 + m;
  if (minutesFrom9 < 0 || minutesFrom9 > (24 - 9) * 60) return null;
  const slotIndex = Math.min(Math.floor(minutesFrom9 / MINUTES_FROM_9), SLOT_COUNT - 1);
  return { dateStr, slotIndex };
}

/**
 * 解析 recorded_at 为 (dateStr, slotIndex)，与加购/排名 20 分钟槽位一致
 * 支持 "YYYY-MM-DD:HH:mm:ss" 与 Supabase 返回的 ISO "YYYY-MM-DDTHH:mm:ss.sssZ"
 * ISO 时按东八区取 dateStr。
 */
function parseRecordedAtToSlot(recordedAt) {
  if (recordedAt == null) return null;
  const s = typeof recordedAt === 'string' ? recordedAt.trim() : String(recordedAt);
  if (s.length < 16) return null;
  if (isISOStamp(s)) return parseISOToEast8DateAndSlot(s);
  const dateStr = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const sep = s[10];
  const timeStart = sep === 'T' || sep === ' ' || sep === ':' ? 11 : 10;
  const timePart = s.slice(timeStart);
  const parts = timePart.split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  if (h >= 0 && h < 9) h += 8;
  const minutesFrom9 = (h - 9) * 60 + m;
  if (minutesFrom9 < 0 || minutesFrom9 > (24 - 9) * 60) return null;
  const slotIndex = Math.min(Math.floor(minutesFrom9 / MINUTES_FROM_9), SLOT_COUNT - 1);
  return { dateStr, slotIndex };
}

/**
 * 从原始行中取出某日的数据，按 20 分钟一个点聚合（取每段内最新值），用于大图。
 * 横坐标仍用 9～24 整点，数据点用 x=9, 9.333, 9.667, 10... 以便落在整点之间。
 * @param {Array<{ item_cart_cnt: number, created_at?: string, recorded_at?: string }>} rows
 * @param {string} dateStr 如 "2026-02-16"
 * @returns {Array<{ x: number, time: string, value: number }>}
 */
export function getCartLog20MinPointsForDate(rows, dateStr) {
  if (!dateStr || !Array.isArray(rows)) return [];
  const slotToLatest = {};
  for (const row of rows) {
    const r = row.created_at ?? row.recorded_at;
    if (r == null || typeof r !== 'string') continue;
    const parsed = parseRecordedAtToSlot(r);
    if (!parsed || parsed.dateStr !== dateStr) continue;
    const value = Number(row.item_cart_cnt);
    if (!Number.isFinite(value)) continue;
    const { slotIndex } = parsed;
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
 * 按 20 分钟槽位聚合（与加购/排名一致），每槽位保留时间最新的一条，输出 slotValues 供 46 点图使用。
 * @param {Array<{ created_at?: string, recorded_at?: string, search_uv: number, search_pay_rate: number, cart_uv: number, cart_pay_rate: number }>} rows
 * @returns {{ dates: string[], byDate: Record<string, { series: Array<{ ... slotValues }>, actions: Record<number, string[]> }> }}
 */
export function flowSourceRowsToChartData(rows) {
  const byDate = {};
  const dateSet = new Set();
  const keyToLatest = {};

  for (const row of rows || []) {
    const timeStr = row?.created_at ?? row?.recorded_at;
    if (!row || timeStr == null || timeStr === '') continue;
    const parsed = parseRecordedAtToSlot(timeStr);
    if (!parsed) continue;
    const { dateStr, slotIndex } = parsed;
    const key = `${dateStr}-${slotIndex}`;
    const existing = keyToLatest[key];
    if (!existing || String(timeStr) > String(existing.recorded_at)) {
      const num = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
      keyToLatest[key] = {
        dateStr,
        slotIndex,
        search_uv: num(row.search_uv),
        search_pay_rate: num(row.search_pay_rate),
        cart_uv: num(row.cart_uv),
        cart_pay_rate: num(row.cart_pay_rate),
        recorded_at: timeStr,
      };
    }
  }

  for (const entry of Object.values(keyToLatest)) {
    const { dateStr, slotIndex } = entry;
    const d = toDateOnly(dateStr) || dateStr;
    dateSet.add(d);
    if (!byDate[d]) byDate[d] = { series: [], actions: {} };
    if (!byDate[d].slotValue) byDate[d].slotValue = {};
    if (!byDate[d].slotValue[slotIndex]) byDate[d].slotValue[slotIndex] = {};
    FLOW_SERIES.forEach((s) => {
      byDate[d].slotValue[slotIndex][s.key] = entry[s.key];
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
 * 合并加购与流量来源的图表数据：日期取并集（仅 YYYY-MM-DD），按日期合并 series。
 */
export function mergeCartAndFlowChartData(cartData, flowData) {
  if (!cartData || !cartData.dates) return flowData || { dates: [], byDate: {} };
  if (!flowData || !flowData.dates) return cartData;
  const rawDates = [...(cartData.dates || []), ...(flowData.dates || [])].map(toDateOnly).filter(Boolean);
  const dates = [...new Set(rawDates)].sort();
  const byDate = {};
  function mergeDayInto(targetKey, sourceByDate) {
    if (!sourceByDate) return;
    for (const key of Object.keys(sourceByDate)) {
      const n = toDateOnly(key);
      if (n !== targetKey) continue;
      const day = sourceByDate[key];
      if (!byDate[targetKey]) byDate[targetKey] = { series: [], actions: {} };
      HOURS.forEach((h) => {
        byDate[targetKey].actions[h] = [...(byDate[targetKey].actions[h] || []), ...(day.actions?.[h] || [])];
      });
      byDate[targetKey].series = [...(byDate[targetKey].series || []), ...(day.series || [])];
    }
  }
  dates.forEach((d) => {
    mergeDayInto(d, cartData.byDate);
    mergeDayInto(d, flowData.byDate);
  });
  return { dates, byDate };
}
