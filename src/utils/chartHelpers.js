export const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

/** 多日对比时每条线的颜色（与 accent 协调、可区分） */
export const SERIES_COLORS = ['#0d9488', '#475569', '#b45309', '#0e7490', '#4b5563'];

/**
 * 将 values 转为 Recharts 所需 data 数组，含 null 的点以便断线
 */
export function getChartData(values) {
  return HOURS.map((hour) => ({ hour, value: values[hour] ?? null }));
}

/**
 * 多日合并 data：每行 { hour, [date]: value, ... }，供多条 Line 使用
 */
export function getChartDataMulti(seriesItems) {
  return HOURS.map((hour) => {
    const row = { hour };
    seriesItems.forEach((s) => {
      row[s.date] = s.values[hour] ?? null;
    });
    return row;
  });
}

/**
 * 计算 Y 轴 domain：率类 0～max 留边，非率类 min～max 留边
 */
export function getYDomain(seriesItem) {
  const vals = Object.values(seriesItem.values).filter((v) => v != null && Number.isFinite(v));
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
 * 多日 Y 轴 domain：合并所有 series 的数值
 */
export function getYDomainMulti(seriesItems, isRate) {
  const vals = [];
  seriesItems.forEach((s) => {
    Object.values(s.values).filter((v) => v != null && Number.isFinite(v)).forEach((v) => vals.push(v));
  });
  if (vals.length === 0) return [0, 10];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (isRate) return [0, max * 1.1];
  const span = max - min || 1;
  return [min - span * 0.05, max + span * 0.05];
}

/**
 * 格式化纵轴刻度：率类显示为百分比
 */
export function formatYTick(value, isRate) {
  if (isRate) return `${(Number(value) * 100).toFixed(0)}%`;
  return Number.isInteger(value) ? value : value.toFixed(1);
}
