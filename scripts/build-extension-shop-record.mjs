import path from 'node:path';
import { buildExtension as buildChromeExtension } from './build-extension-lib.mjs';

async function buildShopRecordExtension() {
  const workspaceRoot = process.cwd();
  const extensionRoot = path.resolve(workspaceRoot, 'extensions', 'extension-shop-record');
  const distDir = path.resolve(workspaceRoot, 'extensions', 'dists', 'dist-shop-record');

  await buildChromeExtension({
    extensionRoot,
    distDir,
    sourceManifestPath: 'manifest.json',
    copies: [
      { from: 'assets', to: 'assets', directory: true },
      { from: 'popup/popup.css', to: 'popup.css' },
    ],
    popupHtml: { title: 'Shop Record' },
    entries: [
      { entry: 'background/index.js', fileName: 'background.js', format: 'es' },
      { entry: 'popup/index.jsx', fileName: 'popup.js', format: 'es' },
      { entry: 'content/index.js', fileName: 'content.js', format: 'es' },
      { entry: 'content/shop-metrics.js', fileName: 'content-shop-metrics.js', format: 'es' },
      { entry: 'content/onebp-bridge.js', fileName: 'content-onebp-bridge.js', format: 'es' },
      { entry: 'content/onebp-main.js', fileName: 'content-onebp-main.js', format: 'es' },
      { entry: 'content/rate-refund-bridge.js', fileName: 'content-rate-refund-bridge.js', format: 'es' },
      { entry: 'content/rate-refund-main.js', fileName: 'content-rate-refund-main.js', format: 'es' },
      { entry: 'content/report-submit.js', fileName: 'content-report-submit.js', format: 'es' },
      { entry: 'content/report-submit-main.js', fileName: 'content-report-submit-main.js', format: 'es' },
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
          matches: ['https://qn.taobao.com/*', 'https://trade.taobao.com/*'],
          js: ['content.js'],
          run_at: 'document_idle',
        },
        {
          matches: ['https://rate.taobao.com/*'],
          js: ['content-rate-refund-bridge.js'],
          run_at: 'document_start',
        },
        {
          matches: ['https://rate.taobao.com/*'],
          js: ['content-rate-refund-main.js'],
          run_at: 'document_start',
          world: 'MAIN',
        },
        {
          matches: ['https://rate.taobao.com/*'],
          js: ['content.js'],
          run_at: 'document_idle',
        },
        {
          matches: ['https://ad.alimama.com/*'],
          js: ['content-shop-metrics.js'],
          run_at: 'document_idle',
        },
        {
          matches: ['https://one.alimama.com/*'],
          js: ['content-onebp-bridge.js'],
          run_at: 'document_start',
        },
        {
          matches: ['https://one.alimama.com/*'],
          js: ['content-onebp-main.js'],
          run_at: 'document_start',
          world: 'MAIN',
        },
        {
          matches: ['https://sycm.taobao.com/*'],
          js: ['content-shop-metrics.js'],
          run_at: 'document_idle',
        },
        {
          matches: ['https://oa1.ilanhe.com/*'],
          js: ['content-report-submit-main.js'],
          run_at: 'document_idle',
          world: 'MAIN',
        },
        {
          matches: ['https://oa1.ilanhe.com/*'],
          js: ['content-report-submit.js'],
          run_at: 'document_idle',
        },
      ];

      return manifest;
    },
  });
}

buildShopRecordExtension().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
