import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { getTrendYDomain, formatYTick } from '../utils/chartHelpers';

function TrendTooltip({ payload, active, isRate, actionCount }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const v = p.value;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{p.date}</div>
      <div className="chart-tooltip-value">
        {v != null ? (isRate ? `${(Number(v) * 100).toFixed(2)}%` : v) : '—'}
      </div>
      {actionCount != null && actionCount > 0 && (
        <div className="chart-tooltip-actions">
          <div className="chart-tooltip-action">该日 {actionCount} 条动作</div>
        </div>
      )}
    </div>
  );
}

export default function TrendChartCell({ title, data, isRate, actionCountByDate, onClick, compact = false }) {
  const domain = getTrendYDomain(data, isRate);

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
              dataKey="date"
              tick={{ fontSize: compact ? 9 : 12 }}
              tickFormatter={(d) => (d && d.length >= 10 ? d.slice(5) : d)}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: compact ? 10 : 12 }}
              tickFormatter={(v) => formatYTick(v, isRate)}
              width={compact ? 28 : 36}
            />
            <Tooltip
              content={(props) => {
                const date = props.payload?.[0]?.payload?.date;
                const actionCount = date ? actionCountByDate?.[date] : undefined;
                return <TrendTooltip {...props} isRate={isRate} actionCount={actionCount} />;
              }}
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
