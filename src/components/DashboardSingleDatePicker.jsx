import { useState, useEffect, useRef, useMemo, useCallback } from "react";

function ymdParts(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, m0: m - 1, d };
}

function weekdayFirstOfMonth(y, m0) {
  return new Date(y, m0, 1).getDay();
}

function daysInMonth(y, m0) {
  return new Date(y, m0 + 1, 0).getDate();
}

/**
 * 单日日期：月历弹层（有数据日圆点标记）
 * @param {{ value: string, datesWithData: string[], onSelectDate: (ymd: string) => void, getTodayYmd: () => string }} props
 */
export default function DashboardSingleDatePicker({
  value,
  datesWithData,
  onSelectDate,
  getTodayYmd,
}) {
  const datesFingerprint = Array.isArray(datesWithData)
    ? [...datesWithData].sort().join("|")
    : "";

  /** 仅依赖内容签名，切换商品后「有数据日」变化时圆点必刷新 */
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

  const calendarCells = useMemo(() => {
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
      cells.push({
        type: "day",
        ymd,
        hasData: dataSet.has(ymd),
        isSelected: value === ymd,
      });
    }
    return cells;
  }, [calView, dataSet, value]);

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

  return (
    <div className="dashboard-single-date-picker">
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
            {value || "选择日期"}
          </button>
          {calOpen && (
            <div
              className="dashboard-cal-popover"
              role="dialog"
              aria-label="选择日期"
            >
              <div className="dashboard-cal-head">
                <button
                  type="button"
                  className="dashboard-cal-nav"
                  onClick={() => goMonth(-1)}
                  aria-label="上一月"
                >
                  ‹
                </button>
                <span className="dashboard-cal-title">
                  {calView.y} 年 {calView.m0 + 1} 月
                </span>
                <button
                  type="button"
                  className="dashboard-cal-nav"
                  onClick={() => goMonth(1)}
                  aria-label="下一月"
                >
                  ›
                </button>
              </div>
              <div className="dashboard-cal-weekdays">
                {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
                  <span key={w} className="dashboard-cal-wd">
                    {w}
                  </span>
                ))}
              </div>
              <div className="dashboard-cal-grid">
                {calendarCells.map((cell, idx) => {
                  if (cell.type === "pad")
                    return (
                      <span
                        key={`p-${idx}`}
                        className="dashboard-cal-cell dashboard-cal-cell--empty"
                      />
                    );
                  const { ymd, hasData, isSelected } = cell;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      className={
                        "dashboard-cal-cell" +
                        (isSelected ? " dashboard-cal-cell--selected" : "") +
                        (hasData ? " dashboard-cal-cell--has-data" : "")
                      }
                      onClick={() => {
                        onSelectDate(ymd);
                        setCalOpen(false);
                      }}
                    >
                      <span className="dashboard-cal-cell-num">
                        {Number(ymd.slice(8))}
                      </span>
                      {hasData ? (
                        <span className="dashboard-cal-cell-dot" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="dashboard-cal-hint">圆点表示当前视图下该日有数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
