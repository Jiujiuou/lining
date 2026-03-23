/** 看板月历：日期解析与格子生成（单日 / 多选共用） */

export function ymdParts(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, m0: m - 1, d };
}

export function weekdayFirstOfMonth(y, m0) {
  return new Date(y, m0, 1).getDay();
}

export function daysInMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}

/**
 * @param {{ y: number, m0: number }} calView
 * @param {Set<string>} dataSet 圆点：有数据日
 * @param {{
 *   mode: 'single';
 *   value: string;
 * } | {
 *   mode: 'multi';
 *   selectedSet: Set<string>;
 *   allowedSet: Set<string>;
 * }} selection
 */
export function buildCalendarCells(calView, dataSet, selection) {
  const { y: calYear, m0: calMonth0 } = calView;
  const firstWd = weekdayFirstOfMonth(calYear, calMonth0);
  const dim = daysInMonth(calYear, calMonth0);
  const pad = (firstWd + 6) % 7;
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push({ type: "pad" });
  for (let d = 1; d <= dim; d++) {
    const mm = String(calMonth0 + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const ymd = `${calYear}-${mm}-${dd}`;
    let isSelected = false;
    let disabled = false;
    if (selection.mode === "single") {
      isSelected = selection.value === ymd;
    } else {
      isSelected = selection.selectedSet.has(ymd);
      disabled = !selection.allowedSet.has(ymd);
    }
    cells.push({
      type: "day",
      ymd,
      hasData: dataSet.has(ymd),
      isSelected,
      disabled,
    });
  }
  return cells;
}
