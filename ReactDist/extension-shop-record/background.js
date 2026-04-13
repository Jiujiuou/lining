(function() {
  "use strict";
  function initBackground() {
    if (globalThis.__LINING_SHOP_RECORD_BG__) return;
    globalThis.__LINING_SHOP_RECORD_BG__ = true;
    importScripts("constants/defaults.js");
    (function() {
      var SR = self.__SHOP_RECORD_DEFAULTS__;
      if (!SR || !SR.STORAGE_KEYS || !SR.RUNTIME) return;
      var LOG_KEY = SR.STORAGE_KEYS.logs;
      var LOGS_BY_TAB = SR.STORAGE_KEYS.logsByTab;
      var MAX = SR.LOG_MAX_ENTRIES;
      var MAX_TABS = SR.LOG_MAX_TABS || 6;
      var LOG_META_KEY = "__meta";
      function pruneByTab(byTab) {
        if (!byTab || typeof byTab !== "object") return {};
        var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object" ? byTab[LOG_META_KEY] : {};
        var ids = Object.keys(byTab).filter(function(k) {
          return k !== LOG_META_KEY;
        });
        if (ids.length <= MAX_TABS) {
          byTab[LOG_META_KEY] = meta;
          return byTab;
        }
        ids.sort(function(a, b) {
          var ta = meta[a] || "";
          var tb = meta[b] || "";
          return String(ta).localeCompare(String(tb));
        });
        while (ids.length > MAX_TABS) {
          var oldest = ids.shift();
          delete byTab[oldest];
          delete meta[oldest];
        }
        byTab[LOG_META_KEY] = meta;
        return byTab;
      }
      var GET_TAB_MSG = SR.RUNTIME.GET_TAB_ID_MESSAGE;
      var APPEND_MSG = SR.RUNTIME.CONTENT_APPEND_LOG_MESSAGE;
      var FILL_REPORT_MSG = SR.RUNTIME.FILL_REPORT_PAGE_MESSAGE;
      var CONTENT_FILL_MSG = SR.RUNTIME.CONTENT_FILL_REPORT_MESSAGE;
      var REPORT_SUBMIT_URL = SR.REPORT_SUBMIT_PAGE_URL;
      function isQuotaError(err) {
        if (!err) return false;
        var msg = String(err.message || err);
        return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(msg);
      }
      function safeSet(payload, onDone, onQuota) {
        chrome.storage.local.set(payload, function() {
          if (chrome.runtime && chrome.runtime.lastError && isQuotaError(chrome.runtime.lastError) && typeof onQuota === "function") {
            onQuota(function() {
              chrome.storage.local.set(payload, function() {
                if (typeof onDone === "function") onDone();
              });
            });
            return;
          }
          if (typeof onDone === "function") onDone();
        });
      }
      var logQueue = [];
      var logWriting = false;
      function appendLogEntry(tabId, level, msg) {
        var entry = { t: (/* @__PURE__ */ new Date()).toISOString(), level: level || "log", msg: String(msg) };
        if (tabId == null) {
          chrome.storage.local.get([LOG_KEY], function(result) {
            if (chrome.runtime.lastError) {
              logWriting = false;
              flushLogQueue();
              return;
            }
            var data = result[LOG_KEY];
            if (!data || !Array.isArray(data.entries)) data = { entries: [] };
            data.entries.push(entry);
            if (data.entries.length > MAX) data.entries = data.entries.slice(-MAX);
            safeSet({ [LOG_KEY]: data }, function() {
              logWriting = false;
              flushLogQueue();
            });
          });
          return;
        }
        chrome.storage.local.get([LOGS_BY_TAB], function(result) {
          if (chrome.runtime.lastError) {
            logWriting = false;
            flushLogQueue();
            return;
          }
          var byTab = result[LOGS_BY_TAB] || {};
          var bucket = byTab[String(tabId)] || { entries: [] };
          if (!Array.isArray(bucket.entries)) bucket.entries = [];
          bucket.entries.push(entry);
          if (bucket.entries.length > MAX) bucket.entries = bucket.entries.slice(-MAX);
          byTab[String(tabId)] = bucket;
          var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object" ? byTab[LOG_META_KEY] : {};
          meta[String(tabId)] = (/* @__PURE__ */ new Date()).toISOString();
          byTab[LOG_META_KEY] = meta;
          byTab = pruneByTab(byTab);
          var o = {};
          o[LOGS_BY_TAB] = byTab;
          safeSet(o, function() {
            logWriting = false;
            flushLogQueue();
          }, function(retry) {
            byTab = pruneByTab(byTab);
            var o2 = {};
            o2[LOGS_BY_TAB] = byTab;
            safeSet(o2, retry);
          });
        });
      }
      function flushLogQueue() {
        if (logWriting || logQueue.length === 0) return;
        logWriting = true;
        var item = logQueue.shift();
        appendLogEntry(item.tabId, item.level, item.msg);
      }
      function enqueueLog(tabId, level, msg) {
        logQueue.push({ tabId, level, msg });
        flushLogQueue();
      }
      chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request && request.type === GET_TAB_MSG) {
          if (sender.tab && sender.tab.id != null) {
            sendResponse({ tabId: sender.tab.id });
            return true;
          }
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            var id = tabs && tabs[0] && tabs[0].id != null ? tabs[0].id : null;
            sendResponse({ tabId: id });
          });
          return true;
        }
        if (request && request.type === FILL_REPORT_MSG) {
          if (!REPORT_SUBMIT_URL) {
            sendResponse({ ok: false, error: "未配置上报页 URL" });
            return true;
          }
          chrome.tabs.query({ url: "https://oa1.ilanhe.com/*" }, function(tabs) {
            function deliver(tabId2) {
              chrome.tabs.sendMessage(
                tabId2,
                { type: CONTENT_FILL_MSG },
                function(res) {
                  if (chrome.runtime.lastError) {
                    sendResponse({
                      ok: false,
                      error: chrome.runtime.lastError.message || "内容脚本未响应"
                    });
                    return;
                  }
                  sendResponse(res && typeof res === "object" ? res : { ok: false });
                }
              );
            }
            if (tabs && tabs.length > 0) {
              var tid = tabs[0].id;
              chrome.tabs.update(tid, { active: true }, function() {
                setTimeout(function() {
                  deliver(tid);
                }, 400);
              });
            } else {
              chrome.tabs.create({ url: REPORT_SUBMIT_URL }, function(tab) {
                if (!tab || tab.id == null) {
                  sendResponse({ ok: false, error: "无法创建上报页标签" });
                  return;
                }
                var createdId = tab.id;
                var listener = function(tabId2, changeInfo) {
                  if (tabId2 === createdId && changeInfo.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(listener);
                    setTimeout(function() {
                      deliver(createdId);
                    }, 1e3);
                  }
                };
                chrome.tabs.onUpdated.addListener(listener);
              });
            }
          });
          return true;
        }
        if (!request || request.type !== APPEND_MSG) return false;
        var tabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
        enqueueLog(tabId, request.level || "log", request.msg);
        sendResponse({ ok: true });
        return true;
      });
      chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (changeInfo.status !== "complete" || !tab || !tab.url) return;
        var u;
        try {
          u = new URL(tab.url);
        } catch (e) {
          return;
        }
        if (u.hostname === "rate.taobao.com" && (u.pathname || "").indexOf("/user-rate-") === 0) {
          enqueueLog(
            tabId,
            "log",
            "[店铺记录数据] 已打开评价页 " + u.pathname + (u.search ? u.search : "")
          );
        }
      });
      chrome.tabs.onRemoved.addListener(function(tabId) {
        var idStr = String(tabId);
        chrome.storage.local.get([LOGS_BY_TAB], function(r) {
          var byTab = r && r[LOGS_BY_TAB] ? r[LOGS_BY_TAB] : {};
          if (!Object.prototype.hasOwnProperty.call(byTab, idStr)) return;
          delete byTab[idStr];
          if (byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object") {
            delete byTab[LOG_META_KEY][idStr];
          }
          var o = {};
          o[LOGS_BY_TAB] = byTab;
          safeSet(o, function() {
          });
        });
      });
    })();
  }
  initBackground();
})();
//# sourceMappingURL=background.js.map
