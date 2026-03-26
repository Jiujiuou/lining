import { useEffect, useState, useCallback, useMemo } from "react";
import { HiXMark } from "react-icons/hi2";
import DashboardMultiDatePicker from "./DashboardMultiDatePicker";
import DashboardSingleDatePicker from "./DashboardSingleDatePicker";
import DashboardYearMonthPicker from "./DashboardYearMonthPicker";
import {
  QUICK_EXPORT_DAY_OPTIONS,
  getDashboardSelectedDates,
} from "../utils/exportRangeResolve";
import "./ExportTableModal.css";

function formatYmdForPreview(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   exporting: boolean,
 *   onConfirm: (raw: {
 *     type: 'view',
 *   } | {
 *     type: 'customRange',
 *     start: string,
 *     end: string,
 *   } | {
 *     type: 'customPick',
 *     dates: string[],
 *   } | {
 *     type: 'month',
 *     month: string,
 *   } | {
 *     type: 'quick',
 *     days: number,
 *   }) => void,
 *   getTodayEast8: () => string,
 *   viewMode: string,
 *   rangeDays: number,
 *   selectedDate: string | null,
 *   selectedDatesPick: string[],
 *   datesForSelection: string[],
 * }} props
 */
export default function ExportTableModal({
  isOpen,
  onClose,
  exporting,
  onConfirm,
  getTodayEast8,
  viewMode,
  rangeDays,
  selectedDate,
  selectedDatesPick,
  datesForSelection,
}) {
  const [main, setMain] = useState("view");
  const [customSub, setCustomSub] = useState("range");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [pickDates, setPickDates] = useState([]);
  const [monthVal, setMonthVal] = useState("");
  const [quickDays, setQuickDays] = useState(7);

  const syncFromProps = useCallback(() => {
    const today = getTodayEast8();
    const anchor =
      selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
        ? selectedDate
        : today;
    setRangeStart(anchor);
    setRangeEnd(anchor);
    setPickDates(
      selectedDatesPick.length > 0
        ? [...selectedDatesPick]
        : anchor
          ? [anchor]
          : [],
    );
    setMonthVal(anchor.slice(0, 7));
    setQuickDays(7);
    setMain("view");
    setCustomSub("range");
  }, [getTodayEast8, selectedDate, selectedDatesPick]);

  useEffect(() => {
    if (isOpen) syncFromProps();
  }, [isOpen, syncFromProps]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const viewExportDates = useMemo(
    () =>
      getDashboardSelectedDates({
        viewMode,
        selectedDate,
        selectedDatesPick,
        rangeDays,
        datesForSelection,
      }),
    [viewMode, selectedDate, selectedDatesPick, rangeDays, datesForSelection],
  );

  if (!isOpen) return null;

  const anchor =
    selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
      ? selectedDate
      : getTodayEast8();

  const handlePrimary = () => {
    if (main === "view") {
      onConfirm({ type: "view" });
      return;
    }
    if (main === "custom") {
      if (customSub === "range") {
        onConfirm({
          type: "customRange",
          start: rangeStart,
          end: rangeEnd,
        });
        return;
      }
      onConfirm({ type: "customPick", dates: pickDates });
      return;
    }
    if (main === "month") {
      onConfirm({ type: "month", month: monthVal });
      return;
    }
    onConfirm({ type: "quick", days: quickDays });
  };

  return (
    <div
      className="export-modal-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && !exporting && onClose()}
    >
      <div
        className="export-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="导出数据"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="export-modal-header">
          <div
            className="export-modal-segments export-modal-segments--header"
            role="group"
            aria-label="导出范围"
          >
            <button
              type="button"
              className={`export-modal-segment ${main === "view" ? "export-modal-segment--active" : ""}`}
              onClick={() => setMain("view")}
            >
              与当前视图一致
            </button>
            <button
              type="button"
              className={`export-modal-segment ${main === "custom" ? "export-modal-segment--active" : ""}`}
              onClick={() => setMain("custom")}
            >
              自定义日期
            </button>
            <button
              type="button"
              className={`export-modal-segment ${main === "month" ? "export-modal-segment--active" : ""}`}
              onClick={() => setMain("month")}
            >
              按月
            </button>
            <button
              type="button"
              className={`export-modal-segment ${main === "quick" ? "export-modal-segment--active" : ""}`}
              onClick={() => setMain("quick")}
            >
              快捷天数
            </button>
          </div>
          <div className="export-modal-header-tail">
            <button
              type="button"
              className="export-modal-btn export-modal-btn--primary"
              onClick={handlePrimary}
              disabled={exporting}
            >
              {exporting ? "导出中…" : "开始导出数据"}
            </button>
            <button
              type="button"
              className="export-modal-close"
              aria-label="关闭"
              onClick={() => !exporting && onClose()}
              disabled={exporting}
            >
              <HiXMark size={22} aria-hidden />
            </button>
          </div>
        </div>

        <div className="export-modal-body">
          {main === "view" && (
            <div className="export-modal-section">
              <p className="export-modal-hint">与页头所选日期一致。</p>
              {viewExportDates.length > 0 ? (
                <div
                  className="export-modal-date-preview"
                  role="status"
                  aria-label="将导出的日期预览"
                >
                  <span className="export-modal-date-preview-label">
                    已选日期预览（共 {viewExportDates.length} 天）
                  </span>
                  <ul className="export-modal-date-preview-tags">
                    {viewExportDates.map((d) => (
                      <li key={d}>
                        <span className="export-modal-date-preview-tag">
                          <time dateTime={d}>{formatYmdForPreview(d)}</time>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="export-modal-hint export-modal-hint--empty">
                  页头暂无可用日期，请先选择日期后再导出。
                </p>
              )}
            </div>
          )}

          {main === "custom" && (
            <div className="export-modal-section">
              <span className="export-modal-section-label">自定义方式</span>
              <div className="export-modal-subsegments">
                <button
                  type="button"
                  className={`export-modal-subsegment ${customSub === "range" ? "export-modal-subsegment--active" : ""}`}
                  onClick={() => setCustomSub("range")}
                >
                  起止区间
                </button>
                <button
                  type="button"
                  className={`export-modal-subsegment ${customSub === "pick" ? "export-modal-subsegment--active" : ""}`}
                  onClick={() => setCustomSub("pick")}
                >
                  多选日期
                </button>
              </div>
              {customSub === "range" && (
                <div className="export-modal-picker-row">
                  <DashboardSingleDatePicker
                    label="开始"
                    value={rangeStart}
                    onSelectDate={setRangeStart}
                    datesWithData={datesForSelection}
                    getTodayYmd={getTodayEast8}
                    calendarHint="圆点表示当前列表中有数据的日期；任意日期均可点选。"
                  />
                  <DashboardSingleDatePicker
                    label="结束"
                    value={rangeEnd}
                    onSelectDate={setRangeEnd}
                    datesWithData={datesForSelection}
                    getTodayYmd={getTodayEast8}
                    calendarHint="圆点表示当前列表中有数据的日期；任意日期均可点选。"
                  />
                </div>
              )}
              {customSub === "pick" && (
                <div className="export-modal-multi-wrap">
                  <DashboardMultiDatePicker
                    value={pickDates}
                    onChange={setPickDates}
                    datesWithData={datesForSelection}
                    getTodayYmd={getTodayEast8}
                  />
                </div>
              )}
            </div>
          )}

          {main === "month" && (
            <div className="export-modal-section">
              <div className="export-modal-picker-row export-modal-picker-row--month">
                <DashboardYearMonthPicker
                  label="年月"
                  value={monthVal}
                  onChange={setMonthVal}
                  getTodayYmd={getTodayEast8}
                />
              </div>
            </div>
          )}

          {main === "quick" && (
            <div className="export-modal-section">
              <span className="export-modal-section-label">最近 N 天</span>
              <div className="export-modal-quick-grid">
                {QUICK_EXPORT_DAY_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`export-modal-quick-btn ${quickDays === n ? "export-modal-quick-btn--active" : ""}`}
                    onClick={() => setQuickDays(n)}
                  >
                    近 {n} 天
                  </button>
                ))}
              </div>
              <p className="export-modal-quick-anchor">
                结束日为当前选中日期（{anchor}
                ）；若需以今天为结束，请先在页头选中今日。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
