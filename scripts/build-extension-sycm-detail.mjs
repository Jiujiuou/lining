import path from 'node:path';
import { buildExtension as buildChromeExtension } from './build-extension-lib.mjs';

async function buildSycmDetailExtension() {
  const workspaceRoot = process.cwd();
  const extensionRoot = path.resolve(workspaceRoot, 'extensions', 'extension-sycm-detail');
  const distDir = path.resolve(workspaceRoot, 'extensions', 'dists', 'dist-sycm-detail');

  await buildChromeExtension({
    extensionRoot,
    distDir,
    sourceManifestPath: 'manifest.json',
    copies: [
      { from: 'assets', to: 'assets', directory: true },
      { from: 'popup/popup.css', to: 'popup.css' },
    ],
    popupHtml: { title: 'Sycm Detail' },
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
      {
        entry: 'main/flow-source-poller.js',
        fileName: 'flow-source-poller.js',
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

      manifest.content_scripts = [
        {
          matches: ['https://sycm.taobao.com/*'],
          js: ['content.js'],
          run_at: 'document_start',
          all_frames: true,
        },
      ];

      manifest.web_accessible_resources = [
        {
          resources: ['inject.js', 'flow-source-poller.js'],
          matches: ['https://sycm.taobao.com/*'],
        },
      ];

      return manifest;
    },
  });
}

buildSycmDetailExtension().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
