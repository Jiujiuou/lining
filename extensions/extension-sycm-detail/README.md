# 生意参谋详情数据（扩展）

Chrome 扩展：在 **sycm.taobao.com** 商品详情相关页面监听配置中的接口，将加购/搜索等指标写入 **Supabase**（`goods_detail_slot_log` 等）。弹窗内可查看扩展日志。

## manifest.json 字段说明（阅读用，JSON 不支持注释）

| 字段 | 含义 |
|------|------|
| `manifest_version: 3` | Manifest V3 |
| `name` / `description` | 在 chrome://extensions 中显示（当前名称：**生意参谋详情数据**） |
| `host_permissions` | sycm.taobao.com、\*.supabase.co |
| `action.default_popup` | 扩展图标弹窗（日志） |
| `web_accessible_resources` | 页面可加载 `inject.js`、`constants/config.js` |
| `content_scripts` | `document_start` 注入 content.js，`all_frames: true` |

## 安装（开发者模式）

1. Chrome 打开 `chrome://extensions/`，开启 **开发者模式**
2. **加载已解压的扩展程序** → 选择本仓库目录 **`extensions/extension-sycm-detail`**（内含 `manifest.json`）
3. 列表中应出现 **「生意参谋详情数据」**，保持启用

## 验证

1. 登录后打开生意参谋商品详情相关页面（`https://sycm.taobao.com/...`）
2. 打开开发者工具 Console，过滤 **`[Sycm Data Capture]`** 查看注入与数据日志
3. 若扩展未生效：在 `chrome://extensions/` 中对该扩展点击 **重新加载** 后刷新页面

## 与其它扩展

- **万相台推广登记**、**订单用户数据导出** 已拆到同级目录，见仓库 **`extensions/README.md`**。

## 目录结构（概要）

```
extension-sycm-detail/
├── manifest.json
├── content.js / inject.js
├── constants/ … utils/
├── popup.html / popup.js
├── supabase_*.sql
└── ARCHITECTURE.md
```
