# 生意参谋 top.json 数据监听扩展

Chrome 扩展：在 **sycm.taobao.com** 页面内监听接口  
`https://sycm.taobao.com/cc/item/live/view/top.json` 的响应，并把返回数据打印到控制台，用于验证是否能拿到数据。

## manifest.json 字段说明（阅读用，JSON 不支持注释）

| 字段 | 含义 |
|------|------|
| `manifest_version: 3` | 使用 Manifest V3，Chrome 新扩展标准 |
| `name` / `description` | 扩展名称与描述，在 chrome://extensions 中显示 |
| `permissions: ["scripting"]` | 允许 background 用 `chrome.scripting.executeScript` 向页面注入脚本 |
| `host_permissions` | 可访问 sycm.taobao.com（页面请求）和 *.supabase.co（content 写库） |
| `background.service_worker` | 后台常驻脚本，负责在 sycm 页面加载完成时注入 inject.js |
| `action.default_popup` | 点击扩展图标时打开的弹窗页面 |
| `web_accessible_resources` | 允许 sycm 页面通过扩展 URL 加载 inject.js（content 里 `<script src="...">`） |
| `content_scripts` | 在 sycm 页面注入 content.js；`run_at: document_start` 尽早执行，`all_frames: true` 包含 iframe |

## 技术方案（第一版：控制台打印）

1. **运行环境**  
   - 扩展的 content script 在 `document_start` 时注入到 `https://sycm.taobao.com/*`。
   - 在**页面上下文**（与页面 JS 同一世界）里注入一段脚本，这样才能拦截页面自己发起的 `fetch` / `XMLHttpRequest`。

2. **拦截方式**  
   - 重写 `window.fetch`：在返回的 `Response` 上判断 URL 是否包含 `/cc/item/live/view/top.json`，若是则 `response.clone().json()` 后 `console.log`。
   - 重写 `XMLHttpRequest.prototype.open` / `send`：对同一条 URL 的 XHR 在 `load` 时读取 `responseText`，`JSON.parse` 后 `console.log`。
   - 这样无论页面用 fetch 还是 XHR 请求该接口，都能在控制台看到一次「收到 top.json 数据」及完整 JSON。

3. **不涉及后台/权限**  
   - 仅使用 `host_permissions: ["https://sycm.taobao.com/*"]`，无其它权限；不连你的后端、不写数据库，只做本地打印。

## 安装步骤（开发者模式）

1. 打开 Chrome，地址栏输入：`chrome://extensions/`
2. 右上角打开 **「开发者模式」**
3. 点击 **「加载已解压的扩展程序」**
4. 选择本目录：**`lining/src/extension`**（即包含 `manifest.json` 的文件夹）
5. 列表中应出现「生意参谋 top.json 数据监听」，保持启用。

## 如何验证是否获取到数据

1. **先登录生意参谋**  
   - 在 Chrome 中打开：  
     `https://sycm.taobao.com/cc/item_rank?dateRange=2026-02-15%7C2026-02-15&dateType=today`  
   - 用你的淘宝/千牛账号登录，确保页面能正常看到「商品直播榜」等数据。

2. **打开该页面的开发者工具**  
   - 在该标签页按 `F12` 或 右键 →「检查」，切到 **Console** 面板。

3. **看控制台输出**  
   - 若扩展在本页生效，会先看到（来自 content script）：  
     `[Sycm Data Capture] content script 已加载（若看不到本扩展其它日志，请确认地址栏是 https://sycm.taobao.com/...）`  
   - 随后应看到（来自注入到页面的 inject.js）：  
     `[Sycm Data Capture] 已注入，正在监听 /cc/item/live/view/top.json`
   - 之后每当页面请求一次 `top.json`（例如每分钟自动刷新），会出现：  
     - `[Sycm Data Capture] 收到 top.json 数据:` 后面是解析后的对象  
     - `[Sycm Data Capture] 完整 JSON:` 后面是格式化的 JSON 字符串  

4. **若连「content script 已加载」都没有**  
   - 确认地址栏当前 URL 是 **https://sycm.taobao.com/...**（不是其它淘宝子域名）。  
   - 打开 `chrome://extensions/`，找到「生意参谋 top.json 数据监听」，确认已启用，并点击 **刷新** 图标重新加载扩展后再试。  
   - 确认加载的扩展目录是 **lining 项目下的 src/extension**（包含 manifest.json、content.js、inject.js 的文件夹）。

5. **若一直没看到「收到 top.json 数据」**  
   - 确认当前 URL 是 `https://sycm.taobao.com/...`（不要是 iframe 里的其它域名）。  
   - 刷新页面（F5）再等 1～2 分钟，看是否在下次自动请求时打印。  
   - 若接口返回的是未登录（如 `{"code":5810,"msg":"You must login system first."}`），控制台也会打印出来，可据此确认「请求已被监听到」，只是接口本身要求登录。

6. **只看本扩展的日志（推荐）**  
   - 控制台里会有大量生意参谋页面自己的报错（如 mmstat.com、gm.mmstat.com 的 `net::ERR_CONNECTION_CLOSED`），**这些不是本扩展导致的**。  
   - 在 Console 顶部的过滤框输入：`[Sycm Data Capture]`，只显示本扩展的「已注入」和「收到 top.json 数据」等日志。

## 关于控制台里的其他报错

以下报错**来自生意参谋页面本身**，与本扩展无关，可忽略或通过上述过滤只看扩展日志：

- **`log.mmstat.com` / `gm.mmstat.com` / `hd.mmstat.com` 等 `net::ERR_CONNECTION_CLOSED`**  
  页面发起的统计/打点请求被断开（常见原因：广告拦截、防火墙、VPN 或网络限制）。
- **`chrome-extension://invalid/`**  
  页面在检测浏览器扩展，不是本扩展发起的请求。
- **`Mixed Content`（http://err.taobao.com/...）**  
  页面自身混合内容被浏览器拦截。

本扩展仅在控制台输出带 **`[Sycm Data Capture]`** 前缀的日志，且不会主动请求任何第三方域名。

## 目录结构

```
src/extension/
├── manifest.json   # 扩展配置（Manifest V3），字段说明见上文
├── background.js   # Service Worker：sycm 页面加载完成时注入 inject.js，启动时对已开 sycm 补注入
├── content.js      # Content Script：注入 inject.js 到页面主世界 + 监听 CustomEvent 写 Supabase
├── inject.js       # 页面主世界脚本：劫持 fetch/XHR、伪造 visibility、按 SOURCES 提取数据并派发事件
├── popup.html      # 点击扩展图标时的弹窗（当前仅标题）
├── supabase_sycm_log.sql  # Supabase 建表与 RLS 策略，在 SQL Editor 中执行
└── README.md       # 本说明
```

第一版仅做「控制台打印」验证；确认能稳定拿到数据后，再在扩展里把数据发到你的后端或 Supabase。
