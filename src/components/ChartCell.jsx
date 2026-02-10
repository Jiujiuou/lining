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
  getChartDataMulti,
  getYDomain,
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

function ChartTooltipMulti({ payload, active, actionsByDate, isRate }) {
  if (!active || !payload?.length) return null;
  const hour = payload[0]?.payload?.hour;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{hour} 点</div>
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
        const list = actionsByDate?.[p.dataKey]?.[hour] ?? [];
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
}) {
  const isMulti = seriesItems != null && seriesItems.length > 0;
  const items = isMulti ? seriesItems : seriesItem ? [{ ...seriesItem, date: '' }] : [];
  if (items.length === 0) return null;

  const first = items[0];
  const isRate = first.isRate;
  const title = isRate
    ? `${first.category} - ${first.subCategory} %`
    : `${first.category} - ${first.subCategory}`;

  if (!isMulti || items.length === 1) {
    const single = seriesItem ?? first;
    const data = getChartData(single.values).map((d) => ({ ...d, isRate }));
    const domain = getYDomain(single);
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
                dataKey="hour"
                type="number"
                domain={[9, 24]}
                ticks={HOURS}
                interval={0}
                tick={{ fontSize: compact ? 9 : 12 }}
                tickFormatter={(h) => `${h}点`}
              />
              <YAxis
                domain={domain}
                tick={{ fontSize: compact ? 10 : 12 }}
                tickFormatter={(v) => formatYTick(v, isRate)}
                width={compact ? 28 : 36}
              />
              <Tooltip
                content={<ChartTooltipSingle actions={act} />}
                cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }}
                position={{ x: 40, y: 8 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={compact ? 1.5 : 2}
                dot={{ r: compact ? 2 : 4, fill: 'var(--accent)' }}
                connectNulls={true}
                isAnimationActive={!compact}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const data = getChartDataMulti(seriesItems);
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
              dataKey="hour"
              type="number"
              domain={[9, 24]}
              ticks={HOURS}
              interval={0}
              tick={{ fontSize: compact ? 9 : 12 }}
              tickFormatter={(h) => `${h}点`}
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
