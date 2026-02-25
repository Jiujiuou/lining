/**
 * 向 Supabase 写入单条或批量记录（content 使用）
 * 日志通过 opts.logger 写入 storage，不写 console
 */

/**
 * 单条插入
 * @param {string} tableName
 * @param {object} record - 须含 created_at
 * @param {{ url: string, anonKey: string }} credentials
 * @param {{ prefix?: string, logger?: { appendLog: function(string, string) } }} opts - 可选，logger 用于写扩展日志
 */
function sendToSupabase(tableName, record, credentials, opts) {
  var prefix = opts && opts.prefix ? opts.prefix + ' ' : '';
  var logger = opts && opts.logger;
  if (!credentials || !credentials.url || !credentials.anonKey) {
    if (logger) logger.appendLog('warn', prefix + '未配置 SUPABASE，跳过写入');
    return Promise.resolve();
  }
  var url = credentials.url.replace(/\/$/, '') + '/rest/v1/' + encodeURIComponent(tableName);
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': credentials.anonKey,
      'Authorization': 'Bearer ' + credentials.anonKey,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(record)
  }).then(function (res) {
    if (res.ok) {
      if (logger) logger.appendLog('log', prefix + '已写入 ' + tableName);
      return { ok: true };
    }
    return res.text().then(function (t) {
      if (logger) logger.appendLog('warn', prefix + 'Supabase 写入失败 ' + tableName + ' ' + res.status + ' ' + t);
      return { ok: false };
    });
  }).catch(function (err) {
    if (logger) logger.appendLog('warn', prefix + 'Supabase 请求异常 ' + tableName + ' ' + String(err));
    return { ok: false };
  });
}

/**
 * 批量插入（同一表多行，一次 POST）
 * @param {string} tableName
 * @param {object[]} records - 每项须含 created_at
 * @param {{ url: string, anonKey: string }} credentials
 * @param {{ prefix?: string, logger?: { appendLog: function(string, string) } }} opts
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
      'apikey': credentials.anonKey,
      'Authorization': 'Bearer ' + credentials.anonKey,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(records)
  }).then(function (res) {
    if (res.ok) {
      if (logger) logger.appendLog('log', prefix + '已批量写入 ' + tableName + '，' + records.length + ' 行');
      return { ok: true };
    }
    return res.text().then(function (t) {
      if (logger) logger.appendLog('warn', prefix + 'Supabase 批量写入失败 ' + tableName + ' ' + res.status + ' ' + t);
      return { ok: false };
    });
  }).catch(function (err) {
    if (logger) logger.appendLog('warn', prefix + 'Supabase 批量请求异常 ' + tableName + ' ' + String(err));
    return { ok: false };
  });
}

(function (global) {
  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_SUPABASE_UTIL__ = {
    sendToSupabase: sendToSupabase,
    batchSendToSupabase: batchSendToSupabase
  };
})();
