/**
 * Renders each extension assets/icon.svg and icon-16/32/48/128.png from two-line labels.
 * Requires Node 18 or newer (sharp). On macOS, system Chinese fonts are used for text.
 */
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const exts = [
  { dir: "extension-shop-record", lines: ["店铺", "记录"] },
  { dir: "extension-sycm-detail", lines: ["实时", "数据"] },
  { dir: "extension-sycm-market-rank", lines: ["市场", "排名"] },
  { dir: "extension-campaign-register", lines: ["推广", "登记"] },
  { dir: "extension-order-userdata", lines: ["订单", "导出"] },
  { dir: "extension-template", lines: ["扩展", "模板"] },
];

/** 128×128 画布内 2×2 宫格，每格边长 = 字号；字号取 (当前, 64] 之间，留少量边距避免裁切 */
function svgFor(lines) {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const [a, b] = lines.map(esc);
  const sz = 60;
  const offset = (128 - 2 * sz) / 2;
  const cell = (col, row) => ({
    x: offset + sz * (col + 0.5),
    y: offset + sz * (row + 0.5),
  });
  const t = (x, y, ch) =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="PingFang SC, Hiragino Sans GB, STHeiti, Microsoft YaHei, sans-serif" font-size="${sz}" font-weight="700" letter-spacing="0">${ch}</text>`;
  const tl = cell(0, 0);
  const tr = cell(1, 0);
  const bl = cell(0, 1);
  const br = cell(1, 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" fill="#0d9488"/>
  ${t(tl.x, tl.y, a[0])}
  ${t(tr.x, tr.y, a[1])}
  ${t(bl.x, bl.y, b[0])}
  ${t(br.x, br.y, b[1])}
</svg>`;
}

for (const { dir, lines } of exts) {
  const svg = svgFor(lines);
  const base = path.join(root, "extensions", dir, "assets");
  await fs.writeFile(path.join(base, "icon.svg"), Buffer.from(svg, "utf8"));
  for (const size of [16, 32, 48, 128]) {
    const png = await sharp(Buffer.from(svg, "utf8")).resize(size, size).png().toBuffer();
    await fs.writeFile(path.join(base, `icon-${size}.png`), png);
  }
}
console.log("ok");
