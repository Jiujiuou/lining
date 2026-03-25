/**
 * 联核 OA 上报页：监听 popup「填充数据」，按「数据日期」从 shop_record_daily 拉取并填入表单。
 * 表单常在 iframe 内，须在 document 树中递归查找含 field7068/7069 的文档后再写 input。
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
  var OA_FILL_MSG =
    typeof __SHOP_RECORD_DEFAULTS__ !== "undefined" &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME &&
    __SHOP_RECORD_DEFAULTS__.RUNTIME.OA_FILL_REPORT_MESSAGE
      ? __SHOP_RECORD_DEFAULTS__.RUNTIME.OA_FILL_REPORT_MESSAGE
      : "SR_OA_FILL_REPORT";

  var supabaseCfg =
    typeof __SHOP_RECORD_SUPABASE__ !== "undefined" ? __SHOP_RECORD_SUPABASE__ : null;

  /** input id → shop_record_daily 列名 */
  var FIELD_TO_COLUMN = [
    ["field7069", "item_desc_match_score"],
    ["field7070", "sycm_pv"],
    ["field7071", "seller_service_score"],
    ["field7072", "sycm_uv"],
    ["field7073", "seller_shipping_score"],
    ["field7074", "sycm_pay_buyers"],
    ["field7075", "refund_finish_duration"],
    ["field7076", "sycm_pay_items"],
    ["field7077", "refund_finish_rate"],
    ["field7078", "sycm_pay_amount"],
    ["field7079", "dispute_refund_rate"],
    ["field7080", "sycm_aov"],
    ["field7081", "taobao_cps_spend_yuan"],
    ["field7082", "sycm_pay_cvr"],
    ["field7083", "ztc_charge_yuan"],
    ["field7084", "sycm_old_visitor_ratio"],
    ["field7085", "ztc_cvr"],
    ["field7086", "sycm_avg_stay_sec"],
    ["field7087", "ztc_ppc"],
    ["field7088", "sycm_avg_pv_depth"],
    ["field7089", "ztc_roi"],
    ["field7090", "sycm_bounce_rate"],
    ["field11452", "ylmf_charge_yuan"],
    ["field11453", "ylmf_cvr"],
    ["field11454", "ylmf_ppc"],
    ["field11455", "ylmf_roi"],
    ["field15851", "site_wide_charge_yuan"],
    ["field15852", "site_wide_roi"],
    ["field31083", "content_promo_charge_yuan"],
    ["field31084", "content_promo_roi"]
  ];

  var FIELD_ZERO = ["field13386", "field15095", "field15096", "field15097"];

  function appendLog(level, msg) {
    try {
      chrome.runtime.sendMessage({
        type: APPEND_LOG_TYPE,
        level: level || "log",
        msg: String(msg)
      });
    } catch (e) {
      /* ignore */
    }
  }

  /**
   * 在顶层 document 及同源 iframe 内深度优先查找包含 OA 表单字段的 document。
   */
  function findOaDocument(rootDoc, depth) {
    var d = rootDoc || document;
    var dep = depth == null ? 0 : depth;
    if (dep > 14 || !d) return null;
    if (d.getElementById("field7068") || d.getElementById("field7069")) return d;
    var frames = d.getElementsByTagName("iframe");
    var i;
    for (i = 0; i < frames.length; i++) {
      try {
        var inner = frames[i].contentDocument;
        if (inner) {
          var found = findOaDocument(inner, dep + 1);
          if (found) return found;
        }
      } catch (e) {
        /* cross-origin */
      }
    }
    return null;
  }

  function getReportDateYmd(doc) {
    var d = doc || document;
    var el = d.getElementById("field7068");
    if (el && el.value) return String(el.value).trim();
    var wrap = d.querySelector('[data-fieldname="shujrq"]');
    if (wrap) {
      var text = wrap.querySelector(".text");
      if (text && text.textContent) return text.textContent.trim();
    }
    return "";
  }

  function fetchDailyRow(reportAt, cfg) {
    if (!cfg || !cfg.url || !cfg.anonKey) {
      return Promise.reject(new Error("未配置 Supabase"));
    }
    var base = cfg.url.replace(/\/$/, "");
    var url =
      base +
      "/rest/v1/shop_record_daily?report_at=eq." +
      encodeURIComponent(reportAt) +
      "&select=*&limit=1";
    return fetch(url, {
      method: "GET",
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + cfg.anonKey,
        Accept: "application/json"
      }
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("请求失败 " + res.status + " " + t);
          });
        }
        return res.json();
      })
      .then(function (arr) {
        return Array.isArray(arr) && arr[0] ? arr[0] : null;
      });
  }

  function getOwnerWindow(el) {
    return el && el.ownerDocument && el.ownerDocument.defaultView
      ? el.ownerDocument.defaultView
      : typeof window !== "undefined"
        ? window
        : null;
  }

  /**
   * 用原型上的 value setter 写入，再派发 React/Ant Design 能识别的 InputEvent。
   * 仅改 DOM 不派发「真实」输入事件时，受控组件内部 state 与视图不同步，会出现空白直到用户点击（focus）才显示。
   */
  function setNativeInputValue(el, v) {
    var win = getOwnerWindow(el);
    var proto = win && win.HTMLInputElement ? win.HTMLInputElement.prototype : null;
    var str = v == null ? "" : String(v);
    if (proto) {
      var desc = Object.getOwnPropertyDescriptor(proto, "value");
      if (desc && desc.set) {
        desc.set.call(el, str);
      } else {
        el.value = str;
      }
    } else {
      el.value = str;
    }
  }

  function dispatchControlledInputEvents(el, str) {
    var win = getOwnerWindow(el);
    var InputCtor = win && win.InputEvent ? win.InputEvent : typeof InputEvent !== "undefined" ? InputEvent : null;
    /* 不派发 beforeinput：部分受控组件会 preventDefault，反而清空。 */
    var evInit = {
      bubbles: true,
      cancelable: true,
      inputType: "insertFromPaste",
      data: str
    };
    try {
      if (InputCtor) {
        el.dispatchEvent(new InputCtor("input", evInit));
      } else {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (e) {
      try {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (e2) {
        /* ignore */
      }
    }
    try {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      /* ignore */
    }
  }

  function focusInput(el) {
    try {
      el.focus({ preventScroll: true });
    } catch (e) {
      try {
        el.focus();
      } catch (e2) {
        /* ignore */
      }
    }
  }

  function setInputValue(doc, fieldId, value) {
    var el = doc.getElementById(fieldId);
    if (!el || el.tagName !== "INPUT" || el.type === "hidden") return false;
    var v = value == null || value === "" ? "" : String(value);
    focusInput(el);
    setNativeInputValue(el, v);
    dispatchControlledInputEvents(el, v);
    return true;
  }

  /**
   * 全部填完后让首个业务字段获得一次焦点再失焦，促使 OA/React 重绘（与手动点击输入框效果类似）。
   */
  function finalizeOaFormPaint(doc) {
    var el = doc.getElementById("field7069");
    if (!el || el.tagName !== "INPUT" || el.type === "hidden") return;
    focusInput(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        try {
          var b = doc.body;
          if (b && typeof b.focus === "function") {
            b.focus();
          }
        } catch (e) {
          try {
            el.blur();
          } catch (e2) {
            /* ignore */
          }
        }
      });
    });
  }

  function fillFromRow(doc, row) {
    var filled = [];
    var skippedCount = 0;
    var i;
    for (i = 0; i < FIELD_TO_COLUMN.length; i++) {
      var pair = FIELD_TO_COLUMN[i];
      var fid = pair[0];
      var col = pair[1];
      var raw = row[col];
      if (raw == null || raw === "") {
        skippedCount += 1;
        continue;
      }
      if (setInputValue(doc, fid, raw)) filled.push(fid + "=" + raw);
    }
    for (i = 0; i < FIELD_ZERO.length; i++) {
      if (setInputValue(doc, FIELD_ZERO[i], "0")) filled.push(FIELD_ZERO[i] + "=0");
    }
    finalizeOaFormPaint(doc);
    return { filled: filled, skippedCount: skippedCount };
  }

  function runFill() {
    if (!supabaseCfg || !supabaseCfg.url || !supabaseCfg.anonKey) {
      return Promise.reject(new Error("扩展未配置 Supabase"));
    }
    var oaDoc = findOaDocument(document, 0);
    if (!oaDoc) {
      return Promise.reject(
        new Error("未找到 OA 表单（请确认上报页已打开；若在跨域 iframe 中需另处理）")
      );
    }
    var ymd = getReportDateYmd(oaDoc);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      return Promise.reject(new Error("无法读取「数据日期」"));
    }
    appendLog(
      "log",
      PREFIX + " OA 填充：已定位表单文档，数据日期=" + ymd + "，正在请求 Supabase…"
    );
    return fetchDailyRow(ymd, supabaseCfg).then(function (row) {
      if (!row) {
        appendLog("warn", PREFIX + " OA 填充：Supabase 无 " + ymd + " 的记录");
        return { ok: false, reason: "no_row", ymd: ymd };
      }
      var result = fillFromRow(oaDoc, row);
      var sample = result.filled.slice(0, 12).join("；");
      appendLog(
        "log",
        PREFIX +
          " OA 填充完成 " +
          ymd +
          "，共写入 " +
          result.filled.length +
          " 项" +
          (result.skippedCount ? "（库中空字段 " + result.skippedCount + " 个未填）" : "") +
          (sample ? "。示例：" + sample + (result.filled.length > 12 ? "…" : "") : "")
      );
      return { ok: true, ymd: ymd, filledCount: result.filled.length };
    });
  }

  chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
    if (!request || request.type !== OA_FILL_MSG) return false;
    runFill()
      .then(function (res) {
        sendResponse(res && typeof res === "object" ? res : { ok: true });
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        appendLog("error", PREFIX + " OA 填充失败：" + msg);
        sendResponse({ ok: false, error: msg });
      });
    return true;
  });
})();
