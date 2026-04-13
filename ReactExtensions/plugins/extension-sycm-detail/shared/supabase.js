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
  var prefix = opts && opts.prefix ? opts.prefix + " " : "";
  var logger = opts && opts.logger;
  if (!credentials || !credentials.url || !credentials.anonKey) {
    if (logger) logger.appendLog("warn", prefix + "未配置 SUPABASE，跳过写入");
    return Promise.resolve();
  }
  var url =
    credentials.url.replace(/\/$/, "") +
    "/rest/v1/" +
    encodeURIComponent(tableName);
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: credentials.anonKey,
      Authorization: "Bearer " + credentials.anonKey,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(record),
  })
    .then(function (res) {
      if (res.ok) {
        if (logger) logger.appendLog("log", prefix + "已写入 " + tableName);
        return { ok: true };
      }
      return res.text().then(function (t) {
        if (logger)
          logger.appendLog(
            "warn",
            prefix +
              "Supabase 写入失败 " +
              tableName +
              " " +
              res.status +
              " " +
              t,
          );
        return { ok: false };
      });
    })
    .catch(function (err) {
      if (logger)
        logger.appendLog(
          "warn",
          prefix + "Supabase 请求异常 " + tableName + " " + String(err),
        );
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
  var prefix = opts && opts.prefix ? opts.prefix + " " : "";
  var logger = opts && opts.logger;
  if (!credentials || !credentials.url || !credentials.anonKey) {
    if (logger)
      logger.appendLog("warn", prefix + "未配置 SUPABASE，跳过批量写入");
    return Promise.resolve();
  }
  if (!Array.isArray(records) || records.length === 0) return Promise.resolve();
  var url =
    credentials.url.replace(/\/$/, "") +
    "/rest/v1/" +
    encodeURIComponent(tableName);
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: credentials.anonKey,
      Authorization: "Bearer " + credentials.anonKey,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(records),
  })
    .then(function (res) {
      if (res.ok) {
        if (logger)
          logger.appendLog(
            "log",
            prefix + "已批量写入 " + tableName + "，" + records.length + " 行",
          );
        return { ok: true };
      }
      return res.text().then(function (t) {
        if (logger)
          logger.appendLog(
            "warn",
            prefix +
              "Supabase 批量写入失败 " +
              tableName +
              " " +
              res.status +
              " " +
              t,
          );
        return { ok: false };
      });
    })
    .catch(function (err) {
      if (logger)
        logger.appendLog(
          "warn",
          prefix + "Supabase 批量请求异常 " + tableName + " " + String(err),
        );
      return { ok: false };
    });
}

/**
 * 调用 merge_goods_detail_slot_log RPC，按 (item_id, slot_ts) 合并写入
 * @param {object} row - 至少含 item_id, slot_ts；其余列可选（只更新传入的）
 * @param {{ url: string, anonKey: string }} credentials
 * @param {{ prefix?: string, logger?: { appendLog: function(string, string) } }} opts
 */
function mergeGoodsDetailSlot(row, credentials, opts) {
  var prefix = opts && opts.prefix ? opts.prefix + " " : "";
  var logger = opts && opts.logger;
  if (!credentials || !credentials.url || !credentials.anonKey) {
    if (logger)
      logger.appendLog("warn", prefix + "未配置 SUPABASE，跳过 merge");
    return Promise.resolve();
  }
  var url =
    credentials.url.replace(/\/$/, "") +
    "/rest/v1/rpc/merge_goods_detail_slot_log";
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: credentials.anonKey,
      Authorization: "Bearer " + credentials.anonKey,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ p_row: row }),
  })
    .then(function (res) {
      if (res.ok) {
        if (logger)
          logger.appendLog("log", prefix + "已 merge goods_detail_slot_log");
        return { ok: true };
      }
      return res.text().then(function (t) {
        if (logger)
          logger.appendLog(
            "warn",
            prefix + "merge_goods_detail_slot_log 失败 " + res.status + " " + t,
          );
        return { ok: false };
      });
    })
    .catch(function (err) {
      if (logger)
        logger.appendLog("warn", prefix + "merge RPC 请求异常 " + String(err));
      return { ok: false };
    });
}

/**
 * 批量 merge（多商品加购时逐条调用 RPC）
 * @param {object[]} rows - 每项含 item_id, slot_ts 及要写入的列
 */
function mergeGoodsDetailSlotBatch(rows, credentials, opts) {
  if (!Array.isArray(rows) || rows.length === 0)
    return Promise.resolve({ ok: true });
  // 并发执行若干条 RPC，以提高吞吐；默认并发数可由 opts.concurrency 指定
  var concurrency =
    opts && typeof opts.concurrency === "number" && opts.concurrency > 0
      ? opts.concurrency
      : 4;
  var index = 0;
  var inFlight = 0;
  var results = [];
  return new Promise(function (resolve) {
    function next() {
      while (inFlight < concurrency && index < rows.length) {
        (function (row, pos) {
          inFlight++;
          mergeGoodsDetailSlot(row, credentials, opts)
            .then(function (res) {
              results[pos] = res;
            })
            .catch(function (err) {
              results[pos] = { ok: false, error: String(err) };
            })
            .finally(function () {
              inFlight--;
              if (index < rows.length) next();
              else if (inFlight === 0)
                resolve({
                  ok: results.every(function (r) {
                    return r && r.ok;
                  }),
                });
            });
        })(rows[index], index);
        index++;
      }
      // 如果全部分发完成且没有 inFlight，则 resolve
      if (index >= rows.length && inFlight === 0)
        resolve({
          ok: results.every(function (r) {
            return r && r.ok;
          }),
        });
    }
    next();
  });
}

(function (global) {
  (typeof globalThis !== "undefined"
    ? globalThis
    : global
  ).__SYCM_SUPABASE_UTIL__ = {
    sendToSupabase: sendToSupabase,
    batchSendToSupabase: batchSendToSupabase,
    mergeGoodsDetailSlot: mergeGoodsDetailSlot,
    mergeGoodsDetailSlotBatch: mergeGoodsDetailSlotBatch,
  };
})();
