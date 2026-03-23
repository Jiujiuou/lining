# 生意参谋市场排名采集（独立扩展）

由 `extension-template` 复制派生，**仅**负责 `rank.json`（`/mc/mq/mkt/item/live/rank.json`）→ Supabase 表 `sycm_market_rank_log`。

## 与 extension-sycm-detail 的关系

- **暂不**从 `extension-sycm-detail` 中移除排名逻辑；待本扩展验证无误后再删旧逻辑，避免双扩展同时开启时重复写入。
- 若两扩展同时启用且都命中同一请求，会**重复插入**同一批排名数据；验证阶段建议只启用其一。

## 行为说明

- **列表来源**：页面请求 `rank.json` 时，从 URL 的 `keyWord=` 参数解析「搜索关键词」（decode 后与 popup 勾选一致），并写入当前标签页分桶的列表。
- **上报条件**：仅在 popup 中**勾选**的关键词，才会把该次响应中的店铺排名写入 Supabase。
- **节流**：按「关键词 + 时间槽（默认 20 分钟）」分别去重，与详情扩展中多商品加购的按 `item_id` 分槽类似。
- **标签隔离**：`rankCatalogByTab`、`rankFilterByTab`、日志 `logsByTab`；关闭标签后 background 会清理对应分桶。

## 加载方式

Chrome「扩展程序 → 加载已解压的扩展程序」→ 选择本目录（含 `manifest.json`）。
