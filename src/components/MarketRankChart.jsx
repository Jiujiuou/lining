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
import { SERIES_COLORS } from '../utils/chartHelpers';

function RankTooltip({ payload, active, shopNames }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{p.recorded_at}</div>
      {shopNames.map((name) => (
        <div key={name} className="chart-tooltip-row">
          <span className="chart-tooltip-date">{name}</span>
          <span className="chart-tooltip-value">{p[name] != null ? `第 ${p[name]} 名` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function getRankYDomain(data, shopNames) {
  let min = Infinity;
  let max = -Infinity;
  data.forEach((row) => {
    shopNames.forEach((name) => {
      const v = row[name];
      if (v != null && Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    });
  });
  if (min === Infinity || max === -Infinity) return [0, 10];
  const span = max - min || 1;
  return [Math.max(0, min - span * 0.05), max + span * 0.05];
}

export default function MarketRankChart({ data, shopNames, compact = false }) {
  if (!data?.length || !shopNames?.length) {
    return (
      <div className="chart-cell chart-cell--compact">
        <div className="chart-cell-title">市场排名</div>
        <div className="chart-cell-chart-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <span className="chart-empty-hint">暂无排名数据</span>
        </div>
      </div>
    );
  }
  const domain = getRankYDomain(data, shopNames);
  const tickFormatter = (recorded_at) => {
    if (!recorded_at || typeof recorded_at !== 'string') return '';
    const part = recorded_at.indexOf(':') >= 0 ? recorded_at.split(':').slice(1).join(':') : recorded_at;
    return part.length > 8 ? part.slice(0, 8) : part;
  };

  return (
    <div className={`chart-cell ${compact ? 'chart-cell--compact' : 'chart-cell--large'}`} style={compact ? {} : { gridColumn: '1 / -1' }}>
      <div className="chart-cell-title">市场排名（数字越小越靠前）</div>
      <div
        className={compact ? 'chart-cell-chart-wrap' : 'chart-cell-chart-wrap-large'}
        style={!compact ? { height: 280 } : undefined}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="recorded_at"
              tick={{ fontSize: compact ? 9 : 12 }}
              tickFormatter={tickFormatter}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: compact ? 10 : 12 }}
              width={compact ? 28 : 36}
              reversed
            />
            <Tooltip
              content={(props) => <RankTooltip {...props} shopNames={shopNames} />}
              cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }}
            />
            <Legend />
            {shopNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                name={name}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={compact ? 1.5 : 2}
                dot={{ r: compact ? 2 : 4 }}
                connectNulls
                isAnimationActive={!compact}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
