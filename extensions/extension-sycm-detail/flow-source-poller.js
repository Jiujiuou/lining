(function () {
  function emitLog(level, msg) {
    try {
      document.dispatchEvent(
        new CustomEvent("sycm-log", { detail: { level: level, msg: msg } }),
      );
    } catch (err) {}
  }

  if (window.__sycmFlowSourcePollerLoaded) {
    emitLog("log", "[Sycm] flow-source-poller 已存在，跳过重复加载");
    return;
  }
  window.__sycmFlowSourcePollerLoaded = true;

  var running = false;
  var timer = null;
  var queue = [];
  var inFlight = 0;
  var maxConcurrency = 2;
  var templateUrl = "";
  var intervalMs = 30 * 1000;

  var pad =
    typeof window !== "undefined" &&
    window.__SYCM_TIME_MAIN__ &&
    typeof window.__SYCM_TIME_MAIN__.pad === "function"
      ? window.__SYCM_TIME_MAIN__.pad
      : function (n) {
          return n < 10 ? "0" + n : String(n);
        };

  var getEast8TimeStr =
    typeof window !== "undefined" &&
    window.__SYCM_TIME_MAIN__ &&
    typeof window.__SYCM_TIME_MAIN__.getEast8TimeStr === "function"
      ? window.__SYCM_TIME_MAIN__.getEast8TimeStr
      : function () {
          var d = new Date();
          var utc = d.getTime() + d.getTimezoneOffset() * 60000;
          var east8 = new Date(utc + 8 * 60 * 60 * 1000);
          return (
            east8.getFullYear() +
            "-" +
            pad(east8.getMonth() + 1) +
            "-" +
            pad(east8.getDate()) +
            ":" +
            pad(east8.getHours()) +
            ":" +
            pad(east8.getMinutes()) +
            ":" +
            pad(east8.getSeconds())
          );
        };

  function parseUrl(u) {
    try {
      return new URL(u, window.location.origin);
    } catch (e) {
      return null;
    }
  }

  function buildUrlForItem(itemId) {
    var url = parseUrl(templateUrl);
    if (!url) return "";
    url.searchParams.set("itemId", String(itemId));
    url.searchParams.set("_", String(Date.now()));
    // token 是否需要刷新：先沿用模板；失败时由上层提示重新捕获
    return url.toString();
  }

  function walkByPageName(nodes, name) {
    if (!Array.isArray(nodes)) return null;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n && n.pageName && n.pageName.value === name) return n;
      if (n && n.children && n.children.length) {
        var found = walkByPageName(n.children, name);
        if (found) return found;
      }
    }
    return null;
  }

  function extractFlowMetrics(data) {
    var list = data && data.data && data.data.data;
    if (!Array.isArray(list)) return null;
    var searchNode = walkByPageName(list, "搜索");
    var cartNode = walkByPageName(list, "购物车");
    if (!searchNode || !cartNode) return null;
    function numVal(node, key) {
      var v =
        node && node[key] && typeof node[key].value !== "undefined"
          ? Number(node[key].value)
          : null;
      return v == null || isNaN(v) ? null : v;
    }
    function rateVal(node, key) {
      var v =
        node && node[key] && typeof node[key].value !== "undefined"
          ? Number(node[key].value)
          : null;
      if (v == null || isNaN(v)) return null;
      return Math.round(v * 100) / 100;
    }
    return {
      search_uv: numVal(searchNode, "uv"),
      search_pay_rate: rateVal(searchNode, "payRate"),
      cart_uv: numVal(cartNode, "uv"),
      cart_pay_rate: rateVal(cartNode, "payRate"),
    };
  }

  function dispatchFlowSourceEvent(itemId, payload) {
    try {
      document.dispatchEvent(
        new CustomEvent("sycm-flow-source", {
          detail: {
            payload: payload,
            recordedAt: getEast8TimeStr(),
            itemId: String(itemId),
          },
        }),
      );
    } catch (e) {}
  }

  function formatMetric(n) {
    if (n == null) return "—";
    var v = Number(n);
    if (v !== v) return String(n);
    return String(v);
  }

  function formatRate(n) {
    if (n == null) return "—";
    var v = Number(n);
    if (v !== v) return String(n);
    return (Math.round(v * 10000) / 100).toFixed(2) + "%";
  }

  function stopInternal(reason) {
    running = false;
    queue = [];
    inFlight = 0;
    if (timer) clearInterval(timer);
    timer = null;
    if (reason) emitLog("warn", "[Sycm][轮询] 已停止：" + reason);
  }

  function fetchOne(itemId) {
    var url = buildUrlForItem(itemId);
    if (!url) return Promise.reject(new Error("bad template url"));
    emitLog("log", "[Sycm][轮询][请求] item " + String(itemId));
    return fetch(url, { method: "GET", credentials: "include" })
      .then(function (res) {
        return res.json().then(
          function (json) {
            return { ok: res.ok, status: res.status, json: json };
          },
          function () {
            return { ok: res.ok, status: res.status, json: null };
          },
        );
      })
      .then(function (r) {
        if (!r.ok || !r.json || r.json.code !== 0) {
          var code =
            r.json && typeof r.json.code !== "undefined" ? r.json.code : "—";
          var message =
            r.json && (r.json.message || r.json.msg || r.json.subMsg)
              ? String(r.json.message || r.json.msg || r.json.subMsg)
              : "";
          var msg =
            "item " +
            String(itemId) +
            " 请求失败：HTTP " +
            r.status +
            " code=" +
            code +
            (message ? " message=" + message : "");
          emitLog("warn", "[Sycm][轮询][失败] " + msg);
          throw new Error(msg);
        }
        var payload = extractFlowMetrics(r.json);
        if (!payload) throw new Error("无法从响应解析到 搜索/购物车 节点");
        emitLog(
          "log",
          "[Sycm][轮询][详情] item " +
            String(itemId) +
            " │ 搜索UV=" +
            formatMetric(payload.search_uv) +
            " 搜索支付转化率=" +
            formatRate(payload.search_pay_rate) +
            " │ 购物车UV=" +
            formatMetric(payload.cart_uv) +
            " 购物车支付转化率=" +
            formatRate(payload.cart_pay_rate),
        );
        dispatchFlowSourceEvent(itemId, payload);
        return true;
      });
  }

  function drain() {
    if (!running) return;
    while (inFlight < maxConcurrency && queue.length > 0) {
      var itemId = queue.shift();
      inFlight++;
      fetchOne(itemId)
        .then(function () {
          // no-op
        })
        .catch(function (err) {
          // token/鉴权失效时通常会持续失败；这里直接停掉，要求重新捕获模板
          stopInternal(
            "请求失败，请打开任意商品详情页刷新模板后重试。错误：" +
              String((err && err.message) || err),
          );
        })
        .finally(function () {
          inFlight--;
          if (running) setTimeout(drain, 0);
        });
    }
  }

  function tick() {
    if (!running) return;
    if (!templateUrl) {
      stopInternal("未配置详情接口模板（请先打开详情页触发一次接口）");
      return;
    }
    if (!Array.isArray(queue) || queue.length === 0) return;
    emitLog("log", "[Sycm][轮询] 本轮待请求 " + queue.length + " 个商品");
    drain();
  }

  function start(opts) {
    opts = opts || {};
    var ids = opts.itemIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      emitLog("warn", "[Sycm][轮询] 未提供勾选商品，无法开始");
      return;
    }
    templateUrl =
      typeof opts.templateUrl === "string" ? opts.templateUrl : templateUrl;
    intervalMs =
      typeof opts.intervalMs === "number" && opts.intervalMs >= 5000
        ? opts.intervalMs
        : intervalMs;
    maxConcurrency =
      typeof opts.maxConcurrency === "number" && opts.maxConcurrency > 0
        ? opts.maxConcurrency
        : maxConcurrency;

    queue = ids.map(function (x) {
      return String(x);
    });
    running = true;
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      // 每个周期重新排队一次，保证“持续采集”
      queue = ids.map(function (x) {
        return String(x);
      });
      tick();
    }, intervalMs);
    emitLog(
      "log",
      "[Sycm][轮询] 已开始：商品 " +
        ids.length +
        " 个，间隔 " +
        Math.round(intervalMs / 1000) +
        " 秒，并发 " +
        maxConcurrency,
    );
    tick();
  }

  function stop() {
    stopInternal("用户停止");
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window || !e.data) return;
    if (e.data.type === "SYCM_FLOW_POLL_START") {
      start(e.data);
      return;
    }
    if (e.data.type === "SYCM_FLOW_POLL_STOP") {
      stop();
    }
  });

  emitLog("log", "[Sycm] flow-source-poller 已加载");
})();
