function escapeCsvCell(value) {
  if (value == null) {
    return '';
  }
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function orderIdCellForExcelCsv(orderId) {
  const text = orderId == null ? '' : String(orderId);
  return `="${text.replace(/"/g, '""')}"`;
}

function createTimestamp() {
  const now = new Date();
  const pad = (num) => (num < 10 ? `0${num}` : String(num));
  return [
    now.getFullYear(),
    '-',
    pad(now.getMonth() + 1),
    '-',
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

export function downloadCsv(rows) {
  const headers = ['订单ID', '昵称'];
  const lines = [headers.join(',')];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    lines.push(
      [orderIdCellForExcelCsv(row.orderId), escapeCsvCell(row.nick)].join(','),
    );
  }

  const csv = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sold_userdata_ou_${createTimestamp()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

