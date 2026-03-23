# Chrome 扩展（本目录）

| 目录 | 说明 |
|------|------|
| **extension-template** | 新插件模板：MV3、`defaults` + `logger`、左右分栏 popup（主区占位 + 日志）；复制后按 README 替换命名与域名 |
| **extension-shop-record** | 店铺记录数据（由模板派生）：默认匹配千牛 / 已卖出订单，骨架 + 注入日志 |
| **extension-sycm-detail** | 生意参谋 `sycm.taobao.com` 商品详情槽数据 → Supabase |
| **extension-sycm-market-rank** | 生意参谋市场排名 `rank.json` 单独采集 → Supabase（popup 勾选关键词后上报；按 tab 隔离） |
| **extension-campaign-register** | 万相台 `one.alimama.com` 推广列表登记 → Supabase |
| **extension-order-userdata** | 千牛/淘宝已卖出订单导出买家昵称等 CSV |

在 Chrome「扩展程序 → 加载已解压的扩展程序」中分别选择上表对应**文件夹**（内含 `manifest.json`）。**不要**将 `extension-template` 当作正式扩展长期使用，请复制后改名。
