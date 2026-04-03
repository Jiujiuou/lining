import {
  PREFIX,
  SHOP_RECORD_DEFAULTS,
  STORAGE_KEYS,
  pickSnapshotFromDailyBag,
  validateReportSnapshotForFill,
} from '../defaults.js';
import { createPrefixedRuntimeLogger } from '../../shared/chrome/ext-log.js';
import { getLocalDateYmd } from '../../shared/time/date-key.js';

{
  var APPEND_LOG_TYPE = SHOP_RECORD_DEFAULTS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE;
  var FILL_MSG = SHOP_RECORD_DEFAULTS.RUNTIME.CONTENT_FILL_REPORT_MESSAGE;
  var FALLBACK_DAILY_BAG_KEY = 'shop_record_daily_local_by_date';
  var extLog = createPrefixedRuntimeLogger(APPEND_LOG_TYPE, PREFIX);
  var MSG_FILL_SNAPSHOT = 'SR_FILL_SNAPSHOT';
  var MSG_FILL_DONE = 'SR_FILL_SNAPSHOT_DONE';

  function getDailyStorageKey() {
    return STORAGE_KEYS.dailyLocalByDate || FALLBACK_DAILY_BAG_KEY;
  }
  function pickSnapshotFromBagInline(bag) {
    if (!bag || typeof bag !== 'object') return null;
    var ymd = getLocalDateYmd(-1);
    if (bag[ymd]) return bag[ymd];
    var dates = Object.keys(bag).filter(function (k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    });
    dates.sort();
    return dates.length ? bag[dates[dates.length - 1]] : null;
  }

  function runFillAfterBagLoaded(bag, sendResponse) {
    var snap = pickSnapshotFromDailyBag(bag) || pickSnapshotFromBagInline(bag);
    if (!snap) {
      extLog('上报页：未找到本地快照，请先完成数据采集');
      sendResponse({ ok: false, error: 'no_snapshot' });
      return;
    }

    var vr = validateReportSnapshotForFill(snap);
    if (!vr.ok) {
      var miss = vr.missing || [];
      miss.slice(0, 3).forEach(function (m) {
        extLog('上报页：缺少字段 ' + m.label);
      });
      if (miss.length > 3) {
        extLog('上报页：其余缺失字段已省略，数量=' + String(miss.length - 3));
      }
      extLog('上报页：快照不完整，已阻止填报（缺失=' + miss.length + '）');
      sendResponse({ ok: false, error: 'incomplete_data', missingCount: miss.length });
      return;
    }

    extLog('上报页：开始填报，统计日期=' + (snap.report_at || ''));
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMainDone);
      extLog('上报页：主世界填报超时');
      sendResponse({ ok: false, error: 'main_world_timeout' });
    }, 15000);

    function onMainDone(ev) {
      if (ev.source !== window || !ev.data || ev.data.type !== MSG_FILL_DONE) return;
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMainDone);
      if (ev.data.ok) {
        extLog(
          'report page: fill done, filled=' +
            ev.data.filled +
            ', report_at=' +
            (ev.data.reportAt || snap.report_at || ''),
        );
        sendResponse({ ok: true, filled: ev.data.filled, reportAt: ev.data.reportAt || snap.report_at || '' });
      } else {
        extLog('上报页：主世界填报失败 ' + String(ev.data.error || ''));
        sendResponse({ ok: false, error: String(ev.data.error || 'fill_failed') });
      }
    }

    window.addEventListener('message', onMainDone);
    window.postMessage({ type: MSG_FILL_SNAPSHOT, snap: snap }, '*');
  }

  function runFill(sendResponse) {
    var key = getDailyStorageKey();
    chrome.storage.local.get([key], function (result) {
      if (chrome.runtime && chrome.runtime.lastError) {
        extLog('上报页：读取本地存储失败 ' + String(chrome.runtime.lastError.message));
        sendResponse({ ok: false, error: String(chrome.runtime.lastError.message) });
        return;
      }
      var bag = result[key];
      if (bag !== undefined && bag !== null) {
        runFillAfterBagLoaded(bag, sendResponse);
        return;
      }
      chrome.storage.local.get(null, function (all) {
        if (chrome.runtime && chrome.runtime.lastError) {
          extLog('上报页：读取本地存储失败 ' + String(chrome.runtime.lastError.message));
          sendResponse({ ok: false, error: String(chrome.runtime.lastError.message) });
          return;
        }
        var bag2 = (all && all[key]) || (all && all[FALLBACK_DAILY_BAG_KEY]) || null;
        runFillAfterBagLoaded(bag2, sendResponse);
      });
    });
  }

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (!request || request.type !== FILL_MSG) return false;
    runFill(sendResponse);
    return true;
  });
}
