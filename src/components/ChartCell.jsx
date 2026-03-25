import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";
import {
  getChartData,
  getChartDataFromSlots,
  getChartDataMulti,
  getChartDataMultiSlots,
  getYDomain,
  getYDomainFromSlotValues,
  getYDomainMulti,
  formatYTick,
  formatRate,
  HOURS,
  SERIES_COLORS,
} from "../utils/chartHelpers";

function ChartTooltipSingle({ payload, active, actions, note }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const hour = p.hour != null ? p.hour : p.x != null ? Math.floor(p.x) : null;
  const timeLabel = p.time != null ? p.time : hour != null ? hour + " 点" : "";
  const value = payload[0].value;
  const list = actions && hour != null ? actions[hour] || [] : [];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{timeLabel}</div>
      <div className="chart-tooltip-value">
        {value != null ? (p.isRate ? formatRate(value) : value) : "—"}
      </div>
      {note ? (
        <div className="chart-tooltip-note">
          {/* <span className="chart-tooltip-note-label">备注：</span> */}
          {note}
        </div>
      ) : null}
      {list.length > 0 ? (
        <div className="chart-tooltip-actions">
          {list.map((text, i) => (
            <div key={i} className="chart-tooltip-action">
              {text}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChartTooltipMulti({ payload, active, actionsByDate, isRate, note }) {
  if (!active || !payload?.length) return null;
  const p0 = payload[0].payload;
  const hour =
    p0.hour != null ? p0.hour : p0.x != null ? Math.floor(p0.x) : null;
  const timeLabel = p0.time != null ? p0.time : hour != null ? hour + " 点" : "";
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{timeLabel}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey} className="chart-tooltip-row">
            <span className="chart-tooltip-date">{p.dataKey}</span>
            <span className="chart-tooltip-value">
              {isRate ? formatRate(p.value) : p.value}
            </span>
          </div>
        ))}
      {note ? (
        <div className="chart-tooltip-note">
          {/* <span className="chart-tooltip-note-label">备注：</span> */}
          {note}
        </div>
      ) : null}
      {payload.map((p) => {
        const byDate =
          actionsByDate && p.dataKey ? actionsByDate[p.dataKey] : null;
        const list = byDate && hour != null ? byDate[hour] || [] : [];
        return list.length > 0 ? (
          <div key={`actions-${p.dataKey}`} className="chart-tooltip-actions">
            <div className="chart-tooltip-action-label">{p.dataKey}</div>
            {list.map((text, i) => (
              <div key={i} className="chart-tooltip-action">
                {text}
              </div>
            ))}
          </div>
        ) : null;
      })}
    </div>
  );
}

/** 从 payload 得到 point_slot 字符串（小时或槽位时间） */
function getPointSlot(payload) {
  if (payload.hour != null) return String(payload.hour);
  if (payload.time != null) return String(payload.time);
  if (payload.x != null) return String(payload.x);
  return "";
}

function pickNumericX(payload) {
  if (payload.hour != null) return Number(payload.hour);
  if (payload.x != null) return Number(payload.x);
  return NaN;
}

function pickValueFromPayload(payload, isMulti, seriesDate) {
  if (isMulti) {
    const v = payload[seriesDate];
    if (v == null || v === "") return NaN;
    return Number(v);
  }
  if (payload.value == null || payload.value === "") return NaN;
  return Number(payload.value);
}

/** @param {string} timeLabel 展示用时刻文案 */
function buildMeasurePoint(payload, isMulti, seriesDate, timeLabel) {
  const xNum = pickNumericX(payload);
  const value = pickValueFromPayload(payload, isMulti, seriesDate);
  if (!Number.isFinite(xNum) || !Number.isFinite(value)) return null;
  return {
    xNum,
    value,
    seriesDate,
    timeLabel:
      timeLabel ||
      (payload.time != null
        ? String(payload.time)
        : payload.hour != null
          ? `${payload.hour} 点`
          : String(xNum)),
  };
}

function measurePointKey(p) {
  if (!p) return "";
  return `${p.seriesDate}|${p.xNum}`;
}

/** 阻止 mousedown 默认行为，避免焦点进入 SVG/Recharts 子节点而出现系统蓝色轮廓 */
function preventChartSvgFocusRing(e) {
  if (e.target?.closest?.(".recharts-wrapper")) {
    e.preventDefault();
  }
}

const DRAG_ARM_MS = 450;
const DRAG_ARM_CANCEL_MOVE_PX = 14;

function chartPlotMetrics(wrapEl, compact, multiLegend) {
  if (!wrapEl) return null;
  const wrap = wrapEl.getBoundingClientRect();
  const margin = {
    left: 10,
    right: 8,
    top: 24,
    bottom: multiLegend ? (compact ? 20 : 28) : 0,
  };
  const plotW = wrap.width - margin.left - margin.right;
  const plotH = wrap.height - margin.top - margin.bottom;
  const plotLeft = wrap.left + margin.left;
  const plotTop = wrap.top + margin.top;
  return { wrap, margin, plotW, plotH, plotLeft, plotTop };
}

/** 根据松手位置吸附最近数据点（单线） */
function snapNearestPointSingle(clientX, clientY, wrapEl, compact, data, pointDate) {
  const m = chartPlotMetrics(wrapEl, compact, false);
  if (!m || m.plotW <= 0) return null;
  const t = Math.max(0, Math.min(1, (clientX - m.plotLeft) / m.plotW));
  const xGuess = 9 + t * 15;
  let bestRow = null;
  let bestDx = Infinity;
  for (const row of data) {
    const vx = pickNumericX(row);
    if (!Number.isFinite(vx)) continue;
    if (row.value == null || row.value === "") continue;
    const dx = Math.abs(vx - xGuess);
    if (dx < bestDx) {
      bestDx = dx;
      bestRow = row;
    }
  }
  if (!bestRow) return null;
  return buildMeasurePoint(bestRow, false, pointDate, null);
}

/** 根据松手位置吸附最近数据点（多线：先按 x 取行，再按纵轴距离选序列） */
function snapNearestPointMulti(
  clientX,
  clientY,
  wrapEl,
  compact,
  data,
  domain,
  seriesItems
) {
  const m = chartPlotMetrics(wrapEl, compact, true);
  if (!m || m.plotW <= 0 || !seriesItems?.length) return null;
  const t = Math.max(0, Math.min(1, (clientX - m.plotLeft) / m.plotW));
  const xGuess = 9 + t * 15;
  let bestRow = null;
  let bestDx = Infinity;
  for (const row of data) {
    const vx = pickNumericX(row);
    if (!Number.isFinite(vx)) continue;
    const dx = Math.abs(vx - xGuess);
    if (dx < bestDx) {
      bestDx = dx;
      bestRow = row;
    }
  }
  if (!bestRow) return null;
  const d0 = domain[0];
  const d1 = domain[1];
  const span = d1 - d0 || 1;
  let bestPt = null;
  let bestDistY = Infinity;
  for (const s of seriesItems) {
    const v = pickValueFromPayload(bestRow, true, s.date);
    if (!Number.isFinite(v)) continue;
    const yRatio = (v - d0) / span;
    const pixelY = m.plotTop + m.plotH * (1 - yRatio);
    const dist = Math.abs(pixelY - clientY);
    if (dist < bestDistY) {
      bestDistY = dist;
      bestPt = buildMeasurePoint(bestRow, true, s.date, null);
    }
  }
  return bestPt;
}

function formatDeltaHours(dt) {
  if (!Number.isFinite(dt)) return "—";
  const sign = dt < 0 ? "−" : "+";
  const abs = Math.abs(dt);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  if (h === 0) return `${sign}${m} 分钟`;
  if (m === 0) return `${sign}${h} 小时`;
  return `${sign}${h} 小时 ${m} 分`;
}

function formatDeltaValue(dy, isRate) {
  if (!Number.isFinite(dy)) return "—";
  const sign = dy < 0 ? "−" : "+";
  const abs = Math.abs(dy);
  if (isRate) {
    const s = (abs * 100).toFixed(2).replace(/\.?0+$/, "");
    return `${sign}${s} 百分点`;
  }
  const s = abs % 1 === 0 ? String(abs) : abs.toFixed(2);
  return `${sign}${s}`;
}

function formatSlope(dy, dtHours, isRate) {
  if (!Number.isFinite(dy) || !Number.isFinite(dtHours) || dtHours === 0)
    return "—";
  const s = dy / dtHours;
  if (isRate) {
    const pp = s * 100;
    const t = pp.toFixed(2).replace(/\.?0+$/, "");
    return `${pp >= 0 ? "+" : ""}${t} 百分点/小时`;
  }
  const t = s.toFixed(2).replace(/\.?0+$/, "");
  return `${s >= 0 ? "+" : ""}${t} /小时`;
}

function ChartMeasurePanel({
  measureState,
  touchMeasureMode,
  isRate,
  onClear,
  dragDragging = false,
}) {
  const show =
    dragDragging ||
    touchMeasureMode ||
    (measureState &&
      (measureState.type === "first" || measureState.type === "done"));
  if (!show) return null;

  if (dragDragging && measureState?.type !== "done") {
    return (
      <div
        className="chart-measure-panel chart-measure-panel--hint"
        role="status"
      >
        <div className="chart-measure-hint-line">
          拖拽至目标时刻附近松开，将吸附最近数据点并完成测距
        </div>
        <button
          type="button"
          className="chart-measure-clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          取消
        </button>
      </div>
    );
  }

  if (measureState?.type === "done") {
    const { a, b } = measureState;
    const dt = b.xNum - a.xNum;
    const dy = b.value - a.value;
    const sameSeries = a.seriesDate === b.seriesDate;
    return (
      <div className="chart-measure-panel" role="status">
        <div className="chart-measure-panel-row">
          <span className="chart-measure-label">Δ时间</span>
          <span>{formatDeltaHours(dt)}</span>
        </div>
        <div className="chart-measure-panel-row">
          <span className="chart-measure-label">Δ数值</span>
          <span>
            {formatDeltaValue(dy, isRate)}
            {!sameSeries ? (
              <span className="chart-measure-hint">（跨日对比）</span>
            ) : null}
          </span>
        </div>
        <div className="chart-measure-panel-row">
          <span className="chart-measure-label">斜率</span>
          <span>{formatSlope(dy, dt, isRate)}</span>
        </div>
        <button
          type="button"
          className="chart-measure-clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          清除
        </button>
      </div>
    );
  }

  const first = measureState?.type === "first" ? measureState.point : null;
  return (
    <div className="chart-measure-panel chart-measure-panel--hint" role="status">
      {touchMeasureMode ? (
        <div className="chart-measure-hint-line">
          测距已开启：依次点击两个数据点（桌面可按住 Shift 点击）
        </div>
      ) : null}
      {first ? (
        <div className="chart-measure-hint-line">
          已选起点 {first.timeLabel} → {isRate ? formatRate(first.value) : first.value}
          ，请再选终点
        </div>
      ) : !touchMeasureMode ? (
        <div className="chart-measure-hint-line">
          按住 Shift 点击起点，再 Shift 点击终点可测距
        </div>
      ) : null}
      <button
        type="button"
        className="chart-measure-clear"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
      >
        取消
      </button>
    </div>
  );
}

const NOTE_LABEL_MAX_LEN = 12;
function truncateNote(str) {
  if (!str || str.length <= NOTE_LABEL_MAX_LEN) return str;
  return str.slice(0, NOTE_LABEL_MAX_LEN) + "…";
}

/** 在数据点旁渲染备注文案（仅当该点有备注时）。用 index + data 取 payload，因 Recharts LabelList 未必把 payload 传给 content。 */
function renderNoteLabel(pointDate, notesMap, getSlot, data) {
  return function NoteLabelContent(props) {
    const { x, y, index } = props;
    if (x == null || y == null || !Array.isArray(data) || index == null || index < 0 || index >= data.length) return null;
    const payload = data[index];
    if (payload == null) return null;
    const key = `${pointDate}|${getSlot(payload)}`;
    const note = notesMap[key];
    if (!note) return null;
    return (
      <text
        x={Number(x)}
        y={Number(y) - 14}
        textAnchor="middle"
        className="chart-point-note"
      >
        {truncateNote(note)}
      </text>
    );
  };
}

export default function ChartCell({
  seriesItem,
  seriesItems,
  actions,
  actionsByDate,
  onClick,
  compact = false,
  detailPoints20m = null,
  chartKey = "",
  currentDate = "",
  onDotClick,
  notesMap = {},
}) {
  const isMulti = seriesItems != null && seriesItems.length > 0;
  const items = isMulti
    ? seriesItems
    : seriesItem
      ? [{ ...seriesItem, date: "" }]
      : [];

  const [measureState, setMeasureState] = useState(null);
  const [touchMeasureMode, setTouchMeasureMode] = useState(false);
  const [dragPaint, setDragPaint] = useState(null);
  const longPressTimerRef = useRef(null);
  const dotDragArmTimerRef = useRef(null);
  const chartWrapRef = useRef(null);
  const dotDragCleanupRef = useRef(null);
  const dragLineGeomRef = useRef({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const suppressDotClickRef = useRef(false);

  const clearMeasure = useCallback(() => {
    setMeasureState(null);
    setTouchMeasureMode(false);
    setDragPaint(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (dotDragArmTimerRef.current) {
      clearTimeout(dotDragArmTimerRef.current);
      dotDragArmTimerRef.current = null;
    }
    if (dotDragCleanupRef.current) {
      dotDragCleanupRef.current();
      dotDragCleanupRef.current = null;
    }
  }, []);

  const cleanupDotDragArm = useCallback(() => {
    if (dotDragArmTimerRef.current) {
      clearTimeout(dotDragArmTimerRef.current);
      dotDragArmTimerRef.current = null;
    }
    if (dotDragCleanupRef.current) {
      dotDragCleanupRef.current();
      dotDragCleanupRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupDotDragArm();
    };
  }, [cleanupDotDragArm]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") clearMeasure();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearMeasure]);

  useEffect(() => {
    if (measureState?.type === "done" && touchMeasureMode) {
      setTouchMeasureMode(false);
    }
  }, [measureState, touchMeasureMode]);

  if (items.length === 0) return null;

  const first = items[0];
  const isRate = first.isRate;
  const title = isRate ? `${first.subCategory} %` : first.subCategory;
  const titleSubtitle =
    first.itemTitle != null && String(first.itemTitle).trim() !== ""
      ? String(first.itemTitle).trim()
      : "";

  const single = seriesItem || first;
  const useSlots =
    Array.isArray(single.slotValues) && single.slotValues.length > 0;
  const useDetail20m =
    detailPoints20m && detailPoints20m.length > 0 && !useSlots;

  if (!isMulti || items.length === 1) {
    const data = useDetail20m
      ? detailPoints20m.map((d) => ({ ...d, isRate: single.isRate }))
      : useSlots
        ? getChartDataFromSlots(single.slotValues).map((d) => ({
            ...d,
            isRate: single.isRate,
          }))
        : getChartData(single.values || {}).map((d) => ({ ...d, isRate }));
    const domain = useDetail20m
      ? (() => {
          const vals = detailPoints20m
            .map((d) => d.value)
            .filter((v) => v != null && Number.isFinite(v));
          if (vals.length === 0) return [0, 10];
          const min = Math.min.apply(null, vals);
          const max = Math.max.apply(null, vals);
          const span = max - min || 1;
          return [min - span * 0.05, max + span * 0.05];
        })()
      : useSlots
        ? getYDomainFromSlotValues(single.slotValues, single.isRate)
        : getYDomain(single);
    const act =
      actions ||
      (actionsByDate && single.date ? actionsByDate[single.date] : null);
    const dataKey = useDetail20m || useSlots ? "x" : "hour";
    const pointDate = currentDate || single?.date || "";
    const tooltipNoteKey = (p) => `${pointDate}|${getPointSlot(p)}`;
    const renderTooltipSingle = (props) => {
      const p = props.payload?.[0]?.payload;
      const note = p ? notesMap[tooltipNoteKey(p)] : null;
      return <ChartTooltipSingle {...props} actions={act} note={note} />;
    };
    const handleDotClick = (payload) => {
      if (!onDotClick) return;
      const pointSlot = getPointSlot(payload);
      const noteKey = `${pointDate}|${pointSlot}`;
      onDotClick({
        chartKey,
        pointDate,
        pointSlot,
        initialNote: notesMap[noteKey] ?? "",
      });
    };

    const dotMeasureHighlight = (payload) => {
      const pt = buildMeasurePoint(payload, false, pointDate, null);
      if (!pt || !measureState) return false;
      const k = measurePointKey(pt);
      if (measureState.type === "first") {
        return k === measurePointKey(measureState.point);
      }
      if (measureState.type === "done") {
        return (
          k === measurePointKey(measureState.a) ||
          k === measurePointKey(measureState.b)
        );
      }
      return false;
    };

    const handleDotPointer = (e, payload) => {
      e.stopPropagation();
      if (!onDotClick) return;
      if (suppressDotClickRef.current) {
        suppressDotClickRef.current = false;
        return;
      }
      const pt = buildMeasurePoint(payload, false, pointDate, null);
      if (!pt) return;
      const wantMeasure = e.shiftKey || touchMeasureMode;
      if (wantMeasure) {
        setMeasureState((prev) => {
          if (!prev || prev.type === "done") {
            return { type: "first", point: pt };
          }
          if (prev.type === "first") {
            const p1 = prev.point;
            const p2 = pt;
            const [a, b] = p1.xNum <= p2.xNum ? [p1, p2] : [p2, p1];
            return { type: "done", a, b };
          }
          return prev;
        });
      } else {
        clearMeasure();
        handleDotClick(payload);
      }
    };

    const cancelLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onDotPointerDownForDrag = (e, payload) => {
      if (!onDotClick) return;
      if (e.shiftKey || touchMeasureMode) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      e.stopPropagation();
      cleanupDotDragArm();

      const pt = buildMeasurePoint(payload, false, pointDate, null);
      if (!pt) return;

      const arm = {
        startClient: { x: e.clientX, y: e.clientY },
        pointerId: e.pointerId,
        captureEl: e.currentTarget,
        origin: pt,
      };

      const removeEarly = () => {
        window.removeEventListener("pointermove", earlyMove);
        window.removeEventListener("pointerup", earlyUp);
        window.removeEventListener("pointercancel", earlyUp);
      };

      const earlyMove = (ev) => {
        if (ev.pointerId !== arm.pointerId) return;
        const dx = ev.clientX - arm.startClient.x;
        const dy = ev.clientY - arm.startClient.y;
        if (
          dx * dx + dy * dy >
          DRAG_ARM_CANCEL_MOVE_PX * DRAG_ARM_CANCEL_MOVE_PX
        ) {
          if (dotDragArmTimerRef.current) {
            clearTimeout(dotDragArmTimerRef.current);
            dotDragArmTimerRef.current = null;
          }
          removeEarly();
        }
      };

      const earlyUp = (ev) => {
        if (ev.pointerId !== arm.pointerId) return;
        if (dotDragArmTimerRef.current) {
          clearTimeout(dotDragArmTimerRef.current);
          dotDragArmTimerRef.current = null;
        }
        removeEarly();
      };

      window.addEventListener("pointermove", earlyMove);
      window.addEventListener("pointerup", earlyUp);
      window.addEventListener("pointercancel", earlyUp);

      dotDragArmTimerRef.current = setTimeout(() => {
        dotDragArmTimerRef.current = null;
        removeEarly();

        const wrap = chartWrapRef.current;
        if (!wrap || !arm.captureEl) return;
        try {
          arm.captureEl.setPointerCapture(arm.pointerId);
        } catch (_) {}

        const r = wrap.getBoundingClientRect();
        const x1 = arm.startClient.x - r.left;
        const y1 = arm.startClient.y - r.top;
        dragLineGeomRef.current = { x1, y1, x2: x1, y2: y1 };
        setDragPaint({ ...dragLineGeomRef.current });
        setMeasureState(null);
        setTouchMeasureMode(false);

        const onMove = (ev) => {
          if (ev.pointerId !== arm.pointerId) return;
          const rr = wrap.getBoundingClientRect();
          dragLineGeomRef.current.x2 = ev.clientX - rr.left;
          dragLineGeomRef.current.y2 = ev.clientY - rr.top;
          setDragPaint({ ...dragLineGeomRef.current });
        };

        const finishUp = (ev) => {
          if (ev.pointerId !== arm.pointerId) return;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", finishUp);
          window.removeEventListener("pointercancel", finishUp);
          try {
            arm.captureEl.releasePointerCapture(arm.pointerId);
          } catch (_) {}

          setDragPaint(null);

          const endPt = snapNearestPointSingle(
            ev.clientX,
            ev.clientY,
            wrap,
            compact,
            data,
            pointDate
          );
          if (endPt && arm.origin) {
            const p1 = arm.origin;
            const p2 = endPt;
            const [a, b] = p1.xNum <= p2.xNum ? [p1, p2] : [p2, p1];
            setMeasureState({ type: "done", a, b });
          }
          suppressDotClickRef.current = true;
          dotDragCleanupRef.current = null;
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", finishUp);
        window.addEventListener("pointercancel", finishUp);

        dotDragCleanupRef.current = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", finishUp);
          window.removeEventListener("pointercancel", finishUp);
          try {
            arm.captureEl.releasePointerCapture(arm.pointerId);
          } catch (_) {}
          setDragPaint(null);
        };
      }, DRAG_ARM_MS);
    };

    const measureBlock =
      touchMeasureMode ||
      measureState?.type === "first" ||
      measureState?.type === "done" ||
      dragPaint != null;

    const rDot = compact ? 2 : 4;
    const rActive = compact ? 3 : 6;
    const getDotFill = (payload) => {
      if (!payload) return "var(--accent)";
      const key = `${pointDate}|${getPointSlot(payload)}`;
      return notesMap[key] ? "var(--chart-dot-has-note)" : "var(--accent)";
    };
    const getDotStroke = (payload) => {
      if (!payload) return "var(--surface)";
      const key = `${pointDate}|${getPointSlot(payload)}`;
      return notesMap[key] ? "var(--chart-dot-has-note-stroke)" : "var(--surface)";
    };
    const dotComp = (props) => {
      const payload = props.payload;
      if (payload && (payload.value == null || payload.value === '')) return null;
      if (props.cx == null || props.cy == null || !Number.isFinite(Number(props.cx)) || !Number.isFinite(Number(props.cy))) return null;
      const hl = dotMeasureHighlight(payload);
      return (
        <circle
          cx={props.cx}
          cy={props.cy}
          r={rDot}
          fill={getDotFill(payload)}
          stroke={hl ? "#ea580c" : getDotStroke(payload)}
          strokeWidth={hl ? 2 : 1}
        />
      );
    };
    const activeDotComp = onDotClick
      ? (props) => {
          const payload = props.payload;
          if (payload && (payload.value == null || payload.value === '')) return null;
          if (props.cx == null || props.cy == null || !Number.isFinite(Number(props.cx)) || !Number.isFinite(Number(props.cy))) return null;
          const hl = dotMeasureHighlight(payload);
          return (
            <circle
              cx={props.cx}
              cy={props.cy}
              r={rActive}
              fill={getDotFill(payload)}
              stroke={hl ? "#ea580c" : getDotStroke(payload)}
              strokeWidth={hl ? 2 : 1}
              onClick={(e) => {
                handleDotPointer(e, payload);
              }}
              onPointerDown={(e) => {
                onDotPointerDownForDrag(e, payload);
              }}
              style={{ cursor: "pointer" }}
            />
          );
        }
      : { r: rActive, fill: "var(--accent)" };
    return (
      <div
        className={
          "chart-cell " +
          (compact ? "chart-cell--compact" : "chart-cell--large")
        }
        {...(onClick
          ? {
              role: "button",
              tabIndex: 0,
              onClick,
              onKeyDown: (e) => e.key === "Enter" && onClick(),
            }
          : {})}
      >
        <div
          className={
            "chart-cell-title-block" +
            (titleSubtitle ? " chart-cell-title-block--with-sub" : "")
          }
        >
          <div className="chart-cell-title">{title}</div>
          {titleSubtitle ? (
            <div className="chart-cell-title-sub">{titleSubtitle}</div>
          ) : null}
        </div>
        <div
          ref={chartWrapRef}
          className={
            compact ? "chart-cell-chart-wrap" : "chart-cell-chart-wrap-large"
          }
          style={
            !compact
              ? { height: 280, position: "relative" }
              : { position: "relative" }
          }
          onPointerDown={(e) => {
            if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
            cancelLongPress();
            longPressTimerRef.current = setTimeout(() => {
              longPressTimerRef.current = null;
              setTouchMeasureMode(true);
              setMeasureState(null);
            }, 500);
          }}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerMove={(e) => {
            if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
            cancelLongPress();
          }}
          onMouseDown={preventChartSvgFocusRing}
        >
          {measureBlock ? (
            <div className="chart-floating-panel">
              <ChartMeasurePanel
                measureState={measureState}
                touchMeasureMode={touchMeasureMode}
                isRate={isRate}
                onClear={clearMeasure}
                dragDragging={dragPaint != null}
              />
            </div>
          ) : null}
          {dragPaint ? (
            <svg
              className="chart-drag-measure-line"
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 3,
              }}
            >
              <line
                x1={dragPaint.x1}
                y1={dragPaint.y1}
                x2={dragPaint.x2}
                y2={dragPaint.y2}
                stroke="#ea580c"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            </svg>
          ) : null}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 24, right: 8, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey={dataKey}
                type="number"
                domain={[9, 24]}
                ticks={HOURS}
                interval={dataKey === "x" ? "preserveStartEnd" : 0}
                tick={{ fontSize: compact ? 9 : 12 }}
                tickFormatter={(h) => h + "点"}
              />
              <YAxis
                domain={domain}
                tick={{ fontSize: compact ? 10 : 12 }}
                tickFormatter={(v) => formatYTick(v, isRate)}
                width={compact ? 28 : 36}
              />
              <Tooltip
                content={renderTooltipSingle}
                cursor={{ stroke: "var(--accent)", strokeWidth: 1 }}
                position={{ x: 40, y: 8 }}
                wrapperStyle={
                  measureBlock ? { display: "none" } : undefined
                }
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={compact ? 1.5 : 2}
                dot={dotComp}
                activeDot={activeDotComp}
                connectNulls={true}
                isAnimationActive={!compact}
              >
                <LabelList
                  content={renderNoteLabel(pointDate, notesMap, getPointSlot, data)}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const useMultiSlots =
    Array.isArray(first.slotValues) && first.slotValues.length > 0;
  const data = useMultiSlots
    ? getChartDataMultiSlots(seriesItems)
    : getChartDataMulti(seriesItems);
  const domain = getYDomainMulti(seriesItems, isRate);
  const dataKey = useMultiSlots ? "x" : "hour";

  const renderTooltipMulti = (props) => {
    const p0 = props.payload?.[0];
    const note = p0
      ? notesMap[`${p0.dataKey}|${getPointSlot(p0.payload)}`]
      : null;
    return (
      <ChartTooltipMulti
        {...props}
        actionsByDate={actionsByDate}
        isRate={isRate}
        note={note}
      />
    );
  };

  const cancelLongPressMulti = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const measureBlockMulti =
    touchMeasureMode ||
    measureState?.type === "first" ||
    measureState?.type === "done" ||
    dragPaint != null;

  const rDot = compact ? 2 : 4;
  const rActive = compact ? 3 : 6;
  return (
    <div
      className={
        "chart-cell " + (compact ? "chart-cell--compact" : "chart-cell--large")
      }
      {...(onClick
        ? {
            role: "button",
            tabIndex: 0,
            onClick,
            onKeyDown: (e) => e.key === "Enter" && onClick(),
          }
        : {})}
    >
      <div
        className={
          "chart-cell-title-block" +
          (titleSubtitle ? " chart-cell-title-block--with-sub" : "")
        }
      >
        <div className="chart-cell-title">{title}</div>
        {titleSubtitle ? (
          <div className="chart-cell-title-sub">{titleSubtitle}</div>
        ) : null}
      </div>
      <div
        ref={chartWrapRef}
        className={
          compact ? "chart-cell-chart-wrap" : "chart-cell-chart-wrap-large"
        }
        style={
          !compact
            ? { height: 280, position: "relative" }
            : { position: "relative" }
        }
        onPointerDown={(e) => {
          if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
          cancelLongPressMulti();
          longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            setTouchMeasureMode(true);
            setMeasureState(null);
          }, 500);
        }}
        onPointerUp={cancelLongPressMulti}
        onPointerCancel={cancelLongPressMulti}
        onPointerLeave={cancelLongPressMulti}
        onPointerMove={(e) => {
          if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
          cancelLongPressMulti();
        }}
        onMouseDown={preventChartSvgFocusRing}
      >
        {measureBlockMulti ? (
          <div className="chart-floating-panel">
            <ChartMeasurePanel
              measureState={measureState}
              touchMeasureMode={touchMeasureMode}
              isRate={isRate}
              onClear={clearMeasure}
              dragDragging={dragPaint != null}
            />
          </div>
        ) : null}
        {dragPaint ? (
          <svg
            className="chart-drag-measure-line"
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <line
              x1={dragPaint.x1}
              y1={dragPaint.y1}
              x2={dragPaint.x2}
              y2={dragPaint.y2}
              stroke="#ea580c"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          </svg>
        ) : null}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 24, right: 8, left: 10, bottom: compact ? 20 : 28 }}
            >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey={dataKey}
              type="number"
              domain={[9, 24]}
              ticks={HOURS}
              interval={useMultiSlots ? "preserveStartEnd" : 0}
              tick={{ fontSize: compact ? 9 : 12 }}
              tickFormatter={(h) => h + "点"}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: compact ? 10 : 12 }}
              tickFormatter={(v) => formatYTick(v, isRate)}
              width={compact ? 28 : 36}
            />
            <Tooltip
              content={renderTooltipMulti}
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              position={{ x: 40, y: 8 }}
              wrapperStyle={
                measureBlockMulti ? { display: "none" } : undefined
              }
            />
            {seriesItems.map((s, i) => {
              const pointDate = s.date;
              const seriesColor = SERIES_COLORS[i % SERIES_COLORS.length];
              const getDotFillMulti = (payload) => {
                if (!payload) return seriesColor;
                const key = `${pointDate}|${getPointSlot(payload)}`;
                return notesMap[key] ? "var(--chart-dot-has-note)" : seriesColor;
              };
              const getDotStrokeMulti = (payload) => {
                if (!payload) return "var(--surface)";
                const key = `${pointDate}|${getPointSlot(payload)}`;
                return notesMap[key] ? "var(--chart-dot-has-note-stroke)" : "var(--surface)";
              };
              const handleDotClick = (payload) => {
                if (!onDotClick) return;
                const pointSlot = getPointSlot(payload);
                const noteKey = `${pointDate}|${pointSlot}`;
                onDotClick({
                  chartKey,
                  pointDate,
                  pointSlot,
                  initialNote: notesMap[noteKey] ?? "",
                });
              };

              const dotMeasureHighlightMulti = (payload) => {
                const pt = buildMeasurePoint(payload, true, pointDate, null);
                if (!pt || !measureState) return false;
                const k = measurePointKey(pt);
                if (measureState.type === "first") {
                  return k === measurePointKey(measureState.point);
                }
                if (measureState.type === "done") {
                  return (
                    k === measurePointKey(measureState.a) ||
                    k === measurePointKey(measureState.b)
                  );
                }
                return false;
              };

              const handleDotPointerMulti = (e, payload) => {
                e.stopPropagation();
                if (!onDotClick) return;
                if (suppressDotClickRef.current) {
                  suppressDotClickRef.current = false;
                  return;
                }
                const pt = buildMeasurePoint(payload, true, pointDate, null);
                if (!pt) return;
                const wantMeasure = e.shiftKey || touchMeasureMode;
                if (wantMeasure) {
                  setMeasureState((prev) => {
                    if (!prev || prev.type === "done") {
                      return { type: "first", point: pt };
                    }
                    if (prev.type === "first") {
                      const p1 = prev.point;
                      const p2 = pt;
                      const [a, b] = p1.xNum <= p2.xNum ? [p1, p2] : [p2, p1];
                      return { type: "done", a, b };
                    }
                    return prev;
                  });
                } else {
                  clearMeasure();
                  handleDotClick(payload);
                }
              };

              const onDotPointerDownForDragMulti = (e, payload) => {
                if (!onDotClick) return;
                if (e.shiftKey || touchMeasureMode) return;
                if (e.pointerType === "mouse" && e.button !== 0) return;

                e.stopPropagation();
                cleanupDotDragArm();

                const pt = buildMeasurePoint(payload, true, pointDate, null);
                if (!pt) return;

                const arm = {
                  startClient: { x: e.clientX, y: e.clientY },
                  pointerId: e.pointerId,
                  captureEl: e.currentTarget,
                  origin: pt,
                };

                const removeEarly = () => {
                  window.removeEventListener("pointermove", earlyMove);
                  window.removeEventListener("pointerup", earlyUp);
                  window.removeEventListener("pointercancel", earlyUp);
                };

                const earlyMove = (ev) => {
                  if (ev.pointerId !== arm.pointerId) return;
                  const dx = ev.clientX - arm.startClient.x;
                  const dy = ev.clientY - arm.startClient.y;
                  if (
                    dx * dx + dy * dy >
                    DRAG_ARM_CANCEL_MOVE_PX * DRAG_ARM_CANCEL_MOVE_PX
                  ) {
                    if (dotDragArmTimerRef.current) {
                      clearTimeout(dotDragArmTimerRef.current);
                      dotDragArmTimerRef.current = null;
                    }
                    removeEarly();
                  }
                };

                const earlyUp = (ev) => {
                  if (ev.pointerId !== arm.pointerId) return;
                  if (dotDragArmTimerRef.current) {
                    clearTimeout(dotDragArmTimerRef.current);
                    dotDragArmTimerRef.current = null;
                  }
                  removeEarly();
                };

                window.addEventListener("pointermove", earlyMove);
                window.addEventListener("pointerup", earlyUp);
                window.addEventListener("pointercancel", earlyUp);

                dotDragArmTimerRef.current = setTimeout(() => {
                  dotDragArmTimerRef.current = null;
                  removeEarly();

                  const wrap = chartWrapRef.current;
                  if (!wrap || !arm.captureEl) return;
                  try {
                    arm.captureEl.setPointerCapture(arm.pointerId);
                  } catch (_) {}

                  const r = wrap.getBoundingClientRect();
                  const x1 = arm.startClient.x - r.left;
                  const y1 = arm.startClient.y - r.top;
                  dragLineGeomRef.current = { x1, y1, x2: x1, y2: y1 };
                  setDragPaint({ ...dragLineGeomRef.current });
                  setMeasureState(null);
                  setTouchMeasureMode(false);

                  const onMove = (ev) => {
                    if (ev.pointerId !== arm.pointerId) return;
                    const rr = wrap.getBoundingClientRect();
                    dragLineGeomRef.current.x2 = ev.clientX - rr.left;
                    dragLineGeomRef.current.y2 = ev.clientY - rr.top;
                    setDragPaint({ ...dragLineGeomRef.current });
                  };

                  const finishUp = (ev) => {
                    if (ev.pointerId !== arm.pointerId) return;
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", finishUp);
                    window.removeEventListener("pointercancel", finishUp);
                    try {
                      arm.captureEl.releasePointerCapture(arm.pointerId);
                    } catch (_) {}

                    setDragPaint(null);

                    const endPt = snapNearestPointMulti(
                      ev.clientX,
                      ev.clientY,
                      wrap,
                      compact,
                      data,
                      domain,
                      seriesItems
                    );
                    if (endPt && arm.origin) {
                      const p1 = arm.origin;
                      const p2 = endPt;
                      const [a, b] = p1.xNum <= p2.xNum ? [p1, p2] : [p2, p1];
                      setMeasureState({ type: "done", a, b });
                    }
                    suppressDotClickRef.current = true;
                    dotDragCleanupRef.current = null;
                  };

                  window.addEventListener("pointermove", onMove);
                  window.addEventListener("pointerup", finishUp);
                  window.addEventListener("pointercancel", finishUp);

                  dotDragCleanupRef.current = () => {
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", finishUp);
                    window.removeEventListener("pointercancel", finishUp);
                    try {
                      arm.captureEl.releasePointerCapture(arm.pointerId);
                    } catch (_) {}
                    setDragPaint(null);
                  };
                }, DRAG_ARM_MS);
              };

              const dotCompMulti = (props) => {
                const payload = props.payload;
                const val = payload && payload[pointDate];
                if (val == null || val === '') return null;
                if (props.cx == null || props.cy == null || !Number.isFinite(Number(props.cx)) || !Number.isFinite(Number(props.cy))) return null;
                const hl = dotMeasureHighlightMulti(payload);
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={rDot}
                    fill={getDotFillMulti(payload)}
                    stroke={hl ? "#ea580c" : getDotStrokeMulti(payload)}
                    strokeWidth={hl ? 2 : 1}
                  />
                );
              };
              const activeDotComp = onDotClick
                ? (props) => {
                    const payload = props.payload;
                    const val = payload && payload[pointDate];
                    if (val == null || val === '') return null;
                    if (props.cx == null || props.cy == null || !Number.isFinite(Number(props.cx)) || !Number.isFinite(Number(props.cy))) return null;
                    const hl = dotMeasureHighlightMulti(payload);
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={rActive}
                        fill={getDotFillMulti(payload)}
                        stroke={hl ? "#ea580c" : getDotStrokeMulti(payload)}
                        strokeWidth={hl ? 2 : 1}
                        onClick={(e) => {
                          handleDotPointerMulti(e, payload);
                        }}
                        onPointerDown={(e) => {
                          onDotPointerDownForDragMulti(e, payload);
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  }
                : { r: rActive };
              return (
                <Line
                  key={s.date}
                  type="monotone"
                  dataKey={s.date}
                  name={s.date}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={compact ? 1.5 : 2}
                  dot={dotCompMulti}
                  activeDot={activeDotComp}
                  connectNulls={true}
                  isAnimationActive={!compact}
                >
                  <LabelList
                    content={renderNoteLabel(
                      s.date,
                      notesMap,
                      getPointSlot,
                      data
                    )}
                  />
                </Line>
              );
            })}
            <Legend
              wrapperStyle={{ fontSize: compact ? 9 : 11 }}
              iconType="line"
              iconSize={8}
              formatter={(v) => v}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
