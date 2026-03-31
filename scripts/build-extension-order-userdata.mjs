import { rollup } from 'rollup';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const extensionRoot = path.resolve(workspaceRoot, 'extensions', 'extension-order-userdata');
const distDir = path.join(extensionRoot, 'dist');

function assertInside(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside root: ${target}`);
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

async function buildEntry({ entry, fileName, format, name }) {
  const bundle = await rollup({
    input: entry,
  });

  await bundle.write({
    file: path.join(distDir, fileName),
    format,
    name: format === 'iife' ? name : undefined,
    inlineDynamicImports: true,
  });

  await bundle.close();
}

async function writeManifest() {
  const sourceManifestPath = path.join(extensionRoot, 'src', 'manifest.json');
  const raw = await fs.readFile(sourceManifestPath, 'utf8');
  const manifest = JSON.parse(raw);

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
    resources: ['order-userdata-main.js'],
  }));

  await fs.writeFile(
    path.join(distDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

async function buildExtension() {
  assertInside(extensionRoot, distDir);
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  await Promise.all([
    copyDirectory(path.join(extensionRoot, 'src', 'assets'), path.join(distDir, 'assets')),
    copyFile(path.join(extensionRoot, 'src', 'popup', 'popup.css'), path.join(distDir, 'popup.css')),
    copyFile(path.join(extensionRoot, 'src', 'popup', 'index.html'), path.join(distDir, 'popup.html')),
  ]);

  await buildEntry({
    entry: path.join(extensionRoot, 'src', 'background', 'index.js'),
    fileName: 'background.js',
    format: 'es',
  });

  await buildEntry({
    entry: path.join(extensionRoot, 'src', 'popup', 'index.js'),
    fileName: 'popup.js',
    format: 'es',
  });

  await buildEntry({
    entry: path.join(extensionRoot, 'src', 'content', 'index.js'),
    fileName: 'content.js',
    format: 'iife',
    name: 'OrderUserdataContentBundle',
  });

  await buildEntry({
    entry: path.join(extensionRoot, 'src', 'main', 'index.js'),
    fileName: 'order-userdata-main.js',
    format: 'iife',
    name: 'OrderUserdataMainBundle',
  });

  await writeManifest();
}

buildExtension().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
