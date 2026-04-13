(function() {
  "use strict";
  function initInject() {
    if (globalThis.__LINING_SYCM_DETAIL_INJECT__) return;
    globalThis.__LINING_SYCM_DETAIL_INJECT__ = true;
    (function() {
      function emitLog(level, msg) {
        try {
          document.dispatchEvent(
            new CustomEvent("sycm-log", { detail: { level, msg } })
          );
        } catch (err) {
        }
      }
      if (window.__sycmCaptureLoaded) {
        emitLog("warn", "[Sycm] inject.js 跳过：已加载过（可能重复注入）");
        return;
      }
      window.__sycmCaptureLoaded = true;
      emitLog("log", "[Sycm] inject.js 已在页面主世界执行，准备劫持 fetch/XHR");
      try {
        Object.defineProperty(document, "hidden", {
          get: function() {
            return false;
          },
          configurable: true
        });
        Object.defineProperty(document, "visibilityState", {
          get: function() {
            return "visible";
          },
          configurable: true
        });
      } catch (e) {
        emitLog("warn", "[Sycm Data Capture] 伪造 visibility 失败: " + String(e));
      }
      var PREFIX = "";
      var config = typeof window !== "undefined" && window.__SYCM_CONFIG__ ? window.__SYCM_CONFIG__ : null;
      var pipelines = config && config.pipelines && config.pipelines.length ? config.pipelines : [];
      var SOURCES = pipelines.map(function(p) {
        return {
          urlContains: p.urlContains,
          urlFilter: p.urlFilter || null,
          eventName: p.eventName,
          extractValue: p.extractValue,
          multiValue: !!p.multiValue,
          multiRows: !!p.multiRows,
          mergeGoodsDetail: !!p.mergeGoodsDetail
        };
      });
      var getEast8TimeStr = typeof window !== "undefined" && window.__SYCM_TIME_MAIN__ && typeof window.__SYCM_TIME_MAIN__.getEast8TimeStr === "function" ? window.__SYCM_TIME_MAIN__.getEast8TimeStr : function() {
        var d = /* @__PURE__ */ new Date();
        var pad = function(n) {
          return (n < 10 ? "0" : "") + n;
        };
        var utc = d.getTime() + d.getTimezoneOffset() * 6e4;
        var east8 = new Date(utc + 8 * 60 * 60 * 1e3);
        var y8 = east8.getFullYear();
        var m8 = pad(east8.getMonth() + 1);
        var d8 = pad(east8.getDate());
        var h8 = pad(east8.getHours());
        var min8 = pad(east8.getMinutes());
        var s8 = pad(east8.getSeconds());
        return y8 + "-" + m8 + "-" + d8 + ":" + h8 + ":" + min8 + ":" + s8;
      };
      function getUrl(input) {
        if (typeof input === "string") return input;
        if (input && input.url) return input.url;
        if (input && typeof input === "object" && "url" in input) return input.url;
        return "";
      }
      function urlMatches(url, urlContains) {
        if (!url || typeof url !== "string") return false;
        return url.indexOf(urlContains) !== -1 || url.indexOf("live.json") !== -1 && urlContains.indexOf("live.json") !== -1;
      }
      function getItemIdFromLocation() {
        try {
          var q = typeof window.location !== "undefined" && window.location.search;
          if (!q) return null;
          var m = q.slice(1).split("&").filter(function(p) {
            return p.indexOf("itemId=") === 0;
          })[0];
          return m ? decodeURIComponent(m.split("=")[1] || "") : null;
        } catch (e) {
          return null;
        }
      }
      function getItemIdFromUrl(url) {
        if (!url || typeof url !== "string") return null;
        try {
          var u = new URL(url, window.location.origin);
          var id = u.searchParams.get("itemId");
          return id ? String(id) : null;
        } catch (e) {
          try {
            var m = url.split("?")[1] || "";
            var kv = m.split("&").filter(function(p) {
              return p.indexOf("itemId=") === 0;
            })[0];
            return kv ? decodeURIComponent(kv.split("=")[1] || "") : null;
          } catch (e2) {
            return null;
          }
        }
      }
      function handleResponse(url, data) {
        var timeStr = getEast8TimeStr();
        for (var i = 0; i < SOURCES.length; i++) {
          var src = SOURCES[i];
          if (!urlMatches(url, src.urlContains)) continue;
          if (src.urlFilter && !src.urlFilter(url)) continue;
          try {
            if (src.eventName === "sycm-flow-source") {
              try {
                document.dispatchEvent(
                  new CustomEvent("sycm-flow-source-template", {
                    detail: { url, t: Date.now() }
                  })
                );
              } catch (e2) {
              }
            }
            var value = src.extractValue(data);
            if (value === void 0) {
              var inner = data && data.data && data.data.data;
              var list = inner && inner.data;
              var listLen = Array.isArray(list) ? list.length : list ? "非数组" : "无";
              emitLog(
                "warn",
                PREFIX + "[" + src.eventName + "] 解析无数据 code=" + (data && data.code) + " 条数=" + listLen
              );
              return;
            }
            var itemId = src.mergeGoodsDetail ? getItemIdFromUrl(url) || getItemIdFromLocation() : null;
            if (src.multiValue && value && typeof value === "object") {
              document.dispatchEvent(
                new CustomEvent(src.eventName, {
                  detail: {
                    payload: value,
                    recordedAt: timeStr,
                    itemId: itemId || void 0
                  }
                })
              );
            } else {
              var num = Number(value);
              if (num !== num) num = value;
              document.dispatchEvent(
                new CustomEvent(src.eventName, {
                  detail: {
                    value: num,
                    recordedAt: timeStr,
                    itemId: itemId || void 0
                  }
                })
              );
            }
          } catch (e) {
            emitLog(
              "warn",
              PREFIX + " 处理 " + src.eventName + " 失败 " + String(e)
            );
          }
          return;
        }
      }
      try {
        var origFetch = window.fetch;
        window.fetch = function() {
          var url = getUrl(arguments[0]);
          var args = arguments;
          return origFetch.apply(this, args).then(function(res) {
            try {
              var hit = SOURCES.some(function(s) {
                return urlMatches(url, s.urlContains) && (!s.urlFilter || s.urlFilter(url));
              });
              if (hit) {
                res.clone().json().then(
                  function(data) {
                    handleResponse(url, data);
                  },
                  function(err) {
                    emitLog(
                      "warn",
                      PREFIX + " 解析失败 " + url + " " + String(err)
                    );
                  }
                );
              }
            } catch (e) {
              emitLog("warn", PREFIX + " 处理响应时出错 " + String(e));
            }
            return res;
          });
        };
        var XhrOpen = XMLHttpRequest.prototype.open;
        var XhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url) {
          this._sycmUrl = typeof url === "string" ? url : "";
          return XhrOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function() {
          var xhr = this;
          var hit = SOURCES.some(function(s) {
            return urlMatches(xhr._sycmUrl || "", s.urlContains) && (!s.urlFilter || s.urlFilter(xhr._sycmUrl));
          });
          if (hit) {
            xhr.addEventListener("load", function() {
              try {
                var data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
                handleResponse(xhr._sycmUrl, data);
              } catch (e) {
                emitLog("warn", PREFIX + " XHR 解析失败 " + String(e));
              }
            });
          }
          return XhrSend.apply(this, arguments);
        };
        var urls = SOURCES.map(function(s) {
          return s.urlContains;
        }).join(", ");
        emitLog("log", PREFIX + " 已注入，监听: " + urls);
      } catch (e) {
        emitLog("warn", PREFIX + " 注入失败 " + String(e));
      }
    })();
  }
  initInject();
})();
//# sourceMappingURL=inject.js.map
