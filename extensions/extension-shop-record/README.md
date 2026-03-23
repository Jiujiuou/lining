# 店铺记录数据

基于 `extension-template` 创建：MV3 + 与 `extension-campaign-register` 相同的左右布局（左上控制区、左下主内容区暂空白，右侧日志）+ 内容脚本占位。

## 当前状态

- 默认在 **千牛**（`qn.taobao.com`）与 **已卖出订单**（`trade.taobao.com`）注入 `content.js`，仅写一条启动日志，便于确认扩展已加载。
- **采集与上报逻辑待实现**：在 `content.js`（或新增脚本并在 `manifest.json` 中注册）中编写；通过 `__SHOP_RECORD_LOGGER__.log/warn/error` 输出到右侧日志区。

## 加载

Chrome「扩展程序 → 加载已解压的扩展程序」→ 选择本文件夹。

若目标页面不在上述域名，请修改 `manifest.json` 中的 `host_permissions` 与 `content_scripts[0].matches`。
