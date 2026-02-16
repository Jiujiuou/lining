/**
 * 仅在 sycm.taobao.com 页面加载完成后注入 inject.js；扩展启动时对已打开的 sycm 页面补注入一次。
 */
var SYCM_ORIGIN = 'https://sycm.taobao.com';

function isSycmUrl(url) {
  try {
    var u = new URL(url);
    return u.origin === SYCM_ORIGIN;
  } catch (e) {
    return false;
  }
}

function inject(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['inject.js'],
    world: 'MAIN'
  }).then(function () {
    console.log('[Sycm Data Capture] 已向 tab ' + tabId + ' 注入 inject.js');
  }).catch(function (err) {
    console.warn('[Sycm Data Capture] 注入失败 tabId=' + tabId, err.message || err);
  });
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (!isSycmUrl(tab.url)) return;
  inject(tabId);
});

chrome.runtime.onStartup.addListener(function () {
  chrome.tabs.query({ url: SYCM_ORIGIN + '/*' }, function (tabs) {
    tabs.forEach(function (tab) {
      if (isSycmUrl(tab.url)) inject(tab.id);
    });
  });
});
