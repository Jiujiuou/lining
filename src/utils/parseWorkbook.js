import * as XLSX from 'xlsx';

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const COL_START_HOUR = 3; // 0-based: 第 4 列 = 9点

function toDateStr(cell) {
  if (cell == null || cell === '') return null;
  if (typeof cell === 'number') {
    return new Date((cell - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }
  const d = new Date(cell);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function parseCellValue(val, isRate) {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  if (s === '-' || s === '') return null;
  const plusMatch = s.match(/^(\d+)\+$/);
  if (plusMatch) return Number(plusMatch[1]);
  const n = Number(s.replace(/,/g, ''));
  if (Number.isFinite(n)) return n;
  return null;
}

function isRateSubCategory(subCategory) {
  return subCategory != null && String(subCategory).includes('转化');
}

const TARGET_SHEET_NAME = '数据记录-小贝壳';

/**
 * 选择要解析的工作表：仅一个表时用该表，多表时用「数据记录-小贝壳」。
 */
function getSheetToParse(wb) {
  const names = wb.SheetNames || [];
  if (names.length <= 1) return names[0] ?? null;
  return names.find((n) => n === TARGET_SHEET_NAME) ?? names[0];
}

/**
 * 解析「小贝壳作战」格式的 xlsx，返回标准数据结构。
 * 仅一个工作表时解析该表；多个工作表时解析「数据记录-小贝壳」。
 * 表格中日期、大类多为合并单元格，只有每块第一格有值，需继承上一行的日期与大类。
 * @param {ArrayBuffer} arrayBuffer - 文件 ArrayBuffer
 * @returns {{ dates: string[], byDate: Record<string, { series: Array<...>, actions: Record<number, string[]> }> }}
 */
export function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = getSheetToParse(wb);
  if (!sheetName || !wb.Sheets[sheetName]) {
    throw new Error('工作簿中没有可解析的工作表');
  }
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const byDate = {};
  const dateSet = new Set();
  let lastDateStr = null;
  let lastCategory = '';

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < COL_START_HOUR) continue;

    // 合并单元格：日期只有每块第一行有值，其余行为空，用上一行的日期
    const cellDate = toDateStr(row[0]);
    if (cellDate) lastDateStr = cellDate;
    const dateStr = lastDateStr;
    if (!dateStr) continue;

    dateSet.add(dateStr);

    // 合并单元格：大类只有每块第一行有值（小贝壳/销量/动作记录），其余行为空，用上一行的大类
    const cellCategory = String(row[1] ?? '').trim();
    if (cellCategory) lastCategory = cellCategory;
    const category = lastCategory;

    const subCategory = String(row[2] ?? '').trim();
    if (!subCategory) continue; // 小类为空视为空行，跳过

    if (!byDate[dateStr]) {
      byDate[dateStr] = { series: [], actions: {} };
      HOURS.forEach((h) => { byDate[dateStr].actions[h] = []; });
    }

    if (category === '动作记录') {
      HOURS.forEach((hour, i) => {
        const cell = row[COL_START_HOUR + i];
        const text = cell != null && String(cell).trim() ? String(cell).trim() : '';
        if (text) byDate[dateStr].actions[hour].push(`${subCategory}-${text}`);
      });
      continue;
    }

    const values = {};
    HOURS.forEach((hour, i) => {
      values[hour] = parseCellValue(row[COL_START_HOUR + i], isRateSubCategory(subCategory));
    });
    byDate[dateStr].series.push({
      category,
      subCategory,
      isRate: isRateSubCategory(subCategory),
      values,
    });
  }

  const dates = Array.from(dateSet).filter(Boolean).sort();
  return { dates, byDate };
}
