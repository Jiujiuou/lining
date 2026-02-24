/**
 * content.js - Content Script（内容脚本）
 *
 * 运行环境：在 sycm.taobao.com 页面内、但与页面 JS 隔离（Content Script 的「隔离世界」）。
 * 职责：
 * 1. 向页面注入 inject.js（通过 <script src="chrome-extension://.../inject.js">），让 inject.js 在页面主世界执行
 * 2. 监听自定义事件（sycm-cart-log / sycm-flow-source / sycm-market-rank），将数据写入 Supabase
 *
 * 数据流：inject.js 劫持接口响应 → 派发 CustomEvent(document) → content.js 监听 → 组装 record → fetch POST 到 Supabase
 *
 * 新增上报表：在 SINKS 中增加一项，eventName 与 inject.js 里 SOURCES[].eventName 对应，
 * 指定 table 表名和 valueKey 列名（记录时间的列统一为 created_at，东八区转 ISO 供 timestamptz）。
 */
(function () {
  var PREFIX = '████████████';

  // ========== Supabase 配置 ==========
  // 请在 Supabase 项目 Settings → API 中复制并填写
  var SUPABASE_URL = 'https://ijfzeummbriivdmnhpsi.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_';

  /** 20 分钟槽的分钟数，与报表粒度一致 */
  var THROTTLE_MINUTES = 20;

  /**
   * 从 recordedAt（东八区 "YYYY-MM-DD:HH:mm:ss"）算出所属 20 分钟槽的 key，如 "2025-02-24:09:20"
   */
  function getSlotKey(recordedAtStr) {
    var s = String(recordedAtStr).trim();
    if (s.length < 19 || s[10] !== ':') return '';
    var datePart = s.slice(0, 10);
    var hour = s.slice(11, 13);
    var min = parseInt(s.slice(14, 16), 10);
    var slotMin = Math.floor(min / THROTTLE_MINUTES) * THROTTLE_MINUTES;
    var slotMinStr = (slotMin < 10 ? '0' : '') + slotMin;
    return datePart + ':' + hour + ':' + slotMinStr;
  }

  /**
   * 将东八区时间字符串转为 ISO 格式，供 Supabase timestamptz 使用
   * 输入格式："YYYY-MM-DD:HH:mm:ss"（inject.js 的 getEast8TimeStr 产出）
   * 输出格式："YYYY-MM-DDTHH:mm:ss+08:00"
   */
  function toCreatedAtISO(recordedAt) {
    var s = String(recordedAt).trim();
    if (s.length >= 19 && s[10] === ':') {
      return s.slice(0, 10) + 'T' + s.slice(11, 19) + '+08:00';
    }
    return s;
  }

  /**
   * 向 Supabase 指定表插入一行
   * @param {string} tableName - 表名，如 sycm_cart_log
   * @param {object} record    - 要插入的列对象（必须包含 created_at）
   */
  function sendToSupabase(tableName, record) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn(PREFIX + ' 未配置 SUPABASE_URL / SUPABASE_ANON_KEY，跳过写入');
      return;
    }
    var url = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + encodeURIComponent(tableName);
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'  // 不返回插入后的行，减少流量
      },
      body: JSON.stringify(record)
    }).then(function (res) {
      if (res.ok) {
        console.log(PREFIX + ' 已写入 ' + tableName + ':', record);
      } else {
        return res.text().then(function (t) {
          console.warn(PREFIX + ' Supabase 写入失败', tableName, res.status, t);
        });
      }
    }).catch(function (err) {
      console.warn(PREFIX + ' Supabase 请求异常', tableName, err);
    });
  }

  /**
   * 事件名 → 表名 + 写入方式
   * - eventName: 与 inject.js SOURCES[].eventName 一致，用于监听 CustomEvent
   * - table:     Supabase 表名
   * - valueKey:  单列写入时的列名（如 item_cart_cnt）
   * - fullRecord: 为 true 时 detail.payload 整体作为一行，再补上 created_at
   * - multiRows:  为 true 时 detail.payload.items 数组，每个 item 写一行（用于市场排名多店铺）
   */
  var SINKS = [
    { eventName: 'sycm-cart-log', table: 'sycm_cart_log', valueKey: 'item_cart_cnt' },
    { eventName: 'sycm-flow-source', table: 'sycm_flow_source_log', fullRecord: true },
    { eventName: 'sycm-market-rank', table: 'sycm_market_rank_log', fullRecord: true, multiRows: true }
  ];

  // 为每个 SINK 注册 document 上的自定义事件监听（按 20 分钟槽节流，每槽每 SINK 只写一次）
  SINKS.forEach(function (sink) {
    document.addEventListener(sink.eventName, function (e) {
      var d = e.detail;
      if (!d || !d.recordedAt) return;
      var recordedAt = String(d.recordedAt);
      var slotKey = getSlotKey(recordedAt);
      if (!slotKey) return;
      var storageKey = 'sycm_last_slot_' + sink.eventName;

      chrome.storage.local.get([storageKey], function (result) {
        var lastSlot = result[storageKey];
        if (lastSlot === slotKey) {
          console.log(PREFIX + ' 已捕获 [' + sink.eventName + ']，未写入 Supabase（本 20 分钟时段已写入过）');
          return;
        }

        var createdAt = toCreatedAtISO(recordedAt);

        // 多行写入：如市场排名，一个接口返回多个店铺，每个店铺一行
        if (sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
          d.payload.items.forEach(function (item) {
            sendToSupabase(sink.table, {
              shop_title: item.shop_title,
              rank: item.rank,
              created_at: createdAt
            });
          });
        } else {
          var record;
          if (sink.fullRecord && d.payload && typeof d.payload === 'object') {
            record = {};
            for (var k in d.payload) record[k] = d.payload[k];
            record.created_at = createdAt;
          } else {
            if (typeof d.value === 'undefined') return;
            record = {};
            record[sink.valueKey] = d.value;
            record.created_at = createdAt;
          }
          sendToSupabase(sink.table, record);
        }

        chrome.storage.local.set({ [storageKey]: slotKey }, function () { });
        console.log(PREFIX + ' 已捕获 [' + sink.eventName + ']，已写入 Supabase');
      });
    });
  });

  // ========== 注入 inject.js 到页面 ==========
  // 通过 <script src="chrome-extension://.../inject.js"> 注入，inject.js 在页面主世界执行，可劫持 fetch/XHR
  try {
    console.log(PREFIX + ' content script 已加载，已注册 ' + SINKS.length + ' 个上报');
    var script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function () { this.remove(); };
    script.onerror = function () { console.warn(PREFIX + ' inject.js 加载失败'); };
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    console.warn(PREFIX + ' 出错', e);
  }
})();

