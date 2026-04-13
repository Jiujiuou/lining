import '@/popup/components/FormPanel/styles.css';

const ORDER_STATUS_OPTIONS = [
  { value: 'SUCCESS', label: '已成功' },
  { value: 'NOT_PAID', label: '待付款' },
  { value: 'PAID', label: '待发货' },
  { value: 'SEND', label: '已发货' },
  { value: 'DROP', label: '交易关闭' },
  { value: 'ALL', label: '全部' },
];

export function FormPanel({
  form,
  isStarting,
  isRunning,
  onFieldChange,
  onStart,
  onStop,
}) {
  return (
    <section className="ou-form-panel" aria-label="获取用户数据">
      <h2 className="ou-panel-title">获取用户数据</h2>
      <div className="ou-form-fields">
        <label className="ou-form-label">
          <span className="ou-form-label-text">联盟/店铺 ID</span>
          <input
            type="text"
            className="ou-input"
            value={form.unionSearch}
            placeholder="可选，例如 1017849608938"
            onChange={(event) => onFieldChange('unionSearch', event.target.value)}
          />
        </label>

        <label className="ou-form-label">
          <span className="ou-form-label-text">搜索词</span>
          <input
            type="text"
            className="ou-input"
            value={form.buyerNick}
            placeholder="可选，买家昵称/宝贝关键词"
            onChange={(event) => onFieldChange('buyerNick', event.target.value)}
          />
        </label>

        <div className="ou-form-date-range">
          <label className="ou-form-label">
            <span className="ou-form-label-text">开始日期</span>
            <input
              type="date"
              className="ou-input"
              value={form.payDateBegin || ''}
              onChange={(event) => onFieldChange('payDateBegin', event.target.value)}
            />
          </label>
          <label className="ou-form-label">
            <span className="ou-form-label-text">结束日期</span>
            <input
              type="date"
              className="ou-input"
              value={form.payDateEnd || ''}
              onChange={(event) => onFieldChange('payDateEnd', event.target.value)}
            />
          </label>
        </div>

        <label className="ou-form-label">
          <span className="ou-form-label-text">订单状态</span>
          <select
            className="ou-select"
            value={form.orderStatus}
            onChange={(event) => onFieldChange('orderStatus', event.target.value)}
          >
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="ou-form-actions">
        <button
          type="button"
          className="ou-start-btn"
          onClick={onStart}
          disabled={isStarting || isRunning}
        >
          {isStarting ? '正在启动…' : isRunning ? '获取中…' : '获取用户数据'}
        </button>
        <button
          type="button"
          className="ou-stop-btn"
          onClick={onStop}
          disabled={!isRunning || isStarting}
        >
          停止获取
        </button>
      </div>
    </section>
  );
}
