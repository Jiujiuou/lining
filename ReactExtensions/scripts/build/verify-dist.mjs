import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const contractsPath = path.join(
  repoRoot,
  'ReactExtensions',
  'contracts',
  'compatibility-baseline.json',
);
const reactDistRoot = path.join(repoRoot, 'ReactDist');

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) {
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(current, next);
      i += 1;
    } else {
      args.set(current, 'true');
    }
  }
  return args;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonStrict(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON 解析失败: ${filePath}\n${error.message}`);
  }
}

function collectManifestReferencedFiles(manifest) {
  const files = new Set();

  if (manifest?.background?.service_worker) {
    files.add(manifest.background.service_worker);
  }
  if (manifest?.action?.default_popup) {
    files.add(manifest.action.default_popup);
  }

  for (const item of manifest?.content_scripts ?? []) {
    for (const script of item?.js ?? []) {
      files.add(script);
    }
  }

  for (const war of manifest?.web_accessible_resources ?? []) {
    for (const resource of war?.resources ?? []) {
      files.add(resource);
    }
  }

  for (const iconPath of Object.values(manifest?.icons ?? {})) {
    if (typeof iconPath === 'string' && iconPath) {
      files.add(iconPath);
    }
  }

  for (const iconPath of Object.values(manifest?.action?.default_icon ?? {})) {
    if (typeof iconPath === 'string' && iconPath) {
      files.add(iconPath);
    }
  }

  return [...files];
}

async function verifyPluginDist(pluginId, errors, warnings) {
  const pluginDist = path.join(reactDistRoot, pluginId);
  const pluginExists = await fileExists(pluginDist);
  if (!pluginExists) {
    errors.push(`[${pluginId}] 缺少产物目录: ${pluginDist}`);
    return;
  }

  const manifestPath = path.join(pluginDist, 'manifest.json');
  const manifestExists = await fileExists(manifestPath);
  if (!manifestExists) {
    errors.push(`[${pluginId}] 缺少 manifest.json: ${manifestPath}`);
    return;
  }

  const manifest = await readJsonStrict(manifestPath);

  const hardRequired = [
    ['background.service_worker', manifest?.background?.service_worker],
    ['action.default_popup', manifest?.action?.default_popup],
  ];

  for (const [label, value] of hardRequired) {
    if (!value || typeof value !== 'string') {
      errors.push(`[${pluginId}] manifest 字段缺失或非法: ${label}`);
    }
  }

  if (!Array.isArray(manifest?.content_scripts) || manifest.content_scripts.length === 0) {
    errors.push(`[${pluginId}] manifest.content_scripts 为空`);
  }

  const referencedFiles = collectManifestReferencedFiles(manifest);
  for (const relativeFile of referencedFiles) {
    const absoluteFile = path.join(pluginDist, relativeFile);
    const exists = await fileExists(absoluteFile);
    if (!exists) {
      errors.push(`[${pluginId}] manifest 引用文件不存在: ${relativeFile}`);
    }
  }

  const popupHtmlPath = path.join(pluginDist, 'popup.html');
  const popupHtmlExists = await fileExists(popupHtmlPath);
  if (!popupHtmlExists) {
    errors.push(`[${pluginId}] 缺少 popup.html`);
  }

  const popupJsPath = path.join(pluginDist, 'popup.js');
  const popupJsExists = await fileExists(popupJsPath);
  if (!popupJsExists) {
    errors.push(`[${pluginId}] 缺少 popup.js`);
  }

  const assetsPath = path.join(pluginDist, 'assets');
  const assetsExists = await fileExists(assetsPath);
  if (!assetsExists) {
    errors.push(`[${pluginId}] 缺少 assets 目录`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contracts = await readJsonStrict(contractsPath);
  const allPluginIds = Object.keys(contracts?.plugins ?? {});

  if (allPluginIds.length === 0) {
    throw new Error('兼容基线中未找到插件列表');
  }

  const pluginArg = args.get('--plugin') ?? args.get('--plugins') ?? '';
  const pluginIds = pluginArg
    ? pluginArg.split(',').map((item) => item.trim()).filter(Boolean)
    : allPluginIds;

  const invalid = pluginIds.filter((pluginId) => !allPluginIds.includes(pluginId));
  if (invalid.length > 0) {
    throw new Error(`基线中不存在这些插件: ${invalid.join(', ')}`);
  }

  const errors = [];
  const warnings = [];

  console.log(`开始校验 ReactDist 产物，目标插件数: ${pluginIds.length}`);
  for (const pluginId of pluginIds) {
    console.log(`校验插件: ${pluginId}`);
    await verifyPluginDist(pluginId, errors, warnings);
  }

  if (warnings.length > 0) {
    console.log('\n提示信息:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error('\n校验失败:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('\n校验通过: ReactDist 产物结构完整且 manifest 可严格解析。');
}

main().catch((error) => {
  console.error('执行失败:', error.message);
  process.exit(1);
});
