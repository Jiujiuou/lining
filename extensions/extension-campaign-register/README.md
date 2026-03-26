# 万相台推广登记（独立扩展）

从主扩展「数据获取」中拆出的能力：**仅在 one.alimama.com 拦截推广列表 findPage，弹窗内勾选后登记到本地存储**。

## 与主扩展的关系

| 项目 | 本扩展 | 主扩展 `extensions/extension-sycm-detail` |
|------|--------|-------------------------------------------|
| 生意参谋抓数 | 无 | 有 |
| 万相台推广登记 | 有 | 无（仅本扩展负责） |
| `chrome.storage.local` | 使用 `amcr_*` 键 | 使用 `sycm_logs` 等键 |
| 日志 | `amcr_logs` | `sycm_logs` |

可同时加载；万相台页按需只启用本扩展即可。

## 安装

Chrome → 扩展程序 → 开发者模式 → 「加载已解压的扩展程序」→ 选择 **`extensions/extension-campaign-register`**（相对仓库根目录）。

## 使用

1. 用弹窗四个按钮打开对应推广记录页（日期为东八区昨天）。
2. 在万相台页面展开列表，待接口返回后打开本扩展弹窗，应看到「推广列表」。
3. 勾选计划，点 **登记**（需当前万相台标签页日期为单日）。
4. 右侧可执行本地操作：清空本地、刷新列表、导出表格（Excel）。

## 说明

- 当前版本已移除云端上报逻辑，数据仅保存在 `chrome.storage.local`。
- `sql/` 目录保留为历史脚本参考，不参与扩展运行。

## 文件说明

- `capture-findpage-main.js`：主世界拦截 `/campaign/horizontal/findPage.json`
- `capture-findpage-cs.js`：写入 `amcr_findPageResponse` 等
- `popup.js`：打开链接、列表渲染、本地登记、导出、日志
