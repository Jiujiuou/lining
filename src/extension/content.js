/**
 * 在 sycm.taobao.com 加载时：1）打日志确认扩展已运行；2）注入 inject.js；3）按配置接收事件并写入对应 Supabase 表。
 *
 * 新增上报表：在 SINKS 中增加一项，eventName 与 inject.js 里 SOURCES[].eventName 对应，
 * 指定 table 表名和 valueKey 列名（记录时间的列统一为 recorded_at）。
 */
(function () {
  var PREFIX = '[Sycm Data Capture]';
  // 请在 Supabase 项目 Settings → API 中复制并填写
  var SUPABASE_URL = 'https://ijfzeummbriivdmnhpsi.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_';

  /**
   * 通用：向指定表插入一行（value 列 + recorded_at）。
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
        'Prefer': 'return=minimal'
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
   * 事件名 → 表名 + 数值列名。inject.js 派发 detail 为 { value, recordedAt } 或 { payload, recordedAt }（多列）。
   */
  var SINKS = [
    { eventName: 'sycm-cart-log', table: 'sycm_cart_log', valueKey: 'item_cart_cnt' },
    { eventName: 'sycm-flow-source', table: 'sycm_flow_source_log', fullRecord: true },
    { eventName: 'sycm-market-rank', table: 'sycm_market_rank_log', fullRecord: true, multiRows: true }
  ];

  SINKS.forEach(function (sink) {
    document.addEventListener(sink.eventName, function (e) {
      var d = e.detail;
      if (!d || !d.recordedAt) return;
      var recordedAt = String(d.recordedAt);
      if (sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
        d.payload.items.forEach(function (item) {
          sendToSupabase(sink.table, {
            shop_title: item.shop_title,
            rank: item.rank,
            recorded_at: recordedAt
          });
        });
        return;
      }
      var record;
      if (sink.fullRecord && d.payload && typeof d.payload === 'object') {
        record = {};
        for (var k in d.payload) record[k] = d.payload[k];
        record.recorded_at = recordedAt;
      } else {
        if (typeof d.value === 'undefined') return;
        record = {};
        record[sink.valueKey] = d.value;
        record.recorded_at = recordedAt;
      }
      sendToSupabase(sink.table, record);
    });
  });

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
