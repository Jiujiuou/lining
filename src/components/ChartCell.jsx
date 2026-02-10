import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getChartData, getYDomain, formatYTick, HOURS } from '../utils/chartHelpers';

function ChartTooltip({ payload, label, active, actions }) {
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

export default function ChartCell({ seriesItem, actions, onClick, compact = false }) {
  const data = getChartData(seriesItem.values).map((d) => ({
    ...d,
    isRate: seriesItem.isRate,
  }));
  const domain = getYDomain(seriesItem);
  const title = seriesItem.isRate
    ? `${seriesItem.category} - ${seriesItem.subCategory} %`
    : `${seriesItem.category} - ${seriesItem.subCategory}`;

  return (
    <div
      className={`chart-cell ${compact ? 'chart-cell--compact' : 'chart-cell--large'}`}
      {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e) => e.key === 'Enter' && onClick() } : {})}
    >
      <div className="chart-cell-title">{title}</div>
      <div className={compact ? 'chart-cell-chart-wrap' : 'chart-cell-chart-wrap-large'} style={!compact ? { height: 280 } : undefined}>
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
            tickFormatter={(v) => formatYTick(v, seriesItem.isRate)}
            width={compact ? 28 : 36}
          />
          <Tooltip
            content={<ChartTooltip actions={actions} />}
            cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }}
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
