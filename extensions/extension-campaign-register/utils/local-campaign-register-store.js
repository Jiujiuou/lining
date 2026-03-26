/**
 * 将推广登记行按 report_date 分桶写入 chrome.storage.local（按 biz 覆盖该次登记行，与云端上报成败无关）
 */
(function (global) {
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
      var o = {};
      o[storageKey] = bag;
      chrome.storage.local.set(o, function () {
        if (typeof done === 'function') done();
      });
    });
  }

  var api = { mergeRegisterBatch: mergeRegisterBatch, getStorageKey: getStorageKey };
  (typeof globalThis !== 'undefined' ? globalThis : global).__AMCR_LOCAL_REGISTER__ = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
