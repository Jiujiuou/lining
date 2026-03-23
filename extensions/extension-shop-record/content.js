/**
 * 店铺记录数据：页面采集逻辑（日志经 background 写入 storage，与 popup 一致）
 */
(function () {
  var PREFIX =
    typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" && __SHOP_RECORD_DEFAULTS__.PREFIX
      ? __SHOP_RECORD_DEFAULTS__.PREFIX
      : "";
  var APPEND_LOG_TYPE =
    typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      ? __SHOP_RECORD_DEFAULTS__.RUNTIME.CONTENT_APPEND_LOG_MESSAGE
      : "shopRecordAppendLog";

  function sendLog(msg) {
    try {
      chrome.runtime.sendMessage({ type: APPEND_LOG_TYPE, msg: String(msg) });
    } catch (e) {
      /* ignore */
    }
  }

  function isUserRatePage() {
    if (location.hostname !== "rate.taobao.com") return false;
    return (location.pathname || "").indexOf("/user-rate-") === 0;
  }

  function normalizeLabel(text) {
    return String(text || "")
      .replace(/\s/g, "")
      .replace(/：/g, "")
      .replace(/:/g, "");
  }

  var scoresLogged = false;
  function tryLogShopScores() {
    if (scoresLogged || !isUserRatePage()) return;
    var root = document.getElementById("dsr") || document.querySelector("ul.dsr-info");
    if (!root) return;

    var want = {
      宝贝与描述相符: null,
      卖家的服务态度: null,
      物流服务的质量: null
    };
    var items = root.querySelectorAll("li.dsr-item");
    for (var i = 0; i < items.length; i++) {
      var li = items[i];
      var titleEl = li.querySelector(".item-scrib span.tb-title");
      var countEl = li.querySelector(".item-scrib em.count");
      if (!titleEl || !countEl) continue;
      var key = normalizeLabel(titleEl.textContent);
      if (key.indexOf("宝贝与描述相符") !== -1) {
        want["宝贝与描述相符"] = (countEl.textContent || "").trim();
      } else if (key.indexOf("卖家的服务态度") !== -1) {
        want["卖家的服务态度"] = (countEl.textContent || "").trim();
      } else if (key.indexOf("物流服务的质量") !== -1) {
        want["物流服务的质量"] = (countEl.textContent || "").trim();
      }
    }

    if (!want["宝贝与描述相符"] || !want["卖家的服务态度"] || !want["物流服务的质量"]) {
      return;
    }

    var msg =
      PREFIX +
      " 店铺分（" +
      location.pathname +
      "）宝贝与描述相符 " +
      want["宝贝与描述相符"] +
      " 分；卖家服务态度 " +
      want["卖家的服务态度"] +
      " 分；物流服务质量 " +
      want["物流服务的质量"] +
      " 分";
    scoresLogged = true;
    sendLog(msg);
    return true;
  }

  if (!isUserRatePage()) return;

  var extracted = false;
  function tick() {
    if (extracted) return;
    if (tryLogShopScores()) extracted = true;
  }

  tick();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tick);
  }
  var poll = setInterval(function () {
    tick();
    if (extracted) clearInterval(poll);
  }, 400);

  try {
    var obs = new MutationObserver(tick);
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
