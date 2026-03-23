/**
 * 批量写入 sycm_market_rank_log
 */
function batchSendToSupabase(tableName, records, credentials, opts) {
  var prefix = opts && opts.prefix ? opts.prefix + ' ' : '';
  var logger = opts && opts.logger;
  if (!credentials || !credentials.url || !credentials.anonKey) {
    if (logger) logger.appendLog('warn', prefix + '未配置 SUPABASE，跳过批量写入');
    return Promise.resolve();
  }
  if (!Array.isArray(records) || records.length === 0) return Promise.resolve();
  var url = credentials.url.replace(/\/$/, '') + '/rest/v1/' + encodeURIComponent(tableName);
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: credentials.anonKey,
      Authorization: 'Bearer ' + credentials.anonKey,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(records)
  })
    .then(function (res) {
      if (res.ok) {
        if (logger) logger.appendLog('log', prefix + '已批量写入 ' + tableName + '，' + records.length + ' 行');
        return { ok: true };
      }
      return res.text().then(function (t) {
        if (logger) logger.appendLog('warn', prefix + 'Supabase 批量写入失败 ' + tableName + ' ' + res.status + ' ' + t);
        return { ok: false };
      });
    })
    .catch(function (err) {
      if (logger) logger.appendLog('warn', prefix + 'Supabase 批量请求异常 ' + tableName + ' ' + String(err));
      return { ok: false };
    });
}

(function (global) {
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_SUPABASE_UTIL__ = {
    batchSendToSupabase: batchSendToSupabase
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
