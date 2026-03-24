/**
 * 店铺记录扩展：Supabase 简易 upsert 工具
 */
function upsertDailyRow(tableName, row, credentials, options) {
  var opts = options || {};
  var conflict = opts.conflict || "report_at";
  var logger = opts.logger;
  var prefix = opts.prefix ? opts.prefix + " " : "";

  if (!credentials || !credentials.url || !credentials.anonKey) {
    if (logger) logger("warn", prefix + "未配置 SUPABASE，跳过上报");
    return Promise.resolve({ ok: false, skipped: true });
  }

  var base = credentials.url.replace(/\/$/, "");
  var url =
    base +
    "/rest/v1/" +
    encodeURIComponent(tableName) +
    "?on_conflict=" +
    encodeURIComponent(conflict);

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: credentials.anonKey,
      Authorization: "Bearer " + credentials.anonKey,
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(row)
  })
    .then(function (res) {
      if (res.ok) return { ok: true };
      return res.text().then(function (t) {
        if (logger) logger("warn", prefix + "Supabase upsert 失败 " + res.status + " " + t);
        return { ok: false };
      });
    })
    .catch(function (err) {
      if (logger) logger("warn", prefix + "Supabase upsert 异常 " + String(err));
      return { ok: false };
    });
}

(function (global) {
  (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_SUPABASE_UTIL__ = {
    upsertDailyRow: upsertDailyRow
  };
})();
