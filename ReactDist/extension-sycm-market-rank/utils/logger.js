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
  function hasRuntime() {
    return typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.sendMessage === "function";
  }
  function sendRuntimeMessage(message, callback) {
    const done = typeof callback === "function" ? callback : null;
    if (!hasRuntime()) {
      if (done) {
        done(null, new Error("chrome.runtime 不可用"));
      }
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError : null;
        if (done) {
          done(response ?? null, lastError ?? null);
        }
      });
    } catch (error) {
      if (done) {
        done(null, error);
      }
    }
  }
  function resolveTabIdByMessage(messageType, callback) {
    const done = typeof callback === "function" ? callback : () => {
    };
    if (!messageType) {
      done(null);
      return;
    }
    sendRuntimeMessage({ type: messageType }, (response, error) => {
      if (error || !response || response.tabId == null) {
        done(null);
        return;
      }
      done(response.tabId);
    });
  }
  function normalizeMaxCount(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.floor(parsed);
  }
  function normalizeEntryList(list, maxEntries) {
    const entries = Array.isArray(list) ? [...list] : [];
    if (entries.length <= maxEntries) {
      return entries;
    }
    return entries.slice(-maxEntries);
  }
  function pruneByTabMeta(byTab, metaKey = "__meta", maxTabs = 6) {
    if (!byTab || typeof byTab !== "object") {
      return {};
    }
    const safeMetaKey = metaKey || "__meta";
    const safeMaxTabs = normalizeMaxCount(maxTabs, 6);
    const nextByTab = { ...byTab };
    const meta = nextByTab[safeMetaKey] && typeof nextByTab[safeMetaKey] === "object" ? { ...nextByTab[safeMetaKey] } : {};
    const tabIds = Object.keys(nextByTab).filter((key) => key !== safeMetaKey);
    tabIds.sort((left, right) => {
      const leftAt = meta[left] || "";
      const rightAt = meta[right] || "";
      return String(leftAt).localeCompare(String(rightAt));
    });
    while (tabIds.length > safeMaxTabs) {
      const oldestTabId = tabIds.shift();
      delete nextByTab[oldestTabId];
      delete meta[oldestTabId];
    }
    nextByTab[safeMetaKey] = meta;
    return nextByTab;
  }
  function createTabLogService(options) {
    const config = options || {};
    const logKey = config.logKey;
    const logsByTabKey = config.logsByTabKey;
    const getTabIdMessageType = config.getTabIdMessageType;
    const maxEntries = normalizeMaxCount(config.maxEntries, 20);
    const maxTabs = normalizeMaxCount(config.maxTabs, 6);
    const metaKey = config.metaKey || "__meta";
    const afterAppend = typeof config.afterAppend === "function" ? config.afterAppend : null;
    if (!logKey || !logsByTabKey) {
      throw new Error("createTabLogService 缺少 logKey 或 logsByTabKey");
    }
    function resolveTabId(callback) {
      if (!getTabIdMessageType) {
        callback(null);
        return;
      }
      resolveTabIdByMessage(getTabIdMessageType, callback);
    }
    function appendLog(level, message) {
      const entry = {
        t: (/* @__PURE__ */ new Date()).toISOString(),
        level: level || "log",
        msg: String(message ?? "")
      };
      resolveTabId(async (tabId) => {
        if (tabId == null) {
          const result2 = await getLocalAsync([logKey]);
          const data = result2[logKey] && typeof result2[logKey] === "object" ? { ...result2[logKey] } : {};
          data.entries = normalizeEntryList(data.entries, maxEntries);
          data.entries.push(entry);
          data.entries = normalizeEntryList(data.entries, maxEntries);
          safeSet({ [logKey]: data }, () => {
          });
          return;
        }
        const result = await getLocalAsync([logsByTabKey]);
        const byTab = result[logsByTabKey] && typeof result[logsByTabKey] === "object" ? { ...result[logsByTabKey] } : {};
        const tabKey = String(tabId);
        const currentBucket = byTab[tabKey] && typeof byTab[tabKey] === "object" ? { ...byTab[tabKey] } : {};
        const entries = normalizeEntryList(currentBucket.entries, maxEntries);
        entries.push(entry);
        currentBucket.entries = normalizeEntryList(entries, maxEntries);
        byTab[tabKey] = currentBucket;
        const meta = byTab[metaKey] && typeof byTab[metaKey] === "object" ? { ...byTab[metaKey] } : {};
        meta[tabKey] = (/* @__PURE__ */ new Date()).toISOString();
        byTab[metaKey] = meta;
        let prunedByTab = pruneByTabMeta(byTab, metaKey, maxTabs);
        const payload = { [logsByTabKey]: prunedByTab };
        safeSet(
          payload,
          () => {
            if (afterAppend) {
              afterAppend(entry, tabId);
            }
          },
          () => {
            prunedByTab = pruneByTabMeta(prunedByTab, metaKey, maxTabs);
            payload[logsByTabKey] = prunedByTab;
            safeSet(payload, () => {
              if (afterAppend) {
                afterAppend(entry, tabId);
              }
            });
          }
        );
      });
    }
    function getLogs(callback, tabId) {
      const done = typeof callback === "function" ? callback : () => {
      };
      if (tabId == null) {
        getLocalAsync([logKey]).then((result) => {
          const data = result[logKey];
          const entries = data && Array.isArray(data.entries) ? data.entries : [];
          done(entries);
        });
        return;
      }
      getLocalAsync([logsByTabKey]).then((result) => {
        const byTab = result[logsByTabKey] && typeof result[logsByTabKey] === "object" ? result[logsByTabKey] : {};
        const bucket = byTab[String(tabId)];
        const entries = bucket && Array.isArray(bucket.entries) ? bucket.entries : [];
        done(entries);
      });
    }
    function clearLogs(callback, tabId) {
      const done = typeof callback === "function" ? callback : () => {
      };
      if (tabId == null) {
        safeSet({ [logKey]: { entries: [] } }, done);
        return;
      }
      getLocalAsync([logsByTabKey]).then((result) => {
        const byTab = result[logsByTabKey] && typeof result[logsByTabKey] === "object" ? { ...result[logsByTabKey] } : {};
        const tabKey = String(tabId);
        delete byTab[tabKey];
        if (byTab[metaKey] && typeof byTab[metaKey] === "object") {
          delete byTab[metaKey][tabKey];
        }
        safeSet({ [logsByTabKey]: byTab }, done);
      });
    }
    return {
      appendLog,
      getLogs,
      clearLogs,
      log: (message) => appendLog("log", message),
      warn: (message) => appendLog("warn", message),
      error: (message) => appendLog("error", message)
    };
  }
  const SYCM_RANK_STORAGE_KEYS = {
    logs: "sycm_rank_only_logs",
    logsByTab: "sycm_rank_only_logs_by_tab"
  };
  const SYCM_RANK_RUNTIME = {
    GET_TAB_ID_MESSAGE: "SYCM_RANK_GET_TAB_ID"
  };
  const SYCM_RANK_LIMITS = {
    LOG_MAX_ENTRIES: 20,
    LOG_MAX_TABS: 6
  };
  const rankLogger = createTabLogService({
    logKey: SYCM_RANK_STORAGE_KEYS.logs,
    logsByTabKey: SYCM_RANK_STORAGE_KEYS.logsByTab,
    getTabIdMessageType: SYCM_RANK_RUNTIME.GET_TAB_ID_MESSAGE,
    maxEntries: SYCM_RANK_LIMITS.LOG_MAX_ENTRIES,
    maxTabs: SYCM_RANK_LIMITS.LOG_MAX_TABS
  });
  globalThis.__SYCM_RANK_LOGGER__ = rankLogger;
})();
//# sourceMappingURL=logger.js.map
