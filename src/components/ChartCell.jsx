import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  getChartData,
  getChartDataFromSlots,
  getChartDataMulti,
  getChartDataMultiSlots,
  getYDomain,
  getYDomainFromSlotValues,
  getYDomainMulti,
  formatYTick,
  HOURS,
  SERIES_COLORS,
} from '../utils/chartHelpers';

function ChartTooltipSingle({ payload, active, actions }) {
  if (!active || !payload?.length) return null;
  const hour = payload[0]?.payload?.hour;
  const value = payload[0]?.value;
  const list = actions?.[hour] ?? [];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{hour} 点</div>
      <div className="chart-tooltip-value">
        {value != null ? (payload[0].payload.isRate ? `${(Number(value) * 100).toFixed(2)}%` : value) : '—'}
      </div>
      {list.length > 0 && (
        <div className="chart-tooltip-actions">
          {list.map((text, i) => (
            <div key={i} className="chart-tooltip-action">
              {text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartTooltipDetail20m({ payload, active }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{p.time}</div>
      <div className="chart-tooltip-value">{p.value != null ? p.value : '—'}</div>
    </div>
  );
}

function ChartTooltipMulti({ payload, active, actionsByDate, isRate }) {
  if (!active || !payload?.length) return null;
  const p0 = payload[0]?.payload;
  const hour = p0?.hour;
  const timeLabel = p0?.time != null ? p0.time : (hour != null ? `${hour} 点` : '');
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{timeLabel}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey} className="chart-tooltip-row">
            <span className="chart-tooltip-date">{p.dataKey}</span>
            <span className="chart-tooltip-value">
              {isRate ? `${(Number(p.value) * 100).toFixed(2)}%` : p.value}
            </span>
          </div>
        ))}
      {payload.map((p) => {
        const list = actionsByDate?.[p.dataKey]?.[hour] ?? actionsByDate?.[p.dataKey]?.[p0?.x] ?? [];
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

export default function ChartCell({
  seriesItem,
  seriesItems,
  actions,
  actionsByDate,
  onClick,
  compact = false,
  detailPoints20m = null,
}) {
  const isMulti = seriesItems != null && seriesItems.length > 0;
  const items = isMulti ? seriesItems : seriesItem ? [{ ...seriesItem, date: '' }] : [];
  if (items.length === 0) return null;

  const first = items[0];
  const isRate = first.isRate;
  const title = isRate
    ? `${first.category} - ${first.subCategory} %`
    : `${first.category} - ${first.subCategory}`;

  const single = seriesItem ?? first;
  const useSlots = Array.isArray(single?.slotValues);
  const useDetail20m = !compact && detailPoints20m && detailPoints20m.length > 0 && !useSlots;

  if (!isMulti || items.length === 1) {
    const data = useSlots
      ? getChartDataFromSlots(single.slotValues).map((d) => ({ ...d, isRate: single.isRate }))
      : useDetail20m
        ? detailPoints20m
        : getChartData(single.values).map((d) => ({ ...d, isRate }));
    const domain = useSlots
      ? getYDomainFromSlotValues(single.slotValues, single.isRate)
      : useDetail20m
        ? (() => {
            const vals = detailPoints20m.map((d) => d.value).filter((v) => v != null && Number.isFinite(v));
            if (vals.length === 0) return [0, 10];
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const span = max - min || 1;
            return [min - span * 0.05, max + span * 0.05];
          })()
        : getYDomain(single);
    const act = actions ?? actionsByDate?.[single.date];
    return (
      <div
        className={`chart-cell ${compact ? 'chart-cell--compact' : 'chart-cell--large'}`}
        {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e) => e.key === 'Enter' && onClick() } : {})}
      >
        <div className="chart-cell-title">{title}</div>
        <div
          className={compact ? 'chart-cell-chart-wrap' : 'chart-cell-chart-wrap-large'}
          style={!compact ? { height: 280 } : undefined}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey={useSlots || useDetail20m ? 'x' : 'hour'}
                type="number"
                domain={[9, 24]}
                ticks={useSlots ? undefined : HOURS}
                interval={useSlots ? 'preserveStartEnd' : 0}
                tick={{ fontSize: compact ? 9 : 12 }}
                tickFormatter={useSlots || useDetail20m
                  ? (x) => (data.find((d) => d.x === x)?.time ?? `${Math.floor(x)}:${String(Math.round((x % 1) * 60)).padStart(2, '0')}`)
                  : (h) => `${h}点`}
              />
              <YAxis
                domain={domain}
                tick={{ fontSize: compact ? 10 : 12 }}
                tickFormatter={(v) => formatYTick(v, isRate)}
                width={compact ? 28 : 36}
              />
              <Tooltip
                content={useSlots || useDetail20m ? <ChartTooltipDetail20m /> : <ChartTooltipSingle actions={act} />}
                cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }}
                position={{ x: 40, y: 8 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={compact ? 1.5 : 2}
                dot={{ r: compact ? 2 : useDetail20m ? 2 : 4, fill: 'var(--accent)' }}
                connectNulls={true}
                isAnimationActive={!compact}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const useMultiSlots = Array.isArray(first?.slotValues) && first.slotValues.length > 0;
  const data = useMultiSlots ? getChartDataMultiSlots(seriesItems) : getChartDataMulti(seriesItems);
  const domain = getYDomainMulti(seriesItems, isRate);

  return (
    <div
      className={`chart-cell ${compact ? 'chart-cell--compact' : 'chart-cell--large'}`}
      {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e) => e.key === 'Enter' && onClick() } : {})}
    >
      <div className="chart-cell-title">{title}</div>
      <div
        className={compact ? 'chart-cell-chart-wrap' : 'chart-cell-chart-wrap-large'}
        style={!compact ? { height: 280 } : undefined}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: compact ? 20 : 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey={useMultiSlots ? 'x' : 'hour'}
              type="number"
              domain={[9, 24]}
              ticks={useMultiSlots ? undefined : HOURS}
              interval={useMultiSlots ? 'preserveStartEnd' : 0}
              tick={{ fontSize: compact ? 9 : 12 }}
              tickFormatter={useMultiSlots ? (x) => data.find((d) => d.x === x)?.time ?? `${Math.floor(x)}:${String(Math.round((x % 1) * 60)).padStart(2, '0')}` : (h) => `${h}点`}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: compact ? 10 : 12 }}
              tickFormatter={(v) => formatYTick(v, isRate)}
              width={compact ? 28 : 36}
            />
            <Tooltip
              content={<ChartTooltipMulti actionsByDate={actionsByDate} isRate={isRate} />}
              cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
              position={{ x: 40, y: 8 }}
            />
            {seriesItems.map((s, i) => (
              <Line
                key={s.date}
                type="monotone"
                dataKey={s.date}
                name={s.date}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={compact ? 1.5 : 2}
                dot={{ r: compact ? 2 : 4 }}
                connectNulls={true}
                isAnimationActive={!compact}
              />
            ))}
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
