# 万相台推广登记（独立扩展）

从主扩展「数据获取」中拆出的能力：**仅在 one.alimama.com 拦截推广列表 findPage，弹窗内勾选后登记到 Supabase**（`campaign_register_upsert_by_biz`）。

## 与主扩展的关系

| 项目 | 本扩展 | 主扩展 `src/extension` |
|------|--------|-------------------------|
| 生意参谋抓数 | 无 | 有 |
| 万相台推广登记 | 有 | 已移除（仅本扩展负责） |
| `chrome.storage.local` | 使用 `amcr_*` 键 | 使用 `findPage*` 等键 |
| 日志 | `amcr_logs` | `sycm_logs` |

**并行验证**：可同时加载两个扩展；在万相台页面上，两个扩展都会注入主世界 hook，但列表与日志互不覆盖。验证本扩展登记正常后，再在主扩展中删除 findPage 相关代码并停用重复能力即可。

## 安装

Chrome → 扩展程序 → 开发者模式 → 「加载已解压的扩展程序」→ 选择本目录 `src/extension-campaign-register`。

## 使用

1. 用弹窗四个按钮打开对应推广记录页（日期为东八区昨天）。
2. 在万相台页面展开列表，待接口返回后打开本扩展弹窗，应看到「推广列表」。
3. 勾选计划，点 **登记**（需当前万相台标签页日期为单日）。
4. Supabase 配置在 `constants/supabase.js`，需与主扩展一致方可写入同一套表。

## 数据库脚本

建表与 RPC 见 **`sql/`** 目录及其中 `README.md`（执行顺序）。

## 文件说明

- `capture-findpage-main.js`：主世界拦截 `/campaign/horizontal/findPage.json`
- `capture-findpage-cs.js`：写入 `amcr_findPageResponse` 等
- `popup.js`：打开链接、列表渲染、登记 RPC、日志
