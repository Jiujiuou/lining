export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

/** 20 分钟槽位：46 个，9:00～24:00；用于流量来源等与加购/排名对齐 */
export const SLOT_COUNT = 46;
const SLOT_MINUTES = 20;
export const SLOT_HOURS = Array.from({ length: SLOT_COUNT }, (_, i) => 9 + (i * SLOT_MINUTES) / 60);
export const SLOT_LABELS = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const m = i * SLOT_MINUTES;
  const h = 9 + Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
});

/** 多日对比时每条线的颜色（与 accent 协调、可区分） */
export const SERIES_COLORS = ['#0d9488', '#475569', '#b45309', '#0e7490', '#4b5563'];

/**
 * 将 values 转为 Recharts 所需 data 数组，含 null 的点以便断线
 */
export function getChartData(values) {
  const v = values && typeof values === 'object' ? values : {};
  return HOURS.map((hour) => ({ hour, value: v[hour] ?? null }));
}

/**
 * 将 46 槽位聚合为按小时 values（9～24），与横轴「X点」统一
 * 每小时取该小时最后一个槽位的值（9 点取 slot 2，10 点取 slot 5，…，24 点取 slot 45）
 */
export function slotValuesToHourlyValues(slotValues) {
  if (!Array.isArray(slotValues) || slotValues.length < SLOT_COUNT) return {};
  const values = {};
  HOURS.forEach((hour) => {
    const slotIndex = hour < 24 ? (hour - 9) * 3 + 2 : SLOT_COUNT - 1;
    values[hour] = slotValues[slotIndex] ?? null;
  });
  return values;
}

/**
 * 将 46 槽位数组转为与 getCartLog20MinPointsForDate 一致的 data，供流量来源等 20 分钟点图使用
 * @param {Array<number|null>} slotValues 长度 46
 * @returns {Array<{ x: number, time: string, value: number|null }>}
 */
export function getChartDataFromSlots(slotValues) {
  if (!Array.isArray(slotValues)) return [];
  return Array.from({ length: SLOT_COUNT }, (_, i) => ({
    x: SLOT_HOURS[i],
    time: SLOT_LABELS[i],
    value: slotValues[i] ?? null,
  }));
}

/**
 * 从 slotValues 计算 Y 轴 domain（率类 / 非率类）
 */
export function getYDomainFromSlotValues(slotValues, isRate) {
  if (!Array.isArray(slotValues)) return [0, 10];
  const vals = slotValues.filter((v) => v != null && Number.isFinite(v));
  if (vals.length === 0) return [0, 10];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (isRate) return [0, max * 1.1];
  const span = max - min || 1;
  return [min - span * 0.05, max + span * 0.05];
}

/**
 * 多日合并 data：每行 { hour, [date]: value, ... }，供多条 Line 使用
 */
export function getChartDataMulti(seriesItems) {
  return HOURS.map((hour) => {
    const row = { hour };
    seriesItems.forEach((s) => {
      row[s.date] = s.values?.[hour] ?? null;
    });
    return row;
  });
}

/**
 * 多日 46 槽位合并 data：每行 { x, time, [date]: value, ... }，供多条 Line 使用
 */
export function getChartDataMultiSlots(seriesItems) {
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const row = { x: SLOT_HOURS[i], time: SLOT_LABELS[i] };
    seriesItems.forEach((s) => {
      row[s.date] = Array.isArray(s.slotValues) ? (s.slotValues[i] ?? null) : null;
    });
    return row;
  });
}

/**
 * 计算 Y 轴 domain：率类 0～max 留边，非率类 min～max 留边
 */
export function getYDomain(seriesItem) {
  const vals = Object.values(seriesItem?.values ?? {}).filter((v) => v != null && Number.isFinite(v));
  if (vals.length === 0) return [0, 10];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (seriesItem.isRate) {
    return [0, max * 1.1];
  }
  const span = max - min || 1;
  return [min - span * 0.05, max + span * 0.05];
}

/**
 * 多日 Y 轴 domain：合并所有 series 的数值（支持 values 或 slotValues）
 */
export function getYDomainMulti(seriesItems, isRate) {
  const vals = [];
  seriesItems.forEach((s) => {
    if (Array.isArray(s.slotValues)) {
      s.slotValues.filter((v) => v != null && Number.isFinite(v)).forEach((v) => vals.push(v));
    } else if (s.values) {
      Object.values(s.values).filter((v) => v != null && Number.isFinite(v)).forEach((v) => vals.push(v));
    }
  });
  if (vals.length === 0) return [0, 10];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (isRate) return [0, max * 1.1];
  const span = max - min || 1;
  return [min - span * 0.05, max + span * 0.05];
}

/** 转化率展示：×100，一位小数，.0 不展示（如 25%、25.1%） */
export function formatRate(value) {
  const s = (Number(value) * 100).toFixed(1);
  const trimmed = s.endsWith('.0') ? s.slice(0, -2) : s;
  return `${trimmed}%`;
}

/**
 * 格式化纵轴刻度：率类显示为百分比
 */
export function formatYTick(value, isRate) {
  if (isRate) return formatRate(value);
  return Number.isInteger(value) ? value : value.toFixed(1);
}

/**
 * 当日汇总值：优先 24 点，否则取有数据整点的平均值。
 * 若传入 slotValues（46 槽位数组），则取最后一槽（24 点）或非空槽的平均值。
 */
export function getDayAggregate(valuesOrSlotValues) {
  if (Array.isArray(valuesOrSlotValues)) {
    const arr = valuesOrSlotValues;
    if (arr[SLOT_COUNT - 1] != null && Number.isFinite(arr[SLOT_COUNT - 1])) return arr[SLOT_COUNT - 1];
    const vals = arr.filter((v) => v != null && Number.isFinite(v));
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const values = valuesOrSlotValues;
  if (values[24] != null && Number.isFinite(values[24])) return values[24];
  const vals = Object.values(values).filter((v) => v != null && Number.isFinite(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * 按日趋势 data：dates 内每个日期的该指标汇总值 → [{ date, value }]
 */
export function getTrendData(byDate, dates, category, subCategory, isRate) {
  return dates.map((date) => {
    const day = byDate[date];
    const s = day?.series?.find((x) => x.category === category && x.subCategory === subCategory);
    const value = s ? getDayAggregate(s.slotValues ?? s.values) : null;
    return { date, value };
  });
}

/**
 * 趋势图 Y 轴 domain
 */
export function getTrendYDomain(data, isRate) {
  const vals = data.map((d) => d.value).filter((v) => v != null && Number.isFinite(v));
  if (vals.length === 0) return [0, 10];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (isRate) return [0, max * 1.1];
  const span = max - min || 1;
  return [min - span * 0.05, max + span * 0.05];
}
