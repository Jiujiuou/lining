import { useState, useEffect, useRef } from "react";

const MONTH_LABELS = [
  "1 月",
  "2 月",
  "3 月",
  "4 月",
  "5 月",
  "6 月",
  "7 月",
  "8 月",
  "9 月",
  "10 月",
  "11 月",
  "12 月",
];

/**
 * 仅选年月（YYYY-MM），弹层与 Dashboard 月历同一套样式（无系统 month 控件）
 * @param {{ value: string, onChange: (ym: string) => void, getTodayYmd: () => string, label?: string }} props
 */
export default function DashboardYearMonthPicker({
  value,
  onChange,
  getTodayYmd,
  label = "年月",
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const parsed =
    value && /^\d{4}-\d{2}$/.test(value)
      ? {
          y: Number(value.slice(0, 4)),
          m: Number(value.slice(5, 7)),
        }
      : null;

  const today = getTodayYmd();
  const fallbackY = today && /^\d{4}-\d{2}-\d{2}$/.test(today)
    ? Number(today.slice(0, 4))
    : new Date().getFullYear();

  const [year, setYear] = useState(() => parsed?.y ?? fallbackY);

  useEffect(() => {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      setYear(Number(value.slice(0, 4)));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectMonth = (m) => {
    const mm = String(m).padStart(2, "0");
    onChange(`${year}-${mm}`);
    setOpen(false);
  };

  const triggerLabel = parsed
    ? `${parsed.y} 年 ${parsed.m} 月`
    : "选择年月";

  return (
    <div className="dashboard-year-month-picker">
      <div className="dashboard-date-label dashboard-cal-inline">
        <span>{label}</span>
        <div className="dashboard-cal-anchor" ref={wrapRef}>
          <button
            type="button"
            className="dashboard-date-select dashboard-cal-trigger"
            onClick={() =>
              setOpen((o) => {
                const next = !o;
                if (next && parsed) setYear(parsed.y);
                return next;
              })
            }
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            {triggerLabel}
          </button>
          {open && (
            <div
              className="dashboard-cal-popover dashboard-cal-popover--year-month"
              role="dialog"
              aria-label="选择年月"
            >
              <div className="dashboard-cal-head">
                <button
                  type="button"
                  className="dashboard-cal-nav"
                  onClick={() => setYear((y) => y - 1)}
                  aria-label="上一年"
                >
                  ‹
                </button>
                <span className="dashboard-cal-title">{year} 年</span>
                <button
                  type="button"
                  className="dashboard-cal-nav"
                  onClick={() => setYear((y) => y + 1)}
                  aria-label="下一年"
                >
                  ›
                </button>
              </div>
              <div className="dashboard-cal-month-grid">
                {MONTH_LABELS.map((text, i) => {
                  const m = i + 1;
                  const selected =
                    parsed && parsed.y === year && parsed.m === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={
                        "dashboard-cal-month-cell" +
                        (selected ? " dashboard-cal-month-cell--selected" : "")
                      }
                      onClick={() => selectMonth(m)}
                    >
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
