(function() {
  "use strict";
  (function(global) {
    var DEFAULTS = {
      /** 节流粒度（分钟），同一时间槽内同一数据源只写一次；可被 chrome.storage sycm_throttle_minutes 覆盖 */
      THROTTLE_MINUTES: 20
    };
    var STORAGE_KEYS = {
      throttleMinutes: "sycm_throttle_minutes",
      lastSlotPrefix: "sycm_last_slot_",
      logs: "sycm_logs",
      /** Record<tabIdStr, { entries }> — 按标签页隔离扩展日志 */
      logsByTab: "sycm_logs_by_tab",
      /** 最近一次 foucs/live.json 或 live/view/top.json 解析出的商品列表（供 popup 展示） */
      liveJsonCatalog: "sycm_live_json_catalog",
      /** { itemIds: string[] } — 仅上报已勾选并保存的 item_id（20 分钟时间槽不变） */
      liveJsonFilter: "sycm_live_json_filter",
      /** Record<tabIdStr, { itemIds }> — 按标签页隔离勾选，避免多开互相覆盖 */
      liveJsonFilterByTab: "sycm_live_json_filter_by_tab",
      /** Record<tabIdStr, { updatedAt, items }> — 按标签页隔离商品列表 */
      liveJsonCatalogByTab: "sycm_live_json_catalog_by_tab",
      /** Record<tabIdStr, { url, capturedAt }> — 详情 flow-source 请求模板（用于列表页批量重放） */
      flowSourceTemplateByTab: "sycm_flow_source_template_by_tab",
      /** Record<tabIdStr, { intervalSec, enabled }> — 轮询设置（仅 UI/控制用） */
      flowPollSettingsByTab: "sycm_flow_poll_settings_by_tab"
    };
    var LOG_MAX_ENTRIES = 20;
    var LOG_MAX_TABS = 6;
    var LIVE_JSON_MAX_TABS = 6;
    var LIVE_JSON_MAX_ITEMS = 200;
    var PREFIX = "";
    var obj = {
      DEFAULTS,
      STORAGE_KEYS,
      LOG_MAX_ENTRIES,
      LOG_MAX_TABS,
      LIVE_JSON_MAX_TABS,
      LIVE_JSON_MAX_ITEMS,
      PREFIX
    };
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_DEFAULTS__ = obj;
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod$6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_DEFAULTS__ = mod$6;
  (function(global) {
    function walkByPageName(nodes, name) {
      if (!Array.isArray(nodes)) return null;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.pageName && n.pageName.value === name) return n;
        if (n.children && n.children.length) {
          var found = walkByPageName(n.children, name);
          if (found) return found;
        }
      }
      return null;
    }
    function extractSycmItemListWithCart(data) {
      var inner = data && data.data && data.data.data;
      var list = inner && inner.data;
      if (!Array.isArray(list) || list.length === 0) return void 0;
      var items = [];
      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        var itemId = row.item && row.item.itemId || row.itemId && (row.itemId.value != null ? row.itemId.value : row.itemId);
        var title = row.item && row.item.title;
        var cnt = row.itemCartCnt;
        var itemCartCnt = cnt != null && typeof cnt.value !== "undefined" ? Number(cnt.value) : typeof cnt === "number" ? cnt : null;
        if (!itemId) continue;
        items.push({
          item_id: String(itemId),
          item_name: title ? String(title) : "",
          item_cart_cnt: itemCartCnt != null && !isNaN(itemCartCnt) ? itemCartCnt : null
        });
      }
      return items.length ? { items } : void 0;
    }
    var PIPELINES = [
      // 多商品加购：关注列表 live.json → goods_detail_slot_log（merge），popup 同步列表
      {
        eventName: "sycm-goods-live",
        urlContains: "/cc/item/view/foucs/live.json",
        urlFilter: null,
        multiValue: true,
        multiRows: true,
        mergeGoodsDetail: true,
        extractValue: extractSycmItemListWithCart
      },
      // 多商品加购：实时 top 榜 top.json（结构同 live），同一 eventName / 白名单 / 时间槽 / popup 列表
      {
        eventName: "sycm-goods-live",
        urlContains: "/cc/item/live/view/top.json",
        urlFilter: null,
        multiValue: true,
        multiRows: true,
        mergeGoodsDetail: true,
        extractValue: extractSycmItemListWithCart
      },
      // 详情（流量来源）：每商品一页，写入 goods_detail_slot_log（merge），需从 URL 带 itemId
      {
        eventName: "sycm-flow-source",
        urlContains: "/flow/v6/live/item/source/v4.json",
        urlFilter: null,
        multiValue: true,
        multiRows: false,
        fullRecord: true,
        mergeGoodsDetail: true,
        extractValue: function(data) {
          var list = data && data.data && data.data.data;
          if (!Array.isArray(list)) return void 0;
          var searchNode = walkByPageName(list, "搜索");
          var cartNode = walkByPageName(list, "购物车");
          if (!searchNode || !cartNode) return void 0;
          var searchUv = searchNode.uv && typeof searchNode.uv.value !== "undefined" ? Number(searchNode.uv.value) : 0;
          var searchPayRateRaw = searchNode.payRate && typeof searchNode.payRate.value !== "undefined" ? Number(searchNode.payRate.value) : 0;
          var searchPayRate = Math.round(searchPayRateRaw * 100) / 100;
          var cartUv = cartNode.uv && typeof cartNode.uv.value !== "undefined" ? Number(cartNode.uv.value) : 0;
          var cartPayRateRaw = cartNode.payRate && typeof cartNode.payRate.value !== "undefined" ? Number(cartNode.payRate.value) : 0;
          var cartPayRate = Math.round(cartPayRateRaw * 100) / 100;
          return {
            search_uv: searchUv,
            search_pay_rate: searchPayRate,
            cart_uv: cartUv,
            cart_pay_rate: cartPayRate
          };
        }
      }
    ];
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_CONFIG__ = { pipelines: PIPELINES };
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod$5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_CONFIG__ = mod$5;
  function sendToSupabase(tableName, record, credentials, opts) {
    var prefix = opts && opts.prefix ? opts.prefix + " " : "";
    var logger = opts && opts.logger;
    if (!credentials || !credentials.url || !credentials.anonKey) {
      if (logger) logger.appendLog("warn", prefix + "未配置 SUPABASE，跳过写入");
      return Promise.resolve();
    }
    var url = credentials.url.replace(/\/$/, "") + "/rest/v1/" + encodeURIComponent(tableName);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: credentials.anonKey,
        Authorization: "Bearer " + credentials.anonKey,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(record)
    }).then(function(res) {
      if (res.ok) {
        if (logger) logger.appendLog("log", prefix + "已写入 " + tableName);
        return { ok: true };
      }
      return res.text().then(function(t) {
        if (logger)
          logger.appendLog(
            "warn",
            prefix + "Supabase 写入失败 " + tableName + " " + res.status + " " + t
          );
        return { ok: false };
      });
    }).catch(function(err) {
      if (logger)
        logger.appendLog(
          "warn",
          prefix + "Supabase 请求异常 " + tableName + " " + String(err)
        );
      return { ok: false };
    });
  }
  function batchSendToSupabase(tableName, records, credentials, opts) {
    var prefix = opts && opts.prefix ? opts.prefix + " " : "";
    var logger = opts && opts.logger;
    if (!credentials || !credentials.url || !credentials.anonKey) {
      if (logger)
        logger.appendLog("warn", prefix + "未配置 SUPABASE，跳过批量写入");
      return Promise.resolve();
    }
    if (!Array.isArray(records) || records.length === 0) return Promise.resolve();
    var url = credentials.url.replace(/\/$/, "") + "/rest/v1/" + encodeURIComponent(tableName);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: credentials.anonKey,
        Authorization: "Bearer " + credentials.anonKey,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(records)
    }).then(function(res) {
      if (res.ok) {
        if (logger)
          logger.appendLog(
            "log",
            prefix + "已批量写入 " + tableName + "，" + records.length + " 行"
          );
        return { ok: true };
      }
      return res.text().then(function(t) {
        if (logger)
          logger.appendLog(
            "warn",
            prefix + "Supabase 批量写入失败 " + tableName + " " + res.status + " " + t
          );
        return { ok: false };
      });
    }).catch(function(err) {
      if (logger)
        logger.appendLog(
          "warn",
          prefix + "Supabase 批量请求异常 " + tableName + " " + String(err)
        );
      return { ok: false };
    });
  }
  function mergeGoodsDetailSlot(row, credentials, opts) {
    var prefix = opts && opts.prefix ? opts.prefix + " " : "";
    var logger = opts && opts.logger;
    if (!credentials || !credentials.url || !credentials.anonKey) {
      if (logger)
        logger.appendLog("warn", prefix + "未配置 SUPABASE，跳过 merge");
      return Promise.resolve();
    }
    var url = credentials.url.replace(/\/$/, "") + "/rest/v1/rpc/merge_goods_detail_slot_log";
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: credentials.anonKey,
        Authorization: "Bearer " + credentials.anonKey,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ p_row: row })
    }).then(function(res) {
      if (res.ok) {
        if (logger)
          logger.appendLog("log", prefix + "已 merge goods_detail_slot_log");
        return { ok: true };
      }
      return res.text().then(function(t) {
        if (logger)
          logger.appendLog(
            "warn",
            prefix + "merge_goods_detail_slot_log 失败 " + res.status + " " + t
          );
        return { ok: false };
      });
    }).catch(function(err) {
      if (logger)
        logger.appendLog("warn", prefix + "merge RPC 请求异常 " + String(err));
      return { ok: false };
    });
  }
  function mergeGoodsDetailSlotBatch(rows, credentials, opts) {
    if (!Array.isArray(rows) || rows.length === 0)
      return Promise.resolve({ ok: true });
    var concurrency = opts && typeof opts.concurrency === "number" && opts.concurrency > 0 ? opts.concurrency : 4;
    var index = 0;
    var inFlight = 0;
    var results = [];
    return new Promise(function(resolve) {
      function next() {
        while (inFlight < concurrency && index < rows.length) {
          (function(row, pos) {
            inFlight++;
            mergeGoodsDetailSlot(row, credentials, opts).then(function(res) {
              results[pos] = res;
            }).catch(function(err) {
              results[pos] = { ok: false, error: String(err) };
            }).finally(function() {
              inFlight--;
              if (index < rows.length) next();
              else if (inFlight === 0)
                resolve({
                  ok: results.every(function(r) {
                    return r && r.ok;
                  })
                });
            });
          })(rows[index], index);
          index++;
        }
        if (index >= rows.length && inFlight === 0)
          resolve({
            ok: results.every(function(r) {
              return r && r.ok;
            })
          });
      }
      next();
    });
  }
  (function(global) {
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_SUPABASE_UTIL__ = {
      sendToSupabase,
      batchSendToSupabase,
      mergeGoodsDetailSlot,
      mergeGoodsDetailSlotBatch
    };
  })();
  const mod$4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_SUPABASE__ = mod$4;
  function getSlotKey(recordedAtStr, throttleMinutes) {
    var s = String(recordedAtStr).trim();
    if (s.length < 19 || s[10] !== ":") return "";
    var datePart = s.slice(0, 10);
    var hour = s.slice(11, 13);
    var min = parseInt(s.slice(14, 16), 10);
    var slotMin = Math.floor(min / throttleMinutes) * throttleMinutes;
    var slotMinStr = (slotMin < 10 ? "0" : "") + slotMin;
    return datePart + ":" + hour + ":" + slotMinStr;
  }
  function toCreatedAtISO(recordedAt) {
    var s = String(recordedAt).trim();
    if (s.length >= 19 && s[10] === ":") {
      return s.slice(0, 10) + "T" + s.slice(11, 19) + "+08:00";
    }
    return s;
  }
  function getSlotTsISO(recordedAtStr, throttleMinutes) {
    var slotKey = getSlotKey(recordedAtStr, throttleMinutes);
    if (!slotKey) return "";
    return slotKey.slice(0, 10) + "T" + slotKey.slice(11) + ":00+08:00";
  }
  (function(global) {
    var obj = { getSlotKey, toCreatedAtISO, getSlotTsISO };
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_TIME__ = obj;
  })();
  const mod$3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_TIME__ = mod$3;
  (function(global) {
    function isQuotaError(err) {
      if (!err) return false;
      var msg = String(err.message || err);
      return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(msg);
    }
    function safeSet(payload, onDone, onQuota) {
      try {
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
      } catch (e) {
        if (isQuotaError(e) && typeof onQuota === "function") {
          onQuota(function() {
            chrome.storage.local.set(payload, function() {
              if (typeof onDone === "function") onDone();
            });
          });
          return;
        }
        if (typeof onDone === "function") onDone();
      }
    }
    function pruneByTabWithMeta(byTab, metaKey, maxTabs) {
      if (!byTab || typeof byTab !== "object") return {};
      if (!metaKey) metaKey = "__meta";
      if (typeof maxTabs !== "number") maxTabs = 1;
      var meta = byTab[metaKey] && typeof byTab[metaKey] === "object" ? byTab[metaKey] : {};
      var ids = Object.keys(byTab).filter(function(k) {
        return k !== metaKey;
      });
      ids.sort(function(a, b) {
        var ta = meta[a] || "";
        var tb = meta[b] || "";
        return String(ta).localeCompare(String(tb));
      });
      while (ids.length > maxTabs) {
        var oldest = ids.shift();
        delete byTab[oldest];
        delete meta[oldest];
      }
      byTab[metaKey] = meta;
      return byTab;
    }
    function escapeHtml(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function resolveTabIdByMessage(callback) {
      try {
        chrome.runtime.sendMessage({ type: "SYCM_GET_TAB_ID" }, function(res) {
          if (chrome.runtime.lastError || !res || res.tabId == null) callback(null);
          else callback(res.tabId);
        });
      } catch (e) {
        callback(null);
      }
    }
    var obj = {
      isQuotaError,
      safeSet,
      pruneByTabWithMeta,
      escapeHtml,
      resolveTabIdByMessage
    };
    global.__SYCM_COMMON__ = obj;
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod$2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_COMMON__ = mod$2;
  globalThis.__SYCM_DETAIL_TIME__ = mod$3;
  (function(global) {
    var KEYS = typeof __SYCM_DEFAULTS__ !== "undefined" && __SYCM_DEFAULTS__.STORAGE_KEYS ? __SYCM_DEFAULTS__.STORAGE_KEYS : {
      throttleMinutes: "sycm_throttle_minutes",
      lastSlotPrefix: "sycm_last_slot_",
      logs: "sycm_logs",
      liveJsonCatalog: "sycm_live_json_catalog",
      liveJsonFilter: "sycm_live_json_filter",
      liveJsonFilterByTab: "sycm_live_json_filter_by_tab",
      liveJsonCatalogByTab: "sycm_live_json_catalog_by_tab"
    };
    var common = typeof __SYCM_COMMON__ !== "undefined" ? __SYCM_COMMON__ : null;
    var safeSet = common && typeof common.safeSet === "function" ? common.safeSet : function(payload, onDone, onQuota) {
      function isQuotaError(err) {
        if (!err) return false;
        return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(String(err.message || err));
      }
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
    };
    function getThrottleMinutes(callback) {
      chrome.storage.local.get([KEYS.throttleMinutes], function(result) {
        var val = result[KEYS.throttleMinutes];
        callback(typeof val === "number" && val > 0 ? val : null);
      });
    }
    function setLastSlot(eventName, slotKey, callback) {
      var key = KEYS.lastSlotPrefix + eventName;
      safeSet({ [key]: slotKey }, callback || function() {
      }, function(retry) {
        chrome.storage.local.remove([key], function() {
          retry();
        });
      });
    }
    function setLastSlotsForEventItems(eventName, itemIdStrings, slotKey, callback) {
      var obj2 = {};
      for (var i = 0; i < itemIdStrings.length; i++) {
        var id = itemIdStrings[i];
        if (id == null || id === "") continue;
        obj2[KEYS.lastSlotPrefix + eventName + "_" + String(id)] = slotKey;
      }
      var keys = Object.keys(obj2);
      if (keys.length === 0) {
        (callback || function() {
        })();
        return;
      }
      safeSet(obj2, callback || function() {
      }, function(retry) {
        chrome.storage.local.remove(keys, function() {
          retry();
        });
      });
    }
    var obj = {
      getThrottleMinutes,
      setLastSlot,
      setLastSlotsForEventItems,
      STORAGE_KEYS: KEYS
    };
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_STORAGE__ = obj;
  })();
  const mod$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_STORAGE__ = mod$1;
  globalThis.__SYCM_DETAIL_SUPABASE__ = mod$4;
  (function(global) {
    var KEYS = typeof __SYCM_DEFAULTS__ !== "undefined" && __SYCM_DEFAULTS__.STORAGE_KEYS ? __SYCM_DEFAULTS__.STORAGE_KEYS : { logs: "sycm_logs", logsByTab: "sycm_logs_by_tab" };
    var MAX = typeof __SYCM_DEFAULTS__ !== "undefined" && __SYCM_DEFAULTS__.LOG_MAX_ENTRIES ? __SYCM_DEFAULTS__.LOG_MAX_ENTRIES : 20;
    var MAX_TABS = typeof __SYCM_DEFAULTS__ !== "undefined" && __SYCM_DEFAULTS__.LOG_MAX_TABS ? __SYCM_DEFAULTS__.LOG_MAX_TABS : 6;
    var LOG_KEY = KEYS.logs || "sycm_logs";
    var LOGS_BY_TAB_KEY = KEYS.logsByTab || "sycm_logs_by_tab";
    var LOG_META_KEY = "__meta";
    var common = typeof __SYCM_COMMON__ !== "undefined" ? __SYCM_COMMON__ : null;
    function safeSet(payload, onDone, onQuota) {
      if (common && typeof common.safeSet === "function")
        return common.safeSet(payload, onDone, onQuota);
      chrome.storage.local.set(payload, function() {
        if (typeof onDone === "function") onDone();
      });
    }
    function pruneByTab(byTab) {
      if (common && typeof common.pruneByTabWithMeta === "function")
        return common.pruneByTabWithMeta(byTab, LOG_META_KEY, MAX_TABS);
      return byTab || {};
    }
    function resolveTabId(callback) {
      if (common && typeof common.resolveTabIdByMessage === "function")
        return common.resolveTabIdByMessage(callback);
      try {
        chrome.runtime.sendMessage({ type: "SYCM_GET_TAB_ID" }, function(res) {
          if (chrome.runtime.lastError || !res || res.tabId == null)
            callback(null);
          else callback(res.tabId);
        });
      } catch (e) {
        callback(null);
      }
    }
    function appendLog(level, msg) {
      var entry = {
        t: (/* @__PURE__ */ new Date()).toISOString(),
        level: level || "log",
        msg: String(msg)
      };
      resolveTabId(function(tabId) {
        if (tabId == null) {
          chrome.storage.local.get([LOG_KEY], function(result) {
            var data = result[LOG_KEY];
            if (!data || !Array.isArray(data.entries)) data = { entries: [] };
            data.entries.push(entry);
            if (data.entries.length > MAX)
              data.entries = data.entries.slice(-MAX);
            safeSet({ [LOG_KEY]: data }, function() {
            });
          });
          return;
        }
        chrome.storage.local.get([LOGS_BY_TAB_KEY], function(result) {
          var byTab = result[LOGS_BY_TAB_KEY] || {};
          var bucket = byTab[String(tabId)] || { entries: [] };
          if (!Array.isArray(bucket.entries)) bucket.entries = [];
          bucket.entries.push(entry);
          if (bucket.entries.length > MAX)
            bucket.entries = bucket.entries.slice(-MAX);
          byTab[String(tabId)] = bucket;
          var meta = byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object" ? byTab[LOG_META_KEY] : {};
          meta[String(tabId)] = (/* @__PURE__ */ new Date()).toISOString();
          byTab[LOG_META_KEY] = meta;
          byTab = pruneByTab(byTab);
          var o = {};
          o[LOGS_BY_TAB_KEY] = byTab;
          safeSet(
            o,
            function() {
            },
            function(retry) {
              byTab = pruneByTab(byTab);
              safeSet(
                o,
                function() {
                },
                function() {
                }
              );
            }
          );
          try {
            chrome.runtime.sendMessage({
              type: "SYCM_LOG_APPENDED",
              entry,
              tabId
            });
          } catch (e) {
          }
        });
      });
    }
    function getLogs(callback, tabId) {
      if (tabId == null) {
        chrome.storage.local.get([LOG_KEY], function(result) {
          var data = result[LOG_KEY];
          callback(data && Array.isArray(data.entries) ? data.entries : []);
        });
        return;
      }
      chrome.storage.local.get([LOGS_BY_TAB_KEY], function(result) {
        var byTab = result[LOGS_BY_TAB_KEY] || {};
        var bucket = byTab[String(tabId)];
        var entries = bucket && Array.isArray(bucket.entries) ? bucket.entries : [];
        callback(entries);
      });
    }
    function clearLogs(callback, tabId) {
      if (tabId == null) {
        safeSet({ [LOG_KEY]: { entries: [] } }, function() {
          (callback || function() {
          })();
        });
        return;
      }
      chrome.storage.local.get([LOGS_BY_TAB_KEY], function(result) {
        var byTab = result[LOGS_BY_TAB_KEY] || {};
        delete byTab[String(tabId)];
        if (byTab[LOG_META_KEY] && typeof byTab[LOG_META_KEY] === "object") {
          delete byTab[LOG_META_KEY][String(tabId)];
        }
        var o = {};
        o[LOGS_BY_TAB_KEY] = byTab;
        safeSet(o, function() {
          (callback || function() {
          })();
        });
      });
    }
    var obj = {
      appendLog,
      getLogs,
      clearLogs,
      log: function(msg) {
        appendLog("log", msg);
      },
      warn: function(msg) {
        appendLog("warn", msg);
      },
      error: function(msg) {
        appendLog("error", msg);
      }
    };
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_LOGGER__ = obj;
  })(
    typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self
  );
  const mod = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_LOGGER__ = mod;
  function initContent() {
    if (globalThis.__LINING_SYCM_DETAIL_CS__) return;
    globalThis.__LINING_SYCM_DETAIL_CS__ = true;
    (function() {
      var PREFIX = typeof __SYCM_DEFAULTS__ !== "undefined" ? __SYCM_DEFAULTS__.PREFIX : "";
      var DEFAULTS = typeof __SYCM_DEFAULTS__ !== "undefined" ? __SYCM_DEFAULTS__.DEFAULTS : { THROTTLE_MINUTES: 20 };
      var PIPELINES = typeof __SYCM_CONFIG__ !== "undefined" && __SYCM_CONFIG__.pipelines ? __SYCM_CONFIG__.pipelines : [];
      var credentials = typeof __SYCM_SUPABASE__ !== "undefined" ? { url: __SYCM_SUPABASE__.url, anonKey: __SYCM_SUPABASE__.anonKey } : null;
      var timeUtil = typeof __SYCM_TIME__ !== "undefined" ? __SYCM_TIME__ : null;
      var supabaseUtil = typeof __SYCM_SUPABASE_UTIL__ !== "undefined" ? __SYCM_SUPABASE_UTIL__ : null;
      var storageUtil = typeof __SYCM_STORAGE__ !== "undefined" ? __SYCM_STORAGE__ : null;
      var logger = typeof __SYCM_LOGGER__ !== "undefined" ? __SYCM_LOGGER__ : null;
      if (!timeUtil || !supabaseUtil || !storageUtil) {
        if (logger) logger.warn(PREFIX + " 缺少 utils，请检查 manifest content_scripts 顺序");
        return;
      }
      var logOpts = logger ? { prefix: PREFIX, logger } : null;
      var getSlotKey2 = timeUtil.getSlotKey;
      var getSlotTsISO2 = timeUtil.getSlotTsISO;
      var mergeGoodsDetailSlot2 = supabaseUtil.mergeGoodsDetailSlot;
      var mergeGoodsDetailSlotBatch2 = supabaseUtil.mergeGoodsDetailSlotBatch;
      var getThrottleMinutes = storageUtil.getThrottleMinutes;
      var setLastSlot = storageUtil.setLastSlot;
      var setLastSlotsForEventItems = storageUtil.setLastSlotsForEventItems;
      var STORAGE_KEYS = storageUtil.STORAGE_KEYS;
      var MAX_LIVE_JSON_ITEMS = typeof __SYCM_DEFAULTS__ !== "undefined" && __SYCM_DEFAULTS__.LIVE_JSON_MAX_ITEMS ? __SYCM_DEFAULTS__.LIVE_JSON_MAX_ITEMS : 200;
      var MAX_LIVE_JSON_TABS = typeof __SYCM_DEFAULTS__ !== "undefined" && __SYCM_DEFAULTS__.LIVE_JSON_MAX_TABS ? __SYCM_DEFAULTS__.LIVE_JSON_MAX_TABS : 6;
      var CATALOG_META_KEY = "__meta";
      var common = typeof __SYCM_COMMON__ !== "undefined" ? __SYCM_COMMON__ : null;
      var safeSet = common && typeof common.safeSet === "function" ? common.safeSet : function(payload, onDone, onQuota) {
        function isQuotaError(err) {
          if (!err) return false;
          var msg = String(err.message || err);
          return /quota|QUOTA_BYTES|Resource::kQuotaBytes/i.test(msg);
        }
        try {
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
        } catch (e) {
          if (isQuotaError(e) && typeof onQuota === "function") {
            onQuota(function() {
              chrome.storage.local.set(payload, function() {
                if (typeof onDone === "function") onDone();
              });
            });
            return;
          }
          if (typeof onDone === "function") onDone();
        }
      };
      var LIVE_JSON_EVENT = "sycm-goods-live";
      function resolveTabId(callback) {
        if (common && typeof common.resolveTabIdByMessage === "function") {
          try {
            common.resolveTabIdByMessage(callback);
          } catch (e) {
            callback(null);
          }
          return;
        }
        try {
          chrome.runtime.sendMessage({ type: "SYCM_GET_TAB_ID" }, function(res) {
            if (chrome.runtime.lastError || !res || res.tabId == null) callback(null);
            else callback(res.tabId);
          });
        } catch (e) {
          callback(null);
        }
      }
      var safeSet = common && typeof common.safeSet === "function" ? common.safeSet : function(payload, onDone, onQuota) {
        try {
          chrome.storage.local.set(payload, function() {
            if (typeof onDone === "function") onDone();
          });
        } catch (e) {
          if (typeof onDone === "function") onDone();
        }
      };
      function formatGoodsIds(items, maxShow, maxChars) {
        maxShow = maxShow || 16;
        maxChars = maxChars || 500;
        if (!items || items.length === 0) return "—";
        var parts = [];
        var len = 0;
        for (var i = 0; i < items.length && parts.length < maxShow; i++) {
          var id = items[i] && items[i].item_id != null ? String(items[i].item_id) : "";
          if (!id) continue;
          if (len + id.length + 2 > maxChars) break;
          parts.push(id);
          len += id.length + 2;
        }
        var more = items.length > parts.length ? " …共" + items.length + "件" : "";
        return parts.join("，") + more;
      }
      function buildLiveJsonLogLine(opts) {
        var batch = opts.batchItems || [];
        var allowed = opts.allowedRows || [];
        var wl = typeof opts.whitelistLen === "number" ? opts.whitelistLen : 0;
        var tm = opts.throttleMinutes != null ? opts.throttleMinutes : 20;
        var head = PREFIX + "[多商品加购] 接口 " + batch.length + " 件：" + formatGoodsIds(batch, 16, 500);
        var allowBrief = allowed.length > 0 ? formatGoodsIds(
          allowed.map(function(r) {
            return { item_id: r.item_id };
          }),
          16,
          400
        ) : wl === 0 ? "（弹窗白名单为空）" : "（与本批无交集）";
        var mid = " │ 勾选可报 " + allowed.length + " 件：" + allowBrief;
        var tail;
        if (opts.outcome === "throttle") tail = " │ 本" + tm + "分钟槽内所选商品均已上报过 → 跳过";
        else if (opts.outcome === "none") tail = " │ 未写入";
        else if (opts.outcome === "written") {
          tail = " │ 已写入 Supabase";
          if (opts.skippedInSlot > 0) {
            tail += "（新写入 " + (opts.writtenCount != null ? opts.writtenCount : "") + " 件，本槽已跳过 " + opts.skippedInSlot + " 件）";
          }
        } else tail = " │ 写入失败：" + (opts.errMsg ? String(opts.errMsg) : "未知");
        return head + mid + tail;
      }
      function saveLiveJsonCatalog(rawItems) {
        if (!Array.isArray(rawItems) || rawItems.length === 0) return;
        var list = [];
        for (var i = 0; i < rawItems.length && list.length < MAX_LIVE_JSON_ITEMS; i++) {
          var it = rawItems[i];
          if (!it || it.item_id == null) continue;
          list.push({ item_id: String(it.item_id), item_name: it.item_name ? String(it.item_name) : "" });
        }
        if (list.length === 0) return;
        var payload = { updatedAt: (/* @__PURE__ */ new Date()).toISOString(), items: list };
        try {
          resolveTabId(function(tabId) {
            if (tabId == null) {
              try {
                safeSet({ [STORAGE_KEYS.liveJsonCatalog]: payload }, function() {
                }, function(retry) {
                  chrome.storage.local.remove([STORAGE_KEYS.liveJsonCatalog], function() {
                    retry();
                  });
                });
              } catch (e2) {
              }
              return;
            }
            chrome.storage.local.get([STORAGE_KEYS.liveJsonCatalogByTab], function(r) {
              var byTab = r && r[STORAGE_KEYS.liveJsonCatalogByTab] ? r[STORAGE_KEYS.liveJsonCatalogByTab] : {};
              byTab[String(tabId)] = payload;
              var meta = byTab[CATALOG_META_KEY] && typeof byTab[CATALOG_META_KEY] === "object" ? byTab[CATALOG_META_KEY] : {};
              meta[String(tabId)] = (/* @__PURE__ */ new Date()).toISOString();
              byTab[CATALOG_META_KEY] = meta;
              var ids = Object.keys(byTab).filter(function(k) {
                return k !== CATALOG_META_KEY;
              });
              ids.sort(function(a, b) {
                var ta = meta[a] || "";
                var tb = meta[b] || "";
                return String(ta).localeCompare(String(tb));
              });
              while (ids.length > MAX_LIVE_JSON_TABS) {
                var oldest = ids.shift();
                delete byTab[oldest];
                delete meta[oldest];
              }
              var obj = {};
              obj[STORAGE_KEYS.liveJsonCatalogByTab] = byTab;
              safeSet(obj, function() {
              }, function(retry) {
                byTab = common && typeof common.pruneByTabWithMeta === "function" ? common.pruneByTabWithMeta(byTab, CATALOG_META_KEY, Math.max(1, MAX_LIVE_JSON_TABS - 1)) : byTab;
                safeSet(obj, retry);
              });
            });
          });
        } catch (e) {
        }
      }
      function handleEvent(sink, d, throttleMinutes) {
        var recordedAt = String(d.recordedAt);
        var slotKey = getSlotKey2(recordedAt, throttleMinutes);
        if (!slotKey) return;
        if (sink.mergeGoodsDetail) {
          let mergeGoodsDetailStorageCallback = function(result, tabId) {
            if (sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
              var rawList = d.payload.items;
              var batchItems = [];
              for (var bi = 0; bi < rawList.length; bi++) {
                var raw = rawList[bi];
                if (!raw || raw.item_id == null) continue;
                batchItems.push({ item_id: String(raw.item_id), item_name: raw.item_name ? String(raw.item_name) : "" });
              }
              var filt = pickFilterForTab(result, tabId);
              var idList = filt && Array.isArray(filt.itemIds) ? filt.itemIds : [];
              var allow = {};
              for (var a = 0; a < idList.length; a++) {
                allow[String(idList[a])] = true;
              }
              var rows = rawList.map(function(item) {
                return {
                  item_id: item.item_id,
                  slot_ts: slotTs,
                  item_name: ensureItemName(item.item_id, item.item_name),
                  item_cart_cnt: item.item_cart_cnt != null ? item.item_cart_cnt : null
                };
              });
              rows = rows.filter(function(r) {
                return r.item_id != null && allow[String(r.item_id)];
              });
              var rowsToWrite = rows.filter(function(r) {
                var k = STORAGE_KEYS.lastSlotPrefix + sink.eventName + "_" + String(r.item_id);
                return result[k] !== slotKey;
              });
              var skippedInSlot = rows.length - rowsToWrite.length;
              var logBase = {
                batchItems,
                allowedRows: rows,
                whitelistLen: idList.length,
                throttleMinutes
              };
              if (rowsToWrite.length === 0) {
                if (rows.length > 0) {
                  if (logger) logger.log(buildLiveJsonLogLine(Object.assign({ outcome: "throttle" }, logBase)));
                } else if (logger) {
                  logger.log(buildLiveJsonLogLine(Object.assign({ outcome: "none" }, logBase)));
                }
                return;
              }
              mergeGoodsDetailSlotBatch2(rowsToWrite, credentials, logOpts).then(function(res) {
                if (res && res.ok) {
                  var ids = rowsToWrite.map(function(r) {
                    return String(r.item_id);
                  });
                  setLastSlotsForEventItems(sink.eventName, ids, slotKey, function() {
                  });
                  if (logger) {
                    logger.log(
                      buildLiveJsonLogLine(
                        Object.assign(
                          {
                            outcome: "written",
                            skippedInSlot,
                            writtenCount: rowsToWrite.length
                          },
                          logBase
                        )
                      )
                    );
                  }
                } else if (logger) {
                  logger.warn(
                    buildLiveJsonLogLine(
                      Object.assign({ outcome: "fail", errMsg: res && res.error || JSON.stringify(res) }, logBase)
                    )
                  );
                }
              });
            } else {
              var lastSlotDetail = result[detailLastSlotKey];
              if (lastSlotDetail === slotKey) {
                if (logger) {
                  var toPct2 = function(v) {
                    if (v == null) return "—";
                    var n = Number(v);
                    if (n !== n) return String(v);
                    return (Math.round(n * 1e4) / 100).toFixed(2) + "%";
                  };
                  var p = d.payload || {};
                  logger.log(
                    PREFIX + " [详情] item " + d.itemId + " │ 搜索UV=" + (p.search_uv != null ? p.search_uv : "—") + " 搜索支付转化率=" + toPct2(p.search_pay_rate) + " │ 购物车UV=" + (p.cart_uv != null ? p.cart_uv : "—") + " 购物车支付转化率=" + toPct2(p.cart_pay_rate) + " │ 本" + throttleMinutes + "分钟槽已上报过 → 跳过"
                  );
                }
                return;
              }
              if (!d.itemId) {
                if (logger) logger.warn(PREFIX + " 详情数据缺少 itemId，跳过");
                return;
              }
              var cat = pickCatalogForTab(result, tabId);
              var row = {
                item_id: d.itemId,
                slot_ts: slotTs,
                item_name: ensureItemName(d.itemId, itemNameFromCatalog(cat, d.itemId)),
                search_uv: d.payload && d.payload.search_uv != null ? d.payload.search_uv : null,
                search_pay_rate: d.payload && d.payload.search_pay_rate != null ? d.payload.search_pay_rate : null,
                cart_uv: d.payload && d.payload.cart_uv != null ? d.payload.cart_uv : null,
                cart_pay_rate: d.payload && d.payload.cart_pay_rate != null ? d.payload.cart_pay_rate : null
              };
              mergeGoodsDetailSlot2(row, credentials, logOpts).then(function(res) {
                if (res && res.ok) {
                  setLastSlot(sink.eventName + "_" + d.itemId, slotKey, function() {
                  });
                  if (logger) {
                    var toPct = function(v) {
                      if (v == null) return "—";
                      var n = Number(v);
                      if (n !== n) return String(v);
                      return (Math.round(n * 1e4) / 100).toFixed(2) + "%";
                    };
                    logger.log(
                      PREFIX + " 已捕获 [详情]，已 merge item " + d.itemId + " │ 搜索UV=" + (row.search_uv != null ? row.search_uv : "—") + " 搜索支付转化率=" + toPct(row.search_pay_rate) + " │ 购物车UV=" + (row.cart_uv != null ? row.cart_uv : "—") + " 购物车支付转化率=" + toPct(row.cart_pay_rate)
                    );
                  }
                }
              });
            }
          };
          var slotTs = getSlotTsISO2(recordedAt, throttleMinutes);
          if (!slotTs) return;
          if (sink.eventName === LIVE_JSON_EVENT && sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
            saveLiveJsonCatalog(d.payload.items);
          }
          var detailLastSlotKey = null;
          var keysToRead;
          resolveTabId(function(tabId) {
            if (sink.multiRows && d.payload && Array.isArray(d.payload.items)) {
              keysToRead = [STORAGE_KEYS.liveJsonFilter, STORAGE_KEYS.liveJsonFilterByTab];
              var rawForKeys = d.payload.items;
              for (var ki = 0; ki < rawForKeys.length; ki++) {
                var rawK = rawForKeys[ki];
                if (!rawK || rawK.item_id == null) continue;
                keysToRead.push(STORAGE_KEYS.lastSlotPrefix + sink.eventName + "_" + String(rawK.item_id));
              }
            } else {
              detailLastSlotKey = STORAGE_KEYS.lastSlotPrefix + sink.eventName + (d.itemId ? "_" + d.itemId : "");
              keysToRead = [detailLastSlotKey, STORAGE_KEYS.liveJsonCatalog, STORAGE_KEYS.liveJsonCatalogByTab];
            }
            chrome.storage.local.get(keysToRead, function(result) {
              mergeGoodsDetailStorageCallback(result, tabId);
            });
          });
          return;
        }
      }
      function registerListeners() {
        var throttleMinutes = DEFAULTS.THROTTLE_MINUTES;
        try {
          chrome.storage.onChanged.addListener(function(changes, areaName) {
            if (areaName !== "local") return;
            var ch = changes && changes[STORAGE_KEYS.throttleMinutes];
            if (ch && typeof ch.newValue === "number" && ch.newValue > 0) throttleMinutes = ch.newValue;
          });
        } catch (e) {
        }
        PIPELINES.forEach(function(sink) {
          document.addEventListener(sink.eventName, function(e) {
            var d = e.detail;
            if (!d || !d.recordedAt) return;
            handleEvent(sink, d, throttleMinutes);
          });
        });
        getThrottleMinutes(function(stored) {
          if (stored != null) throttleMinutes = stored;
        });
      }
      registerListeners();
      if (logger) {
        document.addEventListener("sycm-log", function(e) {
          var d = e.detail;
          if (d && d.level != null && d.msg != null) logger.appendLog(d.level, d.msg);
        });
      }
      try {
        document.addEventListener("sycm-flow-source-template", function(e) {
          var d = e && e.detail ? e.detail : null;
          var url = d && d.url ? String(d.url) : "";
          if (!url || url.indexOf("/flow/v6/live/item/source/v4.json") === -1) return;
          function normalizeTemplateUrl(raw) {
            try {
              var u = new URL(raw, document.location.origin);
              u.searchParams.delete("_");
              u.searchParams.set("itemId", "{itemId}");
              return u.toString();
            } catch (err) {
              return raw;
            }
          }
          var normalized = normalizeTemplateUrl(url);
          resolveTabId(function(tabId) {
            if (tabId == null) return;
            chrome.storage.local.get([STORAGE_KEYS.flowSourceTemplateByTab], function(r) {
              var byTab = r && r[STORAGE_KEYS.flowSourceTemplateByTab] ? r[STORAGE_KEYS.flowSourceTemplateByTab] : {};
              var key = String(tabId);
              var prev = byTab[key];
              if (prev && prev.url && String(prev.url) === normalized) return;
              byTab[key] = { url: normalized, capturedAt: (/* @__PURE__ */ new Date()).toISOString() };
              var o = {};
              o[STORAGE_KEYS.flowSourceTemplateByTab] = byTab;
              safeSet(o, function() {
                if (logger) logger.log(PREFIX + " 已捕获 flow-source 模板（可用于列表页轮询）");
              });
            });
          });
        });
      } catch (e) {
      }
      try {
        var pageUrl = typeof document !== "undefined" && document.location ? document.location.href : "";
        if (logger) logger.log(PREFIX + " content 已加载，当前页: " + (pageUrl.slice(0, 60) || "") + (pageUrl.length > 60 ? "..." : "") + "，将注入 config + inject");
        var configScript = document.createElement("script");
        configScript.src = chrome.runtime.getURL("constants/config.js");
        configScript.onload = function() {
          this.remove();
          if (logger) logger.log(PREFIX + " config.js 已加载，正在注入 inject.js 到页面主世界");
          var injectScript = document.createElement("script");
          injectScript.src = chrome.runtime.getURL("inject.js");
          injectScript.onload = function() {
            this.remove();
          };
          injectScript.onerror = function() {
            if (logger) logger.warn(PREFIX + " inject.js 加载失败，请检查扩展资源");
          };
          (document.head || document.documentElement).appendChild(injectScript);
          var poller = document.createElement("script");
          poller.src = chrome.runtime.getURL("flow-source-poller.js");
          poller.onload = function() {
            this.remove();
          };
          poller.onerror = function() {
            if (logger) logger.warn(PREFIX + " flow-source-poller.js 加载失败");
          };
          (document.head || document.documentElement).appendChild(poller);
        };
        configScript.onerror = function() {
          if (logger) logger.warn(PREFIX + " constants/config.js 加载失败");
        };
        (document.head || document.documentElement).appendChild(configScript);
      } catch (e) {
        if (logger) logger.warn(PREFIX + " 注入出错 " + String(e));
      }
      try {
        chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
          if (!msg || !msg.type) return false;
          if (msg.type === "SYCM_FLOW_POLL_START") {
            var intervalSec = typeof msg.intervalSec === "number" ? msg.intervalSec : 30;
            var concurrency = 1;
            intervalSec = Math.max(5, Math.min(600, intervalSec));
            concurrency = 1;
            resolveTabId(function(tabId) {
              chrome.storage.local.get(
                [
                  STORAGE_KEYS.liveJsonFilter,
                  STORAGE_KEYS.liveJsonFilterByTab,
                  STORAGE_KEYS.flowSourceTemplateByTab
                ],
                function(r) {
                  var filt = pickFilterForTab(r, tabId);
                  var ids = filt && Array.isArray(filt.itemIds) ? filt.itemIds.map(function(x) {
                    return String(x);
                  }) : [];
                  if (ids.length === 0) {
                    if (logger) logger.warn(PREFIX + " 未勾选任何商品，无法开始轮询");
                    sendResponse({ ok: false, error: "no_items" });
                    return;
                  }
                  var byTab = r[STORAGE_KEYS.flowSourceTemplateByTab] || {};
                  var tpl = tabId != null ? byTab[String(tabId)] : null;
                  var tplUrl = tpl && tpl.url ? String(tpl.url) : "";
                  if (!tplUrl) {
                    var best = null;
                    Object.keys(byTab).forEach(function(k) {
                      var v = byTab[k];
                      if (!v || !v.url) return;
                      if (!best) best = v;
                      else {
                        var ta = best.capturedAt || "";
                        var tb = v.capturedAt || "";
                        if (String(ta).localeCompare(String(tb)) < 0) best = v;
                      }
                    });
                    if (best && best.url) tplUrl = String(best.url);
                  }
                  if (!tplUrl) {
                    if (logger) logger.warn(PREFIX + " 未捕获详情接口模板：请先打开任意商品详情页触发一次接口");
                    sendResponse({ ok: false, error: "no_template" });
                    return;
                  }
                  window.postMessage(
                    {
                      type: "SYCM_FLOW_POLL_START",
                      itemIds: ids,
                      templateUrl: tplUrl,
                      intervalMs: intervalSec * 1e3,
                      maxConcurrency: concurrency
                    },
                    "*"
                  );
                  sendResponse({ ok: true, itemCount: ids.length });
                }
              );
            });
            return true;
          }
          if (msg.type === "SYCM_FLOW_POLL_STOP") {
            window.postMessage({ type: "SYCM_FLOW_POLL_STOP" }, "*");
            sendResponse({ ok: true });
            return true;
          }
          return false;
        });
      } catch (e) {
      }
    })();
  }
  initContent();
})();
//# sourceMappingURL=content.js.map
