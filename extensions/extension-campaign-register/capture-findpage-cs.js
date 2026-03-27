/**
 * 隔离世界：接收主世界 FIND_PAGE_CAPTURED，写入本扩展 storage（仅按 tab 分桶 + 无 tabId 时全局兜底）
 */
(function () {
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (g.__LINING_AMCR_CS__) return;
    g.__LINING_AMCR_CS__ = true;
  } catch (e) {
    return;
  }

  var STATE_BY_TAB = 'amcr_findPageStateByTab';
  var MAX_FINDPAGE_TABS =
    typeof __AMCR_DEFAULTS__ !== 'undefined' && __AMCR_DEFAULTS__.FIND_PAGE_MAX_TABS
      ? __AMCR_DEFAULTS__.FIND_PAGE_MAX_TABS
      : 6;
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

  var tabIdCache = '__pending__';
  var tabIdWaiters = [];
  function resolveTabId(callback) {
    if (typeof tabIdCache === 'number') {
      callback(tabIdCache);
      return;
    }
    if (tabIdCache === false) {
      callback(null);
      return;
    }
    tabIdWaiters.push(callback);
    if (tabIdWaiters.length > 1) return;
    try {
      chrome.runtime.sendMessage({ type: 'AMCR_GET_TAB_ID' }, function (res) {
        if (chrome.runtime.lastError || !res || res.tabId == null) {
          tabIdCache = false;
        } else {
          tabIdCache = res.tabId;
        }
        var tid = typeof tabIdCache === 'number' ? tabIdCache : null;
        var w = tabIdWaiters.slice();
        tabIdWaiters = [];
        for (var i = 0; i < w.length; i++) w[i](tid);
      });
    } catch (err) {
      tabIdCache = false;
      var w2 = tabIdWaiters.slice();
      tabIdWaiters = [];
      for (var j = 0; j < w2.length; j++) w2[j](null);
    }
  }

  function sendCaptureLog(tabId, msg) {
    try {
      chrome.runtime.sendMessage({ type: 'AMCR_CAPTURE_LOG', tabId: tabId != null ? tabId : null, msg: msg }, function () {});
    } catch (e) {}
  }

  function bizLabel(bizCode) {
    var m = {
      onebpDisplay: '人群',
      onebpSite: '货品全站',
      onebpSearch: '关键词',
      onebpShortVideo: '内容营销'
    };
    return m[bizCode] || '未知来源';
  }

  /**
   * 仅保留弹窗列表与登记 RPC 所需字段，避免整包 findPage 撑爆 storage 配额。
   */
  function slimReportRow(r) {
    if (!r || typeof r !== 'object') return null;
    var cond = r.condition && typeof r.condition === 'object' ? r.condition : null;
    return {
      campaignName: r.campaignName,
      charge: r.charge,
      alipayInshopAmt: r.alipayInshopAmt,
      condition: cond
        ? {
            startTime: cond.startTime,
            endTime: cond.endTime
          }
        : null
    };
  }

  function slimCampaignItem(item) {
    if (!item || typeof item !== 'object') return item;
    var reports = item.reportInfoList;
    var slimReports = null;
    if (Array.isArray(reports) && reports.length > 0) {
      var r0 = slimReportRow(reports[0]);
      slimReports = r0 ? [r0] : null;
    }
    return {
      campaignId: item.campaignId,
      campaignName: item.campaignName,
      onlineStatus: item.onlineStatus,
      displayStatus: item.displayStatus,
      reportInfoList: slimReports
    };
  }

  function slimFindPagePayload(payload) {
    if (!payload || typeof payload !== 'object' || !payload.data || !Array.isArray(payload.data.list)) {
      return payload;
    }
    try {
      var slimList = [];
      for (var i = 0; i < payload.data.list.length; i++) {
        slimList.push(slimCampaignItem(payload.data.list[i]));
      }
      return {
        data: {
          count: payload.data.count,
          list: slimList
        }
      };
    } catch (e) {
      return payload;
    }
  }

  function parseBizCodeFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      var q = url.indexOf('?');
      if (q < 0) return '';
      var params = new URLSearchParams(url.slice(q));
      var bizCode = params.get('bizCode') || params.get('mx_bizCode') || '';
      var allowed = { onebpDisplay: 1, onebpSite: 1, onebpSearch: 1, onebpShortVideo: 1 };
      return allowed[bizCode] ? bizCode : '';
    } catch (e) {
      return '';
    }
  }

  function pruneFindPageByTab(byTab) {
    if (!byTab || typeof byTab !== 'object') return {};
    var tabIds = Object.keys(byTab);
    if (tabIds.length <= MAX_FINDPAGE_TABS) return byTab;
    tabIds.sort(function (a, b) {
      var ta = byTab[a] && byTab[a].lastTouchedAt ? byTab[a].lastTouchedAt : '';
      var tb = byTab[b] && byTab[b].lastTouchedAt ? byTab[b].lastTouchedAt : '';
      return String(ta).localeCompare(String(tb));
    });
    while (tabIds.length > MAX_FINDPAGE_TABS) {
      delete byTab[tabIds.shift()];
    }
    return byTab;
  }

  function onMessage(event) {
    if (event.source !== window || !event.data || event.data.type !== 'FIND_PAGE_CAPTURED') return;
    if (window !== window.top) {
      return;
    }
    var payload = event.data.payload;
    if (!payload) return;
    var list = payload.data && Array.isArray(payload.data.list) ? payload.data.list : [];
    if (list.length === 0) return;
    var requestUrl = event.data.requestUrl || '';
    try {
      var biz = parseBizCodeFromUrl(requestUrl);
      resolveTabId(function (tabId) {
        var pageUrl = event.data.pageUrl || '';
        var slimPayload = slimFindPagePayload(payload);
        if (tabId == null) {
          safeSet(
            {
              amcr_findPageResponse: slimPayload,
              amcr_findPageRequestUrl: requestUrl,
              amcr_findPagePageUrl: pageUrl,
              amcr_findPageBizCode: biz
            },
            function (quotaErr) {
              if (quotaErr || chrome.runtime.lastError) {
                sendCaptureLog(null, '已捕获列表，但缓存保存失败（稍后重试）');
              } else {
                sendCaptureLog(
                  null,
                  '已捕获到推广列表：' + list.length + ' 条（' + bizLabel(biz) + '）'
                );
              }
            }
          );
          return;
        }
        chrome.storage.local.get([STATE_BY_TAB], function (r) {
          var byTab = r && r[STATE_BY_TAB] ? r[STATE_BY_TAB] : {};
          byTab[String(tabId)] = {
            findPageResponse: slimPayload,
            findPageRequestUrl: requestUrl,
            findPagePageUrl: pageUrl,
            findPageBizCode: biz,
            findPageSelectedCampaigns: {},
            lastTouchedAt: new Date().toISOString()
          };
          byTab = pruneFindPageByTab(byTab);
          var o = {};
          o[STATE_BY_TAB] = byTab;
          safeSet(o, function (quotaErr) {
            if (quotaErr || chrome.runtime.lastError) {
              sendCaptureLog(tabId, '已捕获列表，但缓存保存失败（稍后重试）');
            } else {
              sendCaptureLog(
                tabId,
                '已捕获到推广列表：' + list.length + ' 条（' + bizLabel(biz) + '）'
              );
            }
          });
        });
      });
    } catch (e) {}
  }
  window.addEventListener('message', onMessage);
})();
