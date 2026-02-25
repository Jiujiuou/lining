/**
 * 统一数据源与上报配置（pipelines）
 * 供 inject.js（抓数 + 派发事件）与 content.js（监听事件 + 写 Supabase）共用。
 * 注入到页面时挂到 window.__SYCM_CONFIG__；content 通过 manifest 先加载本文件，使用同一全局。
 */
(function (global) {
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

  var PIPELINES = [
    {
      eventName: 'sycm-cart-log',
      urlContains: '/cc/item/live/view/top.json',
      urlFilter: null,
      multiValue: false,
      multiRows: false,
      table: 'sycm_cart_log',
      valueKey: 'item_cart_cnt',
      fullRecord: false,
      extractValue: function (data) {
        var list = data && data.data && data.data.data && data.data.data.data;
        if (!Array.isArray(list) || list.length !== 1) return undefined;
        var row = list[0];
        var cnt = row && row.itemCartCnt;
        return cnt && typeof cnt.value !== 'undefined' ? cnt.value : cnt;
      }
    },
    {
      eventName: 'sycm-flow-source',
      urlContains: '/flow/v6/live/item/source/v4.json',
      urlFilter: null,
      multiValue: true,
      multiRows: false,
      table: 'sycm_flow_source_log',
      valueKey: null,
      fullRecord: true,
      extractValue: function (data) {
        var list = data && data.data && data.data.data;
        if (!Array.isArray(list)) return undefined;
        var searchNode = walkByPageName(list, '搜索');
        var cartNode = walkByPageName(list, '购物车');
        if (!searchNode || !cartNode) return undefined;
        var searchUv = searchNode.uv && typeof searchNode.uv.value !== 'undefined' ? Number(searchNode.uv.value) : 0;
        var searchPayRate = searchNode.payRate && typeof searchNode.payRate.value !== 'undefined' ? Number(searchNode.payRate.value) : 0;
        var cartUv = cartNode.uv && typeof cartNode.uv.value !== 'undefined' ? Number(cartNode.uv.value) : 0;
        var cartPayRateRaw = cartNode.payRate && typeof cartNode.payRate.value !== 'undefined' ? Number(cartNode.payRate.value) : 0;
        var cartPayRate = Math.round(cartPayRateRaw * 100) / 100;
        return {
          search_uv: searchUv,
          search_pay_rate: searchPayRate,
          cart_uv: cartUv,
          cart_pay_rate: cartPayRate
        };
      }
    },
    {
      eventName: 'sycm-market-rank',
      urlContains: '/mc/mq/mkt/item/live/rank.json',
      urlFilter: function (url) { return url.indexOf('keyWord=%E5%B0%8F%E8%B4%9D%E5%A3%B3') !== -1; },
      multiValue: true,
      multiRows: true,
      table: 'sycm_market_rank_log',
      valueKey: null,
      fullRecord: true,
      extractValue: function (data) {
        var inner = data && data.data && data.data.data;
        var list = inner && inner.data;
        if (!Array.isArray(list) || list.length === 0) return undefined;
        var items = [];
        for (var i = 0; i < list.length; i++) {
          var row = list[i];
          var shopTitle = (row.shop && (row.shop.title != null ? row.shop.title : row.shop.value)) || '';
          var rankVal = row.cateRankId && (typeof row.cateRankId.value !== 'undefined' ? row.cateRankId.value : row.cateRankId);
          var rank = rankVal != null ? Number(rankVal) : 0;
          if (shopTitle === '' && !rank) continue;
          items.push({ shop_title: String(shopTitle), rank: rank });
        }
        return items.length ? { items: items } : undefined;
      }
    }
  ];

  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_CONFIG__ = { pipelines: PIPELINES };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
