# 生意参谋市场排名（独立扩展）

监听生意参谋页面发起的 **`/mc/mq/mkt/item/live/rank.json`** 请求（URL 查询参数任意，**有/无 `keyWord` 均会处理**）。

## 行为

1. **inject.js**（页面主世界）拦截 `fetch` / `XMLHttpRequest`（含相对 URL），读取 JSON 后通过 **`window.postMessage`** 把 `{ source: 'sycm-rank-extension', requestUrl, data }` 发给 **content script**。  
   （仅用 `CustomEvent` 在隔离环境下可能收不到，故以 `postMessage` 为主通道。）
2. **content.js** 解析结构同 `src/response.json`：`data.data.data.data[]`，取 **`shop.title`（popup、控制台与上报均为店铺名）**、`item.itemId`（勾选键）、`cateRankId.value`，写入扩展日志并 `chrome.runtime.sendMessage` 交给 background。
3. **background.js** 保存列表快照后，按 **popup 中已保存的勾选**（`itemId` 或 `idx-行号`）过滤行，将 **`shop_title`（店铺名）+ `rank`** 批量 **POST** 到 Supabase 表 **`sycm_market_rank_log`**（建表见本目录 **`supabase_sycm_market_rank_log.sql`**）。
4. 若未勾选、或勾选与当前列表无交集，日志会说明原因，不会写入 Supabase。
5. **20 分钟时间槽**：按 URL 中的 **搜索词 `keyWord`** 分桶，同一关键词在同一东八区时间槽内仅 **首次** 勾选命中时写入 Supabase；重复请求会记日志说明「本时间槽已上报过」。槽长可用 `chrome.storage.local` 的键 **`sycm_rank_only_throttle_minutes`**（数字）覆盖，默认 20。
6. **每次**监听到 `rank.json` 都会在页面 **Console** 打印一行 `监听到 rank.json`；扩展 **日志** 与 **Console** 第二行会说明本次 **是否写入 Supabase** 及原因。

## 加载

Chrome「扩展程序 → 加载已解压的扩展程序」→ 选择本目录。修改 `manifest` 后需重新加载扩展。
