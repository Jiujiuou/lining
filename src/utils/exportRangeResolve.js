/**
 * 导出表格：根据视图状态与弹窗选项解析 Supabase 查询区间与可选行过滤（非连续日期等）
 */

/** 快捷导出：可选「近 N 天」天数（与弹窗按钮一致） */
export const QUICK_EXPORT_DAY_OPTIONS = [
  3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180,
];

/**
 * 与 App 看板 header 中 selectedDates 一致
 * @param {{
 *   viewMode: string,
 *   selectedDate: string | null,
 *   selectedDatesPick: string[],
 *   rangeDays: number,
 *   datesForSelection: string[],
 * }} p
 * @returns {string[]}
 */
export function getDashboardSelectedDates(p) {
  const {
    viewMode,
    selectedDate,
    selectedDatesPick,
    rangeDays,
    datesForSelection,
  } = p;
  const firstDate = datesForSelection[0];
  let selectedDates = [];
  if (viewMode === "single") {
    selectedDates = selectedDate
      ? [selectedDate]
      : firstDate
        ? [firstDate]
        : [];
  } else if (viewMode === "multiRange") {
    const base =
      selectedDate ?? datesForSelection[datesForSelection.length - 1];
    if (base) {
      const i = datesForSelection.indexOf(base);
      if (i >= 0) {
        const start = Math.max(0, i - rangeDays + 1);
        selectedDates = datesForSelection.slice(start, i + 1);
      } else {
        selectedDates = datesForSelection.slice(-rangeDays);
      }
    }
  } else if (viewMode === "multiPick") {
    selectedDates =
      selectedDatesPick.length > 0
        ? [...selectedDatesPick].sort()
        : firstDate
          ? [firstDate]
          : [];
  }
  return selectedDates;
}

export function east8DayBounds(minYmd, maxYmd) {
  return {
    rangeStartStr: `${minYmd}T00:00:00+08:00`,
    rangeEndStr: `${maxYmd}T23:59:59.999+08:00`,
  };
}

/**
 * 是否需要按日历日过滤（视图多选、自定义多选）
 * @param {string[]} datesSorted
 * @returns {boolean}
 */
export function datesNeedStrictFilter(datesSorted) {
  if (datesSorted.length <= 1) return false;
  for (let i = 1; i < datesSorted.length; i++) {
    const a = datesSorted[i - 1];
    const b = datesSorted[i];
    const da = new Date(a + "T12:00:00+08:00");
    const db = new Date(b + "T12:00:00+08:00");
    const diffDays = Math.round((db - da) / (24 * 60 * 60 * 1000));
    if (diffDays !== 1) return true;
  }
  return false;
}

/**
 * @param {{
 *   type: 'view',
 * } | {
 *   type: 'customRange',
 *   start: string,
 *   end: string,
 * } | {
 *   type: 'customPick',
 *   dates: string[],
 * } | {
 *   type: 'month',
 *   month: string,
 * } | {
 *   type: 'quick',
 *   days: number,
 * }} raw
 * @param {{
 *   getTodayEast8: () => string,
 *   selectedDate: string | null,
 *   datesForSelection: string[],
 *   viewMode: string,
 *   selectedDatesPick: string[],
 *   rangeDays: number,
 * }} ctx
 * @returns {{ ok: true, rangeStartStr: string, rangeEndStr: string, fileSuffix: string, filterDates: Set<string>|null } | { ok: false, error: string }}
 */
export function resolveExportPlan(raw, ctx) {
  const {
    getTodayEast8,
    selectedDate,
    datesForSelection,
    viewMode,
    selectedDatesPick,
    rangeDays,
  } = ctx;
  const anchor =
    selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
      ? selectedDate
      : getTodayEast8();

  if (raw.type === "view") {
    const viewDates = getDashboardSelectedDates({
      viewMode,
      selectedDate,
      selectedDatesPick,
      rangeDays,
      datesForSelection,
    });
    if (viewDates.length === 0) {
      return { ok: false, error: "当前视图没有可用日期，请先选择日期或切换视图。" };
    }
    const sorted = [...viewDates].sort();
    const { rangeStartStr, rangeEndStr } = east8DayBounds(
      sorted[0],
      sorted[sorted.length - 1],
    );
    let filterDates = null;
    if (datesNeedStrictFilter(sorted)) {
      filterDates = new Set(sorted);
    }
    const fileSuffix =
      sorted.length === 1
        ? sorted[0]
        : `${sorted[0]}_至_${sorted[sorted.length - 1]}`;
    return {
      ok: true,
      rangeStartStr,
      rangeEndStr,
      fileSuffix,
      filterDates,
    };
  }

  if (raw.type === "customRange") {
    const a = raw.start;
    const b = raw.end;
    if (!a || !b || !/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
      return { ok: false, error: "请选择有效的起止日期。" };
    }
    if (a > b) {
      return { ok: false, error: "开始日期不能晚于结束日期。" };
    }
    const { rangeStartStr, rangeEndStr } = east8DayBounds(a, b);
    return {
      ok: true,
      rangeStartStr,
      rangeEndStr,
      fileSuffix: `${a}_至_${b}`,
      filterDates: null,
    };
  }

  if (raw.type === "customPick") {
    const dates = [...new Set(raw.dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
    if (dates.length === 0) {
      return { ok: false, error: "请至少选择一天。" };
    }
    const { rangeStartStr, rangeEndStr } = east8DayBounds(
      dates[0],
      dates[dates.length - 1],
    );
    const filterDates = datesNeedStrictFilter(dates) ? new Set(dates) : null;
    const fileSuffix =
      dates.length === 1
        ? dates[0]
        : `多选${dates.length}天_${dates[0]}_${dates[dates.length - 1]}`;
    return {
      ok: true,
      rangeStartStr,
      rangeEndStr,
      fileSuffix,
      filterDates,
    };
  }

  if (raw.type === "month") {
    const m = String(raw.month || "").trim();
    const match = /^(\d{4})-(\d{2})$/.exec(m);
    if (!match) {
      return { ok: false, error: "请选择年月。" };
    }
    const y = Number(match[1]);
    const mo = Number(match[2]);
    if (mo < 1 || mo > 12) {
      return { ok: false, error: "月份无效。" };
    }
    const lastDay = new Date(y, mo, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");
    const monthStart = `${y}-${pad(mo)}-01`;
    const monthEnd = `${y}-${pad(mo)}-${pad(lastDay)}`;
    const { rangeStartStr, rangeEndStr } = east8DayBounds(monthStart, monthEnd);
    return {
      ok: true,
      rangeStartStr,
      rangeEndStr,
      fileSuffix: `${y}年${mo}月`,
      filterDates: null,
    };
  }

  if (raw.type === "quick") {
    const n = Number(raw.days);
    if (!Number.isInteger(n) || !QUICK_EXPORT_DAY_OPTIONS.includes(n)) {
      return { ok: false, error: "快捷天数无效。" };
    }
    const end = new Date(anchor + "T12:00:00+08:00");
    const start = new Date(end);
    start.setDate(start.getDate() - (n - 1));
    const startStr = start.toLocaleDateString("sv-SE", {
      timeZone: "Asia/Shanghai",
    });
    const endStr = anchor;
    const { rangeStartStr, rangeEndStr } = east8DayBounds(startStr, endStr);
    return {
      ok: true,
      rangeStartStr,
      rangeEndStr,
      fileSuffix: `近${n}天_${startStr}_${endStr}`,
      filterDates: null,
    };
  }

  return { ok: false, error: "未知的导出类型。" };
}

export function safeExportFileSuffix(s) {
  return String(s).replace(/[/\\?%*:|"<>]/g, "-");
}
