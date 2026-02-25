import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from 'recharts';
import { getTrendYDomain, formatYTick, formatRate } from '../utils/chartHelpers';

const NOTE_LABEL_MAX_LEN = 12;
function truncateNote(str) {
  if (!str || str.length <= NOTE_LABEL_MAX_LEN) return str;
  return str.slice(0, NOTE_LABEL_MAX_LEN) + '…';
}

function TrendTooltip({ payload, active, isRate, actionCount, note }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const v = p.value;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{p.date}</div>
      <div className="chart-tooltip-value">
        {v != null ? (isRate ? formatRate(v) : v) : '—'}
      </div>
      {note ? (
        <div className="chart-tooltip-note">
          <span className="chart-tooltip-note-label">备注：</span>
          {note}
        </div>
      ) : null}
      {actionCount != null && actionCount > 0 ? (
        <div className="chart-tooltip-actions">
          <div className="chart-tooltip-action">该日 {actionCount} 条动作</div>
        </div>
      ) : null}
    </div>
  );
}

export default function TrendChartCell({
  title,
  data,
  isRate,
  actionCountByDate,
  onClick,
  compact = false,
  chartKey = '',
  onDotClick,
  notesMap = {},
}) {
  const domain = getTrendYDomain(data, isRate);
  const pointSlot = '';
  const noteKey = (date) => `${date}|${pointSlot}`;
  const renderNoteLabelContent = (props) => {
    const { x, y, index } = props;
    if (x == null || y == null || !Array.isArray(data) || index == null || index < 0 || index >= data.length) return null;
    const payload = data[index];
    if (payload == null) return null;
    const date = payload.date;
    const note = date ? notesMap[noteKey(date)] : null;
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
  const renderTooltip = (props) => {
    const date = props.payload?.[0]?.payload?.date;
    const actionCount = date ? actionCountByDate?.[date] : undefined;
    const note = date ? notesMap[noteKey(date)] : null;
    return <TrendTooltip {...props} isRate={isRate} actionCount={actionCount} note={note} />;
  };
  const handleDotClick = (payload) => {
    if (!onDotClick) return;
    const pointDate = payload?.date ?? '';
    onDotClick({ chartKey, pointDate, pointSlot, initialNote: notesMap[noteKey(pointDate)] ?? '' });
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
          style={{ cursor: 'pointer' }}
        />
      )
    : { r: compact ? 3 : 6, fill: 'var(--accent)' };

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
          <LineChart data={data} margin={{ top: 24, right: 8, left: 10, bottom: 0 }}>
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
              content={renderTooltip}
              cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }}
              position={{ x: 40, y: 8 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--accent)"
              strokeWidth={compact ? 1.5 : 2}
              dot={{ r: compact ? 2 : 4, fill: 'var(--accent)' }}
              activeDot={activeDotComp}
              connectNulls={true}
              isAnimationActive={!compact}
            >
              <LabelList content={renderNoteLabelContent} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
