# 扩展模板（复制用）

从现有扩展中抽出的**最小可运行骨架**：`manifest`（MV3）、`constants/defaults.js`、`utils/logger.js`（写入 `chrome.storage` 供 popup 展示）、**左右分栏 popup**（与 `extension-campaign-register` 一致：左上控制区、左下主内容区暂空白，右侧日志）。

## 使用方式

1. **复制整个文件夹**（例如 `extension-template` → `extension-my-feature`）。
2. 在副本内**全局替换**（区分大小写一致）：
   - `extension-template` → 你的目录名/资源名（如 `extension-my-feature`）
   - `__EXT_TEMPLATE_DEFAULTS__` → `__YOUR_FEATURE_DEFAULTS__`（与 `defaults.js` 中一致）
   - `__EXT_TEMPLATE_LOGGER__` → `__YOUR_FEATURE_LOGGER__`
   - `ext_template_logs` → 唯一的 storage 键名（如 `my_feature_logs`）
   - `EXT_TEMPLATE` 注释与 manifest 中的 `name` / `description` / 标题文案
3. 编辑 **`manifest.json`**：`host_permissions`、`content_scripts.matches`、按需增加 `permissions`（如 `scripting`、`tabs`）。
4. 在 **`content.js`**（或你拆分的脚本）中实现页面逻辑；通过 `__YOUR_FEATURE_LOGGER__.log/warn/error` 写日志。
5. 在 Chrome「扩展程序 → 加载已解压的扩展程序」中选择**副本文件夹**。

## 本模板不应直接加载为正式扩展

默认 `content_scripts` 使用 `https://example.com/*`，仅用于占位；复制后请改为真实业务域名。

## 方案说明

**复制文件夹再改**适合 MV3 扩展（每个扩展必须是独立目录与独立 `manifest`）。若将来插件很多、希望共享同一份 `logger` 源码，可考虑用构建脚本从单一包生成多个扩展目录，但当前以「模板 + 复制」成本最低、最直观。
