import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { pluginBuildConfigs } from '../../build/plugins.config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const reactDistRoot = path.join(repoRoot, 'ReactDist');

const ICON_SIZES = [16, 32, 48, 128];

const PLUGIN_LABELS = {
  'extension-order-userdata': ['订单', '导出'],
  'extension-sycm-market-rank': ['市场', '排名'],
  'extension-campaign-register': ['推广', '登记'],
  'extension-sycm-detail': ['实时', '详情'],
  'extension-shop-record': ['店铺', '记录'],
  'extension-douyin-follow-manager': ['抖音', '关注'],
};

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function buildSvg(lines) {
  const [topLine, bottomLine] = lines.map(escapeXml);
  const fontSize = 60;
  const offset = (128 - 2 * fontSize) / 2;
  const cellCenter = (col, row) => ({
    x: offset + fontSize * (col + 0.5),
    y: offset + fontSize * (row + 0.5),
  });
  const writeText = (x, y, char) =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="PingFang SC, Hiragino Sans GB, STHeiti, Microsoft YaHei, sans-serif" font-size="${fontSize}" font-weight="700">${char}</text>`;

  const tl = cellCenter(0, 0);
  const tr = cellCenter(1, 0);
  const bl = cellCenter(0, 1);
  const br = cellCenter(1, 1);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" fill="#0d9488"/>
  ${writeText(tl.x, tl.y, topLine[0] ?? '')}
  ${writeText(tr.x, tr.y, topLine[1] ?? '')}
  ${writeText(bl.x, bl.y, bottomLine[0] ?? '')}
  ${writeText(br.x, br.y, bottomLine[1] ?? '')}
</svg>
`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeIconsForPlugin(pluginId, lines) {
  const assetsDir = path.join(reactDistRoot, pluginId, 'assets');
  await ensureDir(assetsDir);

  const svgText = buildSvg(lines);
  const svgBuffer = Buffer.from(svgText, 'utf8');
  await fs.writeFile(path.join(assetsDir, 'icon.svg'), svgBuffer);

  for (const size of ICON_SIZES) {
    const pngBuffer = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    await fs.writeFile(path.join(assetsDir, `icon-${size}.png`), pngBuffer);
  }
}

export async function renderAllExtensionIcons() {
  const pluginIds = Object.keys(pluginBuildConfigs);
  console.log('开始生成 ReactDist 图标资源');

  for (const pluginId of pluginIds) {
    const lines = PLUGIN_LABELS[pluginId];
    if (!Array.isArray(lines) || lines.length !== 2) {
      throw new Error(`图标文案缺失: ${pluginId}`);
    }
    await writeIconsForPlugin(pluginId, lines);
    console.log(`已生成图标: ${pluginId}`);
  }

  console.log('图标生成完成');
}

async function main() {
  await renderAllExtensionIcons();
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main().catch((error) => {
    console.error('图标生成失败:', error.message);
    process.exit(1);
  });
}
