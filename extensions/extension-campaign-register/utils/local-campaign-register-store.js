/**
 * 将推广登记行按 report_date 分桶写入 chrome.storage.local（按 biz 覆盖该次登记行，与云端上报成败无关）
 */
(function (global) {
  var MAX_DAYS = 1;
  function isQuotaError(err) {
    if (!err) return false;
    return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(String(err.message || err));
  }
  function safeSet(payload, cb) {
    chrome.storage.local.set(payload, function () {
      if (chrome.runtime && chrome.runtime.lastError && isQuotaError(chrome.runtime.lastError)) {
        return cb && cb(true);
      }
      if (cb) cb(false);
    });
  }

  function getStorageKey() {
    var d = typeof __AMCR_DEFAULTS__ !== 'undefined' ? __AMCR_DEFAULTS__ : null;
    if (d && d.STORAGE_KEYS && d.STORAGE_KEYS.localRegisterByDate) {
      return d.STORAGE_KEYS.localRegisterByDate;
    }
    return 'amcr_local_register_by_date';
  }

  /**
   * @param {{ report_date: string, biz_code: string, rows: Array<{campaign_name?: string, charge?: number, alipay_inshop_amt?: number}> }} batch
   * @param {function=} done
   */
  function mergeRegisterBatch(batch, done) {
    if (!batch || typeof batch !== 'object' || !batch.report_date || !batch.biz_code || !Array.isArray(batch.rows)) {
      if (typeof done === 'function') done();
      return;
    }
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      if (typeof done === 'function') done();
      return;
    }
    var storageKey = getStorageKey();
    chrome.storage.local.get([storageKey], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) {
        if (typeof done === 'function') done();
        return;
      }
      var bag = result[storageKey];
      if (!bag || typeof bag !== 'object') bag = {};
      var date = String(batch.report_date);
      var keys = Object.keys(bag).filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); });
      if (keys.length > 0) {
        // 仅保留 1 天，写入新日期时清空旧日期，避免长期累积。
        for (var i = 0; i < keys.length; i++) {
          if (keys[i] !== date) delete bag[keys[i]];
        }
      }
      var cur = bag[date];
      if (!cur || typeof cur !== 'object') cur = {};
      if (!cur.byBiz || typeof cur.byBiz !== 'object') cur.byBiz = {};
      var cloned = batch.rows.map(function (r) {
        return {
          campaign_name: r && r.campaign_name != null ? String(r.campaign_name) : '',
          charge: r && r.charge != null ? Number(r.charge) : 0,
          alipay_inshop_amt: r && r.alipay_inshop_amt != null ? Number(r.alipay_inshop_amt) : 0
        };
      });
      cur.byBiz[batch.biz_code] = cloned;
      cur.updated_at_local = new Date().toISOString();
      bag[date] = cur;
      var finalDates = Object.keys(bag).filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }).sort();
      while (finalDates.length > MAX_DAYS) {
        delete bag[finalDates.shift()];
      }
      var o = {};
      o[storageKey] = bag;
      safeSet(o, function (quotaErr) {
        if (quotaErr) {
          while (finalDates.length > 0) {
            delete bag[finalDates.shift()];
          }
          o[storageKey] = bag;
          return safeSet(o, function () {
            if (typeof done === 'function') done();
          });
        }
        if (typeof done === 'function') done();
      });
    });
  }

  var api = { mergeRegisterBatch: mergeRegisterBatch, getStorageKey: getStorageKey };
  (typeof globalThis !== 'undefined' ? globalThis : global).__AMCR_LOCAL_REGISTER__ = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
