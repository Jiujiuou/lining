const DEFAULT_PROGRESS = {
  visible: false,
  label: '准备中',
  pages: '',
  percent: 0,
  indeterminate: false,
};

export function getDefaultProgress() {
  return { ...DEFAULT_PROGRESS };
}

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function buildProgressState(message) {
  const total = message.totalPage != null ? Number(message.totalPage) : Number.NaN;
  const currentPage = message.currentPage != null ? Number(message.currentPage) : 0;
  const label = String(message.message || '').trim() || '处理中';
  const pages = Number.isFinite(total) && total > 0 ? `共 ${total} 页` : '';

  if (!(Number.isFinite(total) && total > 0)) {
    return {
      visible: true,
      label,
      pages,
      percent: 0,
      indeterminate: true,
    };
  }

  let percent = clampPercent((currentPage / total) * 100);
  if (label.includes('正在请求')) {
    percent = clampPercent((((currentPage > 0 ? currentPage : 1) - 1) / total) * 100);
  }

  return {
    visible: true,
    label,
    pages,
    percent,
    indeterminate: false,
  };
}

