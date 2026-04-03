import path from 'node:path';
import { buildExtension as buildChromeExtension } from './build-extension-lib.mjs';

async function buildSycmMarketRankExtension() {
  const workspaceRoot = process.cwd();
  const extensionRoot = path.resolve(workspaceRoot, 'extensions', 'extension-sycm-market-rank');
  const distDir = path.resolve(workspaceRoot, 'extensions', 'dists', 'dist-sycm-market-rank');

  await buildChromeExtension({
    extensionRoot,
    distDir,
    sourceManifestPath: 'manifest.json',
    copies: [
      { from: 'assets', to: 'assets', directory: true },
      { from: 'popup/popup.css', to: 'popup.css' },
    ],
    popupHtml: { title: 'Sycm Market Rank' },
    entries: [
      { entry: 'background/index.js', fileName: 'background.js', format: 'es' },
      { entry: 'popup/index.jsx', fileName: 'popup.js', format: 'es' },
      {
        entry: 'content/index.js',
        fileName: 'content.js',
        format: 'es',
      },
      {
        entry: 'main/inject.js',
        fileName: 'inject.js',
        format: 'es',
      },
    ],
    transformManifest(manifest) {
      manifest.background = {
        service_worker: 'background.js',
        type: 'module',
      };

      manifest.action = {
        ...manifest.action,
        default_popup: 'popup.html',
      };

      manifest.content_scripts = (manifest.content_scripts || []).map((contentScript) => ({
        ...contentScript,
        js: ['content.js'],
      }));

      manifest.web_accessible_resources = (manifest.web_accessible_resources || []).map((resource) => ({
        ...resource,
        resources: ['inject.js'],
      }));

      return manifest;
    },
  });
}

buildSycmMarketRankExtension().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
