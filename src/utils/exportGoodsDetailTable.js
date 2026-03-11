/**
 * 将 goods_detail_slot_log 原始行导出为与表头.xlsx 一致的表格 xlsx：
 * 表头：日期 | 商品名 | 数据 | 9 | 9:20 | 9:40 | 10 | ... | 24（20 分钟一个数据点，共 46 列）
 * 数据行：日期（可合并）| 商品名（可合并、固定宽、换行）| 指标名 | 各 20 分钟槽位数值
 */

import * as XLSX from "xlsx-js-style";

const MINUTES_FROM_9 = 20;
const SLOT_COUNT = 46;

/** 46 个时间点表头：9, 9:20, 9:40, 10, 10:20, ..., 24 */
const SLOT_LABELS = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const totalMin = i * MINUTES_FROM_9;
  const h = 9 + Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
});

/** 从 slot_ts 解析东八区 dateStr 与 slotIndex (0～45) */
function parseSlotTsToDateAndSlot(slotTs) {
  if (slotTs == null) return null;
  const s =
    typeof slotTs === "string"
      ? slotTs.trim()
      : slotTs?.toISOString
        ? slotTs.toISOString()
        : String(slotTs);
  if (s.length < 16) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const dateStr = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  let h = 0,
    m = 0;
  parts.forEach((p) => {
    if (p.type === "hour") h = parseInt(p.value, 10);
    if (p.type === "minute") m = parseInt(p.value, 10);
  });
  if (h === 0 && m === 0) {
    const prevDate = new Date(
      d.getTime() - 24 * 60 * 60 * 1000,
    ).toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
    return { dateStr: prevDate, slotIndex: SLOT_COUNT - 1 };
  }
  const minutesFrom9 = (h - 9) * 60 + m;
  if (minutesFrom9 < 0 || minutesFrom9 > (24 - 9) * 60) return null;
  const slotIndex = Math.min(
    Math.floor(minutesFrom9 / MINUTES_FROM_9),
    SLOT_COUNT - 1,
  );
  return { dateStr, slotIndex };
}

/** 指标配置：导出用名称 + 字段 key，每指标 46 个 20 分钟槽位 */
const METRICS = [
  { name: "商品加购件数", key: "item_cart_cnt" },
  { name: "搜索访客数", key: "search_uv" },
  { name: "搜索转化", key: "search_pay_rate" },
  { name: "购物车访客", key: "cart_uv" },
  { name: "购物车转化", key: "cart_pay_rate" },
];

/**
 * 将原始行按 (date, item_id, item_name) 聚合，得到每个指标在 46 个 20 分钟槽位的值
 * @param {Array<{ item_id, item_name, slot_ts, item_cart_cnt?, search_uv?, search_pay_rate?, cart_uv?, cart_pay_rate? }>} rows
 * @returns {Array<{ date: string, item_name: string, metric: string, slotValues: (number|null)[] }>}
 */
export function goodsDetailRowsToTableRows(rows) {
  const byKey = {};
  const num = (v) =>
    v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  const nonEmptyName = (v) =>
    v != null && String(v).trim() !== "" ? String(v).trim() : "";

  for (const row of rows || []) {
    const parsed = parseSlotTsToDateAndSlot(row.slot_ts);
    if (!parsed) continue;
    const { dateStr, slotIndex } = parsed;
    const itemId = row.item_id ?? "";
    const key = `${dateStr}\t${itemId}`;
    if (!byKey[key]) {
      byKey[key] = {
        date: dateStr,
        item_name: nonEmptyName(row.item_name),
        slotValue: {},
      };
    } else {
      const rec = byKey[key];
      if (!rec.item_name && nonEmptyName(row.item_name))
        rec.item_name = nonEmptyName(row.item_name);
    }
    const rec = byKey[key];
    if (!rec.slotValue[slotIndex]) rec.slotValue[slotIndex] = {};
    rec.slotValue[slotIndex].item_cart_cnt =
      row.item_cart_cnt != null ? Number(row.item_cart_cnt) : null;
    rec.slotValue[slotIndex].search_uv = num(row.search_uv);
    rec.slotValue[slotIndex].search_pay_rate = num(row.search_pay_rate);
    rec.slotValue[slotIndex].cart_uv = num(row.cart_uv);
    rec.slotValue[slotIndex].cart_pay_rate = num(row.cart_pay_rate);
  }

  const tableRows = [];
  for (const rec of Object.values(byKey)) {
    const { date, item_name, slotValue } = rec;
    METRICS.forEach((m) => {
      const slotValues = Array.from({ length: SLOT_COUNT }, (_, i) => {
        const sv = slotValue[i];
        const v = sv && sv[m.key] != null ? sv[m.key] : null;
        return v;
      });
      tableRows.push({
        date,
        item_name,
        metric: m.name,
        slotValues,
      });
    });
  }

  tableRows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.item_name !== b.item_name) return a.item_name.localeCompare(b.item_name);
    return a.metric.localeCompare(b.metric);
  });
  return tableRows;
}

/**
 * 生成与表头.xlsx 一致的二维数组 + 合并信息，并写入 xlsx 下载（20 分钟一列，共 46 列）
 * @param {Array<{ date: string, item_name: string, metric: string, slotValues: (number|null)[] }>} tableRows
 * @param {string} filename 下载文件名（不含路径）
 */
/** 商品名列固定宽度（字符数），过长内容靠换行显示 */
const GOODS_NAME_COLUMN_WCH = 24;

/**
 * 不同日期使用的柔和背景色（ARGB hex），多日期时循环使用
 */
const DATE_BG_COLORS = [
  "FFF0F4F8", // 雾蓝灰
  "FFF5F0F5", // 淡薰衣草
  "FFF2F5F0", // 薄薄荷
  "FFF8F4EE", // 暖米
  "FFF5EEF0", // 浅玫瑰灰
  "FFEEF4F8", // 冰蓝
  "FFF5F2EE", // 杏仁
  "FFF0F5F5", // 青灰
];

export function downloadTableXlsx(tableRows, filename = "小贝壳作战-表格导出.xlsx") {
  const header = ["日期", "商品名", "数据", ...SLOT_LABELS];
  const data = [header];
  const colCount = header.length;
  const emptyRow = () => Array(colCount).fill("");

  let prevDate = null;
  tableRows.forEach((r) => {
    if (prevDate != null && prevDate !== r.date) {
      data.push(emptyRow());
    }
    prevDate = r.date;
    const row = [
      r.date,
      r.item_name,
      r.metric,
      ...r.slotValues.map((v) => (v != null ? v : "")),
    ];
    data.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  const merges = [];
  let i = 1;
  while (i < data.length) {
    while (i < data.length && data[i][0] === "") i++;
    if (i >= data.length) break;
    const date = data[i][0];
    let j = i;
    while (j < data.length && data[j][0] === date) j++;
    if (j > i + 1) {
      merges.push({ s: { r: i, c: 0 }, e: { r: j - 1, c: 0 } });
    }
    i = j;
  }
  i = 1;
  while (i < data.length) {
    while (i < data.length && data[i][0] === "") i++;
    if (i >= data.length) break;
    const date = data[i][0];
    const itemName = data[i][1];
    let j = i;
    while (
      j < data.length &&
      data[j][0] === date &&
      data[j][1] === itemName
    ) {
      j++;
    }
    if (j > i + 1) {
      merges.push({ s: { r: i, c: 1 }, e: { r: j - 1, c: 1 } });
    }
    i = j;
  }
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === "") {
      merges.push({ s: { r: r, c: 0 }, e: { r: r, c: colCount - 1 } });
    }
  }
  if (merges.length) ws["!merges"] = merges;

  const uniqueDates = [];
  const seenDates = new Set();
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === "") continue;
    const d = data[r][0];
    if (!seenDates.has(d)) {
      seenDates.add(d);
      uniqueDates.push(d);
    }
  }
  const dateToColorIndex = new Map(
    uniqueDates.map((d, i) => [d, i % DATE_BG_COLORS.length]),
  );

  const centerAlign = {
    alignment: { horizontal: "center", vertical: "center" },
  };
  const centerWrap = {
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const fillForDate = (colorIndex) => ({
    fill: {
      patternType: "solid",
      fgColor: { rgb: DATE_BG_COLORS[colorIndex] },
    },
  });

  for (let r = 0; r < data.length; r++) {
    const isHeader = r === 0;
    const isEmpty = !isHeader && data[r][0] === "";
    const colorIndex =
      !isHeader && !isEmpty ? dateToColorIndex.get(data[r][0]) ?? 0 : null;

    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      const align = c === 1 ? centerWrap : centerAlign;
      ws[addr].s =
        colorIndex != null
          ? { ...align, ...fillForDate(colorIndex) }
          : align;
    }
  }

  const wch = (str) => {
    const s = String(str ?? "");
    let n = 0;
    for (const ch of s) {
      n += ch.charCodeAt(0) > 255 ? 2 : 1;
    }
    return n;
  };
  const minWidths = [10, 8];
  const maxWch = [0, 0];
  for (let r = 0; r < data.length; r++) {
    maxWch[0] = Math.max(maxWch[0], wch(data[r][0]));
    maxWch[1] = Math.max(maxWch[1], wch(data[r][2]));
  }
  ws["!cols"] = [
    { wch: Math.max(minWidths[0], maxWch[0] + 2) },
    { wch: GOODS_NAME_COLUMN_WCH },
    { wch: Math.max(minWidths[1], maxWch[1] + 2) },
    ...Array(colCount - 3).fill(null),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}
