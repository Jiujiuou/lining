# 数据获取扩展 - 架构说明

## 一、运行环境与数据流概览

```
用户打开/刷新 sycm.taobao.com
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Content Script 世界（隔离，与页面 JS 不共享 window）              │
│  manifest 按顺序加载：constants/defaults, config, supabase,       │
│  utils/time, utils/supabase, utils/storage → content.js          │
│                                                                   │
│  content.js：                                                     │
│  1) 向页面插入 <script src="constants/config.js">                 │
│  2) config 加载完成后插入 <script src="inject.js">                │
│  3) 监听 document 上的 CustomEvent（sycm-cart-log 等）            │
│  4) 按节流槽去重后 POST 到 Supabase（单条或批量）                 │
└─────────────────────────────────────────────────────────────────┘
        │
        │  <script> 注入
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  页面主世界（Main World，与生意参谋页面 JS 共享 window）           │
│                                                                   │
│  constants/config.js 先执行 → 设置 window.__SYCM_CONFIG__          │
│  inject.js 再执行 → 读取 __SYCM_CONFIG__.pipelines，              │
│  劫持 fetch / XMLHttpRequest，命中 URL 时解析 JSON、              │
│  extractValue、派发 CustomEvent(document)                        │
└─────────────────────────────────────────────────────────────────┘
        │
        │  Supabase REST API
        ▼
  Supabase 表（sycm_cart_log / sycm_flow_source_log / sycm_market_rank_log）
```

## 二、为何需要 inject.js（Main World）

- Content Script 运行在「隔离世界」，无法访问页面的 `window.fetch`、`XMLHttpRequest`。
- 要拦截生意参谋的接口响应，必须在**页面主世界**重写 `fetch` / XHR，因此通过 `<script>` 把 `config.js` 和 `inject.js` 注入到主世界执行。

## 三、注入方式（仅 content 的 script 注入）

- **唯一注入路径**：由 content.js 在页面中插入两个 `<script>`：先 `constants/config.js`，再 `inject.js`。
- background.js 不再使用 `chrome.scripting.executeScript` 注入；若需「先开页面后装扩展」的补注入，可后续在 background 里对已打开的 sycm 标签发消息，由 content 侧再次插入 script（当前未实现）。

## 四、统一配置（constants/config.js）

- **PIPELINES**：一条配置同时描述「抓数」与「写库」。
  - inject 使用：`urlContains`、`urlFilter`、`eventName`、`extractValue`、`multiValue`、`multiRows`。
  - content 使用：`eventName`、`table`、`valueKey`、`fullRecord`、`multiRows`。
- 新增数据源只需在 `constants/config.js` 的 `PIPELINES` 里增加一项，并确保 Supabase 有对应表（见 `supabase_sycm_log.sql`）。

## 五、节流与时间

- **节流粒度**：可配置（默认 20 分钟）。同一「时间槽」内同一 `eventName` 只写入一次；槽 key 由 `utils/time.js` 的 `getSlotKey(recordedAt, throttleMinutes)` 计算。
- **节流配置**：存于 `chrome.storage.local` 的 `sycm_throttle_minutes`，popup 可读写；content 写库前读取，未设置则用默认值。
- **东八区时间**：inject 侧用 `getEast8TimeStr()` 生成 `recordedAt`；content 侧用 `toCreatedAtISO()` 转为 Supabase 的 `timestamptz` 格式。

## 六、多行写入（multiRows）与批量

- 如市场排名接口返回多店铺，`extractValue` 返回 `{ items: [{ shop_title, rank }, ...] }`。
- content 将同一批 `items` 组装成多行 `created_at` 相同的 record，调用 **batchSendToSupabase** 一次 POST 多行，减少请求次数。

## 七、文件职责简表

| 文件 | 环境 | 职责 |
|------|------|------|
| manifest.json | - | 声明 content_scripts 顺序、web_accessible_resources、popup、background |
| constants/defaults.js | Content / 注入后 Main | 默认节流分钟数、storage key、PREFIX |
| constants/config.js | Content / 注入后 Main | 统一 PIPELINES（URL、事件名、表、提取函数等） |
| constants/supabase.js | Content | Supabase URL / anonKey（后续可改为 storage 或后端） |
| utils/time.js | Content | getSlotKey、toCreatedAtISO |
| utils/supabase.js | Content | sendToSupabase、batchSendToSupabase |
| utils/storage.js | Content / Popup | 节流分钟、lastSlot、lastWrite 的 get/set |
| content.js | Content | 注入 config→inject、监听事件、节流去重、写 Supabase、更新 lastWrite |
| inject.js | Main World | 劫持 fetch/XHR、伪造 visibility、派发 CustomEvent |
| background.js | Service Worker | 当前无注入逻辑，预留扩展能力 |
| popup.html / popup.js | 扩展弹窗 | 节流配置、最近写入状态展示 |

## 八、Storage 键

- `sycm_throttle_minutes`：节流粒度（分钟），数字。
- `sycm_last_slot_<eventName>`：各数据源上一写入时间槽 key，用于去重。
- `sycm_last_write`：`{ at, slotKey, eventName }`，供 popup 展示「最近一次写入」。
