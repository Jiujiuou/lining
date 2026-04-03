import path from 'node:path';
import { buildExtension as buildChromeExtension } from './build-extension-lib.mjs';

async function buildCampaignRegisterExtension() {
  const workspaceRoot = process.cwd();
  const extensionRoot = path.resolve(workspaceRoot, 'extensions', 'extension-campaign-register');
  const distDir = path.resolve(workspaceRoot, 'extensions', 'dists', 'dist-campaign-register');

  await buildChromeExtension({
    extensionRoot,
    distDir,
    sourceManifestPath: 'manifest.json',
    copies: [
      { from: 'assets', to: 'assets', directory: true },
      { from: 'popup/popup.css', to: 'popup.css' },
    ],
    popupHtml: { title: 'Campaign Register' },
    entries: [
      { entry: 'background/index.js', fileName: 'background.js', format: 'es' },
      { entry: 'popup/index.jsx', fileName: 'popup.js', format: 'es' },
      {
        entry: 'content/index.js',
        fileName: 'content.js',
        format: 'es',
      },
      {
        entry: 'main/index.js',
        fileName: 'main.js',
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
          matches: ['https://one.alimama.com/*'],
          js: ['content.js'],
          run_at: 'document_start',
          all_frames: true,
        },
        {
          matches: ['https://one.alimama.com/*'],
          js: ['main.js'],
          run_at: 'document_start',
          all_frames: true,
          world: 'MAIN',
        },
      ];

      return manifest;
    },
  });
}

buildCampaignRegisterExtension().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
