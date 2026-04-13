import { OU_RUNTIME, OU_UI } from '@/shared/constants.js';

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error =
        chrome.runtime && chrome.runtime.lastError
          ? chrome.runtime.lastError
          : null;
      resolve({ response: response || null, error });
    });
  });
}

function executeContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ['order-userdata-cs.js'],
      },
      () => {
        const error =
          chrome.runtime && chrome.runtime.lastError
            ? chrome.runtime.lastError
            : null;
        resolve({ error });
      },
    );
  });
}

function queryTabs(queryInfo) {
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      resolve(Array.isArray(tabs) ? tabs : []);
    });
  });
}

function updateTab(tabId, updateProperties) {
  return new Promise((resolve) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => {
      resolve(tab || null);
    });
  });
}

function createTab(createProperties) {
  return new Promise((resolve) => {
    chrome.tabs.create(createProperties, (tab) => {
      resolve(tab || null);
    });
  });
}

function waitTabComplete(tabId) {
  return new Promise((resolve) => {
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
        return;
      }
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function tryStartOnTab(tabId, payload, allowInjectRetry = true) {
  const { error } = await sendMessageToTab(tabId, {
    type: OU_RUNTIME.GET_USER_DATA,
    unionSearch: payload.unionSearch,
    buyerNick: payload.buyerNick,
    orderStatus: payload.orderStatus,
    payDateBegin: payload.payDateBegin || '',
    payDateEnd: payload.payDateEnd || '',
  });

  if (!error) {
    return { ok: true };
  }

  if (!allowInjectRetry) {
    return { ok: false, error };
  }

  const injectResult = await executeContentScript(tabId);
  if (injectResult.error) {
    return { ok: false, error: injectResult.error };
  }

  await new Promise((resolve) => setTimeout(resolve, 800));
  const retry = await sendMessageToTab(tabId, {
    type: OU_RUNTIME.GET_USER_DATA,
    unionSearch: payload.unionSearch,
    buyerNick: payload.buyerNick,
    orderStatus: payload.orderStatus,
    payDateBegin: payload.payDateBegin || '',
    payDateEnd: payload.payDateEnd || '',
  });
  if (retry.error) {
    return { ok: false, error: retry.error };
  }
  return { ok: true };
}

function normalizeErrorText(error) {
  if (!error) {
    return '未知错误';
  }
  return String(error.message || error);
}

export async function startOrderUserdataJob(payload, callbacks = {}) {
  const onInfo = typeof callbacks.onInfo === 'function' ? callbacks.onInfo : () => {};
  const onError =
    typeof callbacks.onError === 'function' ? callbacks.onError : () => {};

  const activeTabs = await queryTabs({ active: true, currentWindow: true });
  const activeTab = activeTabs[0] || null;

  if (
    activeTab &&
    activeTab.id != null &&
    activeTab.url &&
    OU_UI.QN_OR_TRADE_REG.test(activeTab.url)
  ) {
    const result = await tryStartOnTab(activeTab.id, payload);
    if (result.ok) {
      return { ok: true };
    }
    onError('无法与页面通信，请刷新已卖出订单页后重试');
    return { ok: false, error: normalizeErrorText(result.error) };
  }

  const tabs = await queryTabs({
    url: ['https://qn.taobao.com/*', 'https://trade.taobao.com/*'],
  });
  const existedTab = tabs[0] || null;
  if (existedTab && existedTab.id != null) {
    await updateTab(existedTab.id, { active: true });
    const result = await tryStartOnTab(existedTab.id, payload);
    if (result.ok) {
      return { ok: true };
    }
    onError('无法与页面通信，请刷新已卖出订单页后重试');
    return { ok: false, error: normalizeErrorText(result.error) };
  }

  const newTab = await createTab({ url: OU_UI.SOLD_PAGE_URL });
  if (!newTab || newTab.id == null) {
    onError('打开已卖出订单页失败');
    return { ok: false, error: 'create tab failed' };
  }

  onInfo('已打开已卖出订单页，加载完成后将自动开始');
  await waitTabComplete(newTab.id);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const result = await tryStartOnTab(newTab.id, payload);
  if (result.ok) {
    return { ok: true };
  }

  onError('无法与页面通信，请刷新已卖出订单页后重试');
  return { ok: false, error: normalizeErrorText(result.error) };
}

export async function stopOrderUserdataJob() {
  const activeTabs = await queryTabs({ active: true, currentWindow: true });
  const activeTab = activeTabs[0] || null;
  if (activeTab && activeTab.id != null) {
    const result = await sendMessageToTab(activeTab.id, { type: OU_RUNTIME.STOP_USER_DATA });
    if (!result.error) return { ok: true };
  }

  const tabs = await queryTabs({
    url: ['https://qn.taobao.com/*', 'https://trade.taobao.com/*'],
  });
  for (let i = 0; i < tabs.length; i += 1) {
    const tab = tabs[i];
    if (!tab || tab.id == null) continue;
    const result = await sendMessageToTab(tab.id, { type: OU_RUNTIME.STOP_USER_DATA });
    if (!result.error) return { ok: true };
  }
  return { ok: false, error: 'stop message failed' };
}


