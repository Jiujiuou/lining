(function() {
  "use strict";
  function hasStorageLocal() {
    return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  }
  function isQuotaError(error) {
    if (!error) {
      return false;
    }
    return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(
      String(error.message || error)
    );
  }
  function safeSet(payload, onDone, onQuota) {
    const done = typeof onDone === "function" ? onDone : null;
    const quotaHandler = typeof onQuota === "function" ? onQuota : null;
    if (!hasStorageLocal()) {
      if (done) {
        done();
      }
      return;
    }
    try {
      chrome.storage.local.set(payload, () => {
        const lastError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
        if (lastError && isQuotaError(lastError) && quotaHandler) {
          quotaHandler(() => {
            chrome.storage.local.set(payload, () => {
              if (done) {
                done();
              }
            });
          });
          return;
        }
        if (done) {
          done();
        }
      });
    } catch (error) {
      if (isQuotaError(error) && quotaHandler) {
        quotaHandler(() => {
          chrome.storage.local.set(payload, () => {
            if (done) {
              done();
            }
          });
        });
        return;
      }
      if (done) {
        done();
      }
    }
  }
  function getLocal(keys, callback) {
    const done = typeof callback === "function" ? callback : () => {
    };
    if (!hasStorageLocal()) {
      done({});
      return;
    }
    try {
      chrome.storage.local.get(keys, (result) => {
        done(result || {});
      });
    } catch {
      done({});
    }
  }
  function getLocalAsync(keys) {
    return new Promise((resolve) => {
      getLocal(keys, (result) => resolve(result || {}));
    });
  }
  const AMCR_STORAGE_KEYS = {
    localRegisterByDate: "amcr_local_register_by_date"
  };
  const MAX_DAYS = 1;
  function mergeRegisterBatch(batch, done) {
    const callback = typeof done === "function" ? done : () => {
    };
    if (!batch || typeof batch !== "object" || !batch.report_date || !batch.biz_code || !Array.isArray(batch.rows)) {
      callback();
      return;
    }
    getLocalAsync([AMCR_STORAGE_KEYS.localRegisterByDate]).then((result) => {
      const bag = result[AMCR_STORAGE_KEYS.localRegisterByDate] && typeof result[AMCR_STORAGE_KEYS.localRegisterByDate] === "object" ? { ...result[AMCR_STORAGE_KEYS.localRegisterByDate] } : {};
      const date = String(batch.report_date);
      const keys = Object.keys(bag).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
      for (let i = 0; i < keys.length; i += 1) {
        if (keys[i] !== date) {
          delete bag[keys[i]];
        }
      }
      const current = bag[date] && typeof bag[date] === "object" ? { ...bag[date] } : {};
      const byBiz = current.byBiz && typeof current.byBiz === "object" ? { ...current.byBiz } : {};
      byBiz[batch.biz_code] = batch.rows.map((row) => ({
        campaign_name: row && row.campaign_name != null ? String(row.campaign_name) : "",
        charge: row && row.charge != null ? Number(row.charge) : 0,
        alipay_inshop_amt: row && row.alipay_inshop_amt != null ? Number(row.alipay_inshop_amt) : 0
      }));
      current.byBiz = byBiz;
      current.updated_at_local = (/* @__PURE__ */ new Date()).toISOString();
      bag[date] = current;
      const finalDates = Object.keys(bag).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort((left, right) => left.localeCompare(right));
      while (finalDates.length > MAX_DAYS) {
        delete bag[finalDates.shift()];
      }
      safeSet(
        { [AMCR_STORAGE_KEYS.localRegisterByDate]: bag },
        callback,
        () => {
          while (finalDates.length > 0) {
            delete bag[finalDates.shift()];
          }
          safeSet({ [AMCR_STORAGE_KEYS.localRegisterByDate]: bag }, callback);
        }
      );
    });
  }
  function getStorageKey() {
    return AMCR_STORAGE_KEYS.localRegisterByDate;
  }
  globalThis.__AMCR_LOCAL_REGISTER__ = {
    mergeRegisterBatch,
    getStorageKey
  };
})();
//# sourceMappingURL=local-campaign-register-store.js.map
