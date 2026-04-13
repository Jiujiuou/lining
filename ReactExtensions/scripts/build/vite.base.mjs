import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pluginBuildConfigs } from '../../build/plugins.config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, '..', '..', '..');
export const pluginsRoot = path.join(repoRoot, 'ReactExtensions', 'plugins');
export const sharedRoot = path.join(repoRoot, 'ReactExtensions', 'shared');

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

function toGlobalName(pluginId, entryName) {
  const source = `RExt_${pluginId}_${entryName}`;
  return source.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function resolveCliPluginId(argv) {
  const args = parseArgs(argv);
  return args.get('--plugin') || args.get('--id') || process.env.REXT_PLUGIN_ID || '';
}

export function resolvePluginRoot(pluginId) {
  return path.join(pluginsRoot, pluginId);
}

export async function loadPluginBuildConfig(pluginId) {
  if (!pluginId) {
    throw new Error('缺少插件标识，请通过 --plugin 传入');
  }

  const pluginRoot = resolvePluginRoot(pluginId);
  const rawConfig = pluginBuildConfigs[pluginId] || {};
  const popupEntry = rawConfig.popupEntry || '';
  const scriptEntries =
    rawConfig.scriptEntries && typeof rawConfig.scriptEntries === 'object'
      ? { ...rawConfig.scriptEntries }
      : {};
  const staticDir = rawConfig.staticDir || '';
  const outDir = rawConfig.outDir || '';

  if (!popupEntry) {
    throw new Error(`插件配置缺少 popup 入口: ${pluginId}`);
  }
  if (Object.keys(scriptEntries).length === 0) {
    throw new Error(`插件配置缺少 scriptEntries: ${pluginId}`);
  }
  if (!staticDir) {
    throw new Error(`插件配置缺少 staticDir: ${pluginId}`);
  }
  if (!outDir) {
    throw new Error(`插件配置缺少 outDir: ${pluginId}`);
  }

  return {
    pluginId,
    pluginRoot,
    popupEntry,
    scriptEntries,
    staticDir: path.resolve(repoRoot, staticDir),
    outDir: path.resolve(repoRoot, outDir),
  };
}

export function resolvePluginDistDir(pluginConfig) {
  return pluginConfig.outDir;
}

function createBaseResolve(pluginRoot) {
  return {
    alias: {
      '@': pluginRoot,
      '@rext-shared': sharedRoot,
    },
  };
}

export function createPopupViteConfig(pluginConfig) {
  const popupInputPath = path.resolve(pluginConfig.pluginRoot, pluginConfig.popupEntry);
  const distDir = resolvePluginDistDir(pluginConfig);

  return defineConfig({
    root: pluginConfig.pluginRoot,
    base: './',
    publicDir: false,
    plugins: [react()],
    resolve: createBaseResolve(pluginConfig.pluginRoot),
    build: {
      outDir: distDir,
      emptyOutDir: true,
      sourcemap: true,
      minify: false,
      cssCodeSplit: true,
      rollupOptions: {
        input: {
          popup: popupInputPath,
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  });
}

export function createScriptViteConfig(pluginConfig, entryName, relativeEntryPath) {
  const entryPath = path.resolve(pluginConfig.pluginRoot, relativeEntryPath);
  const distDir = resolvePluginDistDir(pluginConfig);

  return defineConfig({
    root: pluginConfig.pluginRoot,
    publicDir: false,
    resolve: createBaseResolve(pluginConfig.pluginRoot),
    build: {
      outDir: distDir,
      emptyOutDir: false,
      sourcemap: true,
      minify: false,
      lib: {
        entry: entryPath,
        name: toGlobalName(pluginConfig.pluginId, entryName),
        formats: ['iife'],
        fileName: () => `${entryName}.js`,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  });
}
