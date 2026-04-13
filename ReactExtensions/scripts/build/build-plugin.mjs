import path from 'node:path';
import fs from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import {
  createPopupViteConfig,
  createScriptViteConfig,
  loadPluginBuildConfig,
  resolvePluginDistDir,
  resolveCliPluginId,
  resolvePluginRoot,
} from './vite.base.mjs';
import { writeIconsForPlugin } from './render-extension-icons.mjs';

const PLUGIN_ICON_LABELS = {
  'extension-order-userdata': ['订单', '导出'],
  'extension-sycm-market-rank': ['市场', '排名'],
  'extension-campaign-register': ['推广', '登记'],
  'extension-sycm-detail': ['实时', '详情'],
  'extension-shop-record': ['店铺', '记录'],
};

const FALLBACK_POPUP_TEMPLATE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Popup</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/entries/popup-main.jsx"></script>
  </body>
</html>
`;


async function assertExists(targetPath, label) {
  try {
    await fs.access(targetPath);
  } catch {
    throw new Error(`${label} 不存在: ${targetPath}`);
  }
}

async function ensurePopupTemplate(pluginConfig) {
  const popupPath = path.resolve(pluginConfig.pluginRoot, pluginConfig.popupEntry);
  try {
    await fs.access(popupPath);
    return popupPath;
  } catch {
    await fs.writeFile(popupPath, FALLBACK_POPUP_TEMPLATE, 'utf8');
    return popupPath;
  }
}

async function verifyPluginInput(pluginConfig) {
  const popupPath = path.resolve(pluginConfig.pluginRoot, pluginConfig.popupEntry);
  await assertExists(popupPath, 'popup 入口');

  const entries = Object.entries(pluginConfig.scriptEntries || {});
  if (entries.length === 0) {
    throw new Error('scriptEntries 为空');
  }

  for (const [entryName, relativePath] of entries) {
    const absolutePath = path.resolve(pluginConfig.pluginRoot, relativePath);
    await assertExists(absolutePath, `脚本入口 ${entryName}`);
  }

  await assertExists(pluginConfig.staticDir, '插件配置目录');
  await assertExists(path.join(pluginConfig.staticDir, 'manifest.json'), 'manifest.json');
}

async function removeDistGitkeep(pluginConfig) {
  const gitkeepPath = path.join(resolvePluginDistDir(pluginConfig), '.gitkeep');
  try {
    await fs.unlink(gitkeepPath);
  } catch {
    // 没有 .gitkeep 时忽略
  }
}

async function normalizePopupHtmlName(pluginConfig) {
  const distDir = resolvePluginDistDir(pluginConfig);
  const tempHtmlPath = path.join(distDir, '.rext-popup.html');
  const popupHtmlPath = path.join(distDir, 'popup.html');
  try {
    await fs.rename(tempHtmlPath, popupHtmlPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`popup 模板重命名失败，缺少文件: ${tempHtmlPath}`);
    }
    throw error;
  }
}

async function copyManifestToDist(pluginConfig) {
  const sourceManifestPath = path.join(pluginConfig.staticDir, 'manifest.json');
  const distManifestPath = path.join(resolvePluginDistDir(pluginConfig), 'manifest.json');
  const content = await fs.readFile(sourceManifestPath, 'utf8');
  await fs.writeFile(distManifestPath, content, 'utf8');
}

async function ensurePluginIcons(pluginConfig) {
  const labels = PLUGIN_ICON_LABELS[pluginConfig.pluginId];
  if (!Array.isArray(labels) || labels.length !== 2) {
    return;
  }
  await writeIconsForPlugin(pluginConfig.pluginId, labels);
}

async function cleanupTempPopup(pluginConfig) {
  const popupPath = path.resolve(pluginConfig.pluginRoot, pluginConfig.popupEntry);
  if (path.basename(popupPath) !== '.rext-popup.html') {
    return;
  }
  try {
    await fs.unlink(popupPath);
  } catch {
    // 忽略删除失败
  }
}

export async function buildPlugin(pluginId) {
  if (!pluginId) {
    throw new Error('请传入插件标识');
  }

  const pluginRoot = resolvePluginRoot(pluginId);
  console.log(`开始构建插件: ${pluginId}`);
  console.log(`插件目录: ${pluginRoot}`);

  const pluginConfig = await loadPluginBuildConfig(pluginId);
  await ensurePopupTemplate(pluginConfig);
  await verifyPluginInput(pluginConfig);

  try {
    console.log('步骤 1/2: 构建 popup（React）');
    await build(createPopupViteConfig(pluginConfig));
    await normalizePopupHtmlName(pluginConfig);
    await copyManifestToDist(pluginConfig);

    const scriptEntries = Object.entries(pluginConfig.scriptEntries);
    for (let i = 0; i < scriptEntries.length; i += 1) {
      const [entryName, relativePath] = scriptEntries[i];
      console.log(`步骤 2/2: 构建脚本 ${i + 1}/${scriptEntries.length} -> ${entryName}`);
      await build(createScriptViteConfig(pluginConfig, entryName, relativePath));
    }

    await removeDistGitkeep(pluginConfig);
    await ensurePluginIcons(pluginConfig);
    console.log(`构建完成: ${pluginId}`);
  } finally {
    await cleanupTempPopup(pluginConfig);
  }
}

async function main() {
  const pluginId = resolveCliPluginId(process.argv.slice(2));
  if (!pluginId) {
    console.error('请传入插件标识，例如: --plugin extension-order-userdata');
    process.exit(1);
  }
  await buildPlugin(pluginId);
}

const directRunUrl =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (directRunUrl && import.meta.url === directRunUrl) {
  main().catch((error) => {
    console.error('构建失败:', error.message);
    process.exit(1);
  });
}
