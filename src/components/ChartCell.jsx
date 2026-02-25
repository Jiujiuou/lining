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
  if (items.length === 0) return null;

  const first = items[0];
  const isRate = first.isRate;
  const title = isRate
    ? `${first.category} - ${first.subCategory} %`
    : `${first.category} - ${first.subCategory}`;

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
    const r = compact ? 3 : 6;
    const activeDotComp = onDotClick
      ? (props) => (
          <circle
            cx={props.cx}
            cy={props.cy}
            r={r}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth={1}
            onClick={(e) => {
              e.stopPropagation();
              handleDotClick(props.payload);
            }}
            style={{ cursor: "pointer" }}
          />
        )
      : { r, fill: "var(--accent)" };
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
        <div className="chart-cell-title">{title}</div>
        <div
          className={
            compact ? "chart-cell-chart-wrap" : "chart-cell-chart-wrap-large"
          }
          style={!compact ? { height: 280 } : undefined}
        >
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
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={compact ? 1.5 : 2}
                dot={{ r: compact ? 2 : 4, fill: "var(--accent)" }}
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

  const r = compact ? 3 : 6;
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
      <div className="chart-cell-title">{title}</div>
      <div
        className={
          compact ? "chart-cell-chart-wrap" : "chart-cell-chart-wrap-large"
        }
        style={!compact ? { height: 280 } : undefined}
      >
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
            />
            {seriesItems.map((s, i) => {
              const pointDate = s.date;
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
              const activeDotComp = onDotClick
                ? (props) => (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={r}
                      fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      stroke="var(--surface)"
                      strokeWidth={1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDotClick(props.payload);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  )
                : { r };
              return (
                <Line
                  key={s.date}
                  type="monotone"
                  dataKey={s.date}
                  name={s.date}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={compact ? 1.5 : 2}
                  dot={{ r: compact ? 2 : 4 }}
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
