/**
 * 月历弹层内容：月导航 + 星期行 + 日格子（与 DashboardSingleDatePicker 样式一致）
 */
export default function DashboardCalendarPopover({
  calView,
  goMonth,
  cells,
  onDayClick,
  hint,
  dialogAriaLabel = "选择日期",
}) {
  return (
    <div
      className="dashboard-cal-popover"
      role="dialog"
      aria-label={dialogAriaLabel}
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
        {cells.map((cell, idx) => {
          if (cell.type === "pad")
            return (
              <span
                key={`p-${idx}`}
                className="dashboard-cal-cell dashboard-cal-cell--empty"
              />
            );
          const { ymd, hasData, isSelected, disabled } = cell;
          return (
            <button
              key={ymd}
              type="button"
              disabled={disabled}
              className={
                "dashboard-cal-cell" +
                (isSelected ? " dashboard-cal-cell--selected" : "") +
                (hasData ? " dashboard-cal-cell--has-data" : "") +
                (disabled ? " dashboard-cal-cell--disabled" : "")
              }
              onClick={() => {
                if (!disabled) onDayClick(ymd);
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
      {hint ? <p className="dashboard-cal-hint">{hint}</p> : null}
    </div>
  );
}
