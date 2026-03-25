import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ymdParts, buildCalendarCells } from "../lib/dashboardCalendarUtils";
import DashboardCalendarPopover from "./DashboardCalendarPopover";

/**
 * 单日日期：月历弹层（有数据日圆点标记）
 * @param {{ value: string, datesWithData: string[], onSelectDate: (ymd: string) => void, getTodayYmd: () => string, label?: string, calendarHint?: string }} props
 */
export default function DashboardSingleDatePicker({
  value,
  datesWithData,
  onSelectDate,
  getTodayYmd,
  label = "日期",
  calendarHint = "圆点表示当前视图下该日有数据",
}) {
  const datesFingerprint = Array.isArray(datesWithData)
    ? [...datesWithData].sort().join("|")
    : "";

  const dataSet = useMemo(() => {
    if (!datesFingerprint) return new Set();
    return new Set(datesFingerprint.split("|").filter(Boolean));
  }, [datesFingerprint]);

  const [calOpen, setCalOpen] = useState(false);
  const calWrapRef = useRef(null);
  const visibleYmd =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getTodayYmd();
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
        mode: "single",
        value: value || "",
      }),
    [calView, dataSet, value],
  );

  return (
    <div className="dashboard-single-date-picker">
      <div className="dashboard-date-label dashboard-cal-inline">
        <span>{label}</span>
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
            {value || "选择日期"}
          </button>
          {calOpen && (
            <DashboardCalendarPopover
              calView={calView}
              goMonth={goMonth}
              cells={calendarCells}
              onDayClick={(ymd) => {
                onSelectDate(ymd);
                setCalOpen(false);
              }}
              hint={calendarHint}
            />
          )}
        </div>
      </div>
    </div>
  );
}
