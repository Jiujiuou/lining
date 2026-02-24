/**
 * background.js - 扩展后台 Service Worker（Manifest V3）
 *
 * 职责：
 * 1. 监听标签页更新：当用户打开或刷新 sycm.taobao.com 且页面加载完成时，向该页面注入 inject.js
 * 2. 扩展启动时补注入：Chrome 启动后，对已经打开的 sycm 标签页再执行一次注入，避免「先开页面后装扩展」导致未注入
 *
 * 注入方式：使用 chrome.scripting.executeScript 将 inject.js 注入到 MAIN world（页面上下文），
 * 这样 inject.js 才能劫持页面的 fetch/XHR，与页面 JS 共享同一 window。
 */

var SYCM_ORIGIN = 'https://sycm.taobao.com';

/** 判断 URL 是否属于生意参谋域名 */
function isSycmUrl(url) {
  try {
    var u = new URL(url);
    return u.origin === SYCM_ORIGIN;
  } catch (e) {
    return false;
  }
}

/**
 * 向指定标签页注入 inject.js
 * @param {number} tabId -  Chrome 标签页 ID
 */
function inject(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['inject.js'],
    world: 'MAIN'  // 必须在页面主世界执行，才能重写 window.fetch / XMLHttpRequest
  }).then(function () {
    console.log('插件已注入成功');
  }).catch(function (err) {
    console.warn('插件注入失败，失败原因：', err.message || err);
  });
}

// 标签页加载完成时：若是 sycm 页面则注入
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  if (!isSycmUrl(tab.url)) return;
  inject(tabId);
});

// 扩展/浏览器启动时：对已打开的 sycm 标签补注入（用户可能先打开了 sycm 再刷新扩展）
chrome.runtime.onStartup.addListener(function () {
  chrome.tabs.query({ url: SYCM_ORIGIN + '/*' }, function (tabs) {
    tabs.forEach(function (tab) {
      if (isSycmUrl(tab.url)) inject(tab.id);
    });
  });
});

