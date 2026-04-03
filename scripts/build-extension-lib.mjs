import { rollup } from 'rollup';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

function jsxTransformPlugin() {
  return {
    name: 'extension-jsx-transform',
    async transform(sourceCode, id) {
      if (!id || id.includes('node_modules')) return null;

      const ext = path.extname(id).toLowerCase();
      if (!['.js', '.mjs', '.jsx'].includes(ext)) return null;

      const transformed = await transform(sourceCode, {
        loader: ext === '.jsx' ? 'jsx' : 'js',
        jsx: 'automatic',
        format: 'esm',
        target: 'es2020',
        sourcemap: false,
        sourcefile: id,
      });

      return {
        code: transformed.code,
        map: null,
      };
    },
  };
}

function assertPathInside(root, target, label) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} is outside allowed root: ${target}`);
  }
}

async function copyFile(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      continue;
    }
    await copyFile(sourcePath, destinationPath);
  }
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderPopupHtml(options = {}) {
  const title = escapeHtmlAttr(options.title || 'Extension Popup');
  const lang = escapeHtmlAttr(options.lang || 'zh-CN');
  const includeFonts = options.includeFonts !== false;

  const fontLinks = includeFonts
    ? `\n    <link rel="preconnect" href="https://fonts.googleapis.com" />\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link\n      href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600&display=swap"\n      rel="stylesheet"\n    />`
    : '';

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="popup.css" />${fontLinks}
  </head>
  <body>
    <div id="popup-react-root"></div>
    <script type="module" src="./popup.js"></script>
  </body>
</html>
`;
}

async function buildEntry(outDir, { entry, fileName, format, name }) {
  const bundle = await rollup({
    input: entry,
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      jsxTransformPlugin(),
    ],
  });

  await bundle.write({
    file: path.join(outDir, fileName),
    format,
    name: format === 'iife' ? name : undefined,
    inlineDynamicImports: true,
  });

  await bundle.close();
}

export async function buildExtension(config) {
  const {
    extensionRoot,
    copies,
    entries,
    sourceManifestPath,
    transformManifest,
    distDir,
    popupHtml,
  } = config;
  const workspaceRoot = path.resolve(process.cwd());
  const resolvedExtensionRoot = path.resolve(extensionRoot);
  const outputDir = path.resolve(distDir || path.join(extensionRoot, 'dist'));

  assertPathInside(workspaceRoot, outputDir, 'Build output directory');
  if (outputDir === workspaceRoot) {
    throw new Error(`Refusing to use workspace root as output directory: ${outputDir}`);
  }

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  if (Array.isArray(copies) && copies.length > 0) {
    await Promise.all(
      copies.map((item) => {
        const from = path.resolve(resolvedExtensionRoot, item.from);
        const to = path.resolve(outputDir, item.to || item.from);
        assertPathInside(resolvedExtensionRoot, from, 'Copy source');
        assertPathInside(outputDir, to, 'Copy destination');
        return item.directory ? copyDirectory(from, to) : copyFile(from, to);
      }),
    );
  }

  for (const entry of entries) {
    const resolvedEntry = path.resolve(resolvedExtensionRoot, entry.entry);
    assertPathInside(resolvedExtensionRoot, resolvedEntry, 'Build entry file');
    await buildEntry(outputDir, {
      ...entry,
      entry: resolvedEntry,
    });
  }

  const manifestPath = path.resolve(resolvedExtensionRoot, sourceManifestPath);
  assertPathInside(resolvedExtensionRoot, manifestPath, 'Manifest path');
  const rawManifest = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(rawManifest);
  const nextManifest = typeof transformManifest === 'function' ? transformManifest(manifest) : manifest;

  await fs.writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(nextManifest, null, 2)}\n`,
    'utf8',
  );

  if (popupHtml) {
    const popupOptions =
      typeof popupHtml === 'object' && popupHtml !== null
        ? popupHtml
        : {};
    const htmlContent = renderPopupHtml({
      title: popupOptions.title || nextManifest.name || 'Extension Popup',
      lang: popupOptions.lang || 'zh-CN',
      includeFonts: popupOptions.includeFonts,
    });
    await fs.writeFile(path.join(outputDir, 'popup.html'), htmlContent, 'utf8');
  }
}
