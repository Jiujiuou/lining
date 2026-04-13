import process from 'node:process';
import { pluginBuildConfigs } from '../../build/plugins.config.mjs';
import { buildPlugin } from './build-plugin.mjs';

async function main() {
  const pluginIds = Object.keys(pluginBuildConfigs);
  if (pluginIds.length === 0) {
    console.error('未发现可构建插件（配置为空）');
    process.exit(1);
  }

  console.log(`开始全量构建，共 ${pluginIds.length} 个插件`);
  for (const pluginId of pluginIds) {
    console.log(`\n构建插件: ${pluginId}`);
    await buildPlugin(pluginId);
  }
  console.log('\n全量构建完成');
}

main().catch((error) => {
  console.error('全量构建失败:', error.message);
  process.exit(1);
});
