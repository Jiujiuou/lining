import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ymdParts, buildCalendarCells } from "../lib/dashboardCalendarUtils";
import DashboardCalendarPopover from "./DashboardCalendarPopover";

/**
 * 多日自选：月历多选（仅可切换 datesWithData 中的日期；圆点同单日）
 * @param {{
 *   value: string[],
 *   onChange: (next: string[]) => void,
 *   datesWithData: string[],
 *   getTodayYmd: () => string,
 * }} props
 */
export default function DashboardMultiDatePicker({
  value = [],
  onChange,
  datesWithData,
  getTodayYmd,
}) {
  const datesFingerprint = Array.isArray(datesWithData)
    ? [...datesWithData].sort().join("|")
    : "";

  const dataSet = useMemo(() => {
    if (!datesFingerprint) return new Set();
    return new Set(datesFingerprint.split("|").filter(Boolean));
  }, [datesFingerprint]);

  const allowedSet = useMemo(() => {
    if (!datesFingerprint) return new Set();
    return new Set(datesFingerprint.split("|").filter(Boolean));
  }, [datesFingerprint]);

  const selectedSet = useMemo(
    () => new Set(value.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))),
    [value],
  );

  const [calOpen, setCalOpen] = useState(false);
  const calWrapRef = useRef(null);
  const anchorYmd =
    value.length > 0
      ? [...value].sort().slice(-1)[0]
      : getTodayYmd();
  const visibleYmd =
    anchorYmd && /^\d{4}-\d{2}-\d{2}$/.test(anchorYmd)
      ? anchorYmd
      : getTodayYmd();
  const [calView, setCalView] = useState(() => {
    const { y, m0 } = ymdParts(visibleYmd);
    return { y, m0 };
  });

  useEffect(() => {
    if (!calOpen) return;
    const onDoc = (e) => {
      if (calWrapRef.current && !calWrapRef.current.contains(e.target))
        setCalOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [calOpen]);

  const goMonth = useCallback((delta) => {
    setCalView(({ y, m0 }) => {
      let next = m0 + delta;
      let yy = y;
      while (next < 0) {
        next += 12;
        yy -= 1;
      }
      while (next > 11) {
        next -= 12;
        yy += 1;
      }
      return { y: yy, m0: next };
    });
  }, []);

  const calendarCells = useMemo(
    () =>
      buildCalendarCells(calView, dataSet, {
        mode: "multi",
        selectedSet,
        allowedSet,
      }),
    [calView, dataSet, selectedSet, allowedSet],
  );

  const toggleYmd = useCallback(
    (ymd) => {
      if (!allowedSet.has(ymd)) return;
      const next = value.includes(ymd)
        ? value.filter((x) => x !== ymd)
        : [...value, ymd].sort();
      onChange(next);
    },
    [allowedSet, value, onChange],
  );

  const label =
    value.length > 0 ? `选日期（${value.length} 天）` : "选日期";

  return (
    <div className="dashboard-multi-date-picker">
      <div className="dashboard-date-label dashboard-cal-inline">
        <span>日期</span>
        <div className="dashboard-cal-anchor" ref={calWrapRef}>
          <button
            type="button"
            className="dashboard-date-select dashboard-cal-trigger"
            onClick={() => {
              setCalOpen((o) => {
                const next = !o;
                if (next) {
                  const { y, m0 } = ymdParts(visibleYmd);
                  setCalView({ y, m0 });
                }
                return next;
              });
            }}
            aria-expanded={calOpen}
            aria-haspopup="dialog"
          >
            {label}
          </button>
          {calOpen && (
            <DashboardCalendarPopover
              calView={calView}
              goMonth={goMonth}
              cells={calendarCells}
              onDayClick={toggleYmd}
              hint="点击日期多选或取消；仅可选列表中有数据的日期。圆点表示该日有数据。"
              dialogAriaLabel="自选多个日期"
            />
          )}
        </div>
      </div>
    </div>
  );
}
