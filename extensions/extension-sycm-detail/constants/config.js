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

  /** foucs/live.json 与 live/view/top.json 共用：data.data.data.data 为商品数组 */
  function extractSycmItemListWithCart(data) {
    var inner = data && data.data && data.data.data;
    var list = inner && inner.data;
    if (!Array.isArray(list) || list.length === 0) return undefined;
    var items = [];
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      var itemId = (row.item && row.item.itemId) || (row.itemId && (row.itemId.value != null ? row.itemId.value : row.itemId));
      var title = row.item && row.item.title;
      var cnt = row.itemCartCnt;
      var itemCartCnt = cnt != null && typeof cnt.value !== 'undefined' ? Number(cnt.value) : (typeof cnt === 'number' ? cnt : null);
      if (!itemId) continue;
      items.push({
        item_id: String(itemId),
        item_name: title ? String(title) : '',
        item_cart_cnt: itemCartCnt != null && !isNaN(itemCartCnt) ? itemCartCnt : null
      });
    }
    return items.length ? { items: items } : undefined;
  }

  var PIPELINES = [
    // 多商品加购：关注列表 live.json → goods_detail_slot_log（merge），popup 同步列表
    {
      eventName: 'sycm-goods-live',
      urlContains: '/cc/item/view/foucs/live.json',
      urlFilter: null,
      multiValue: true,
      multiRows: true,
      mergeGoodsDetail: true,
      extractValue: extractSycmItemListWithCart
    },
    // 多商品加购：实时 top 榜 top.json（结构同 live），同一 eventName / 白名单 / 时间槽 / popup 列表
    {
      eventName: 'sycm-goods-live',
      urlContains: '/cc/item/live/view/top.json',
      urlFilter: null,
      multiValue: true,
      multiRows: true,
      mergeGoodsDetail: true,
      extractValue: extractSycmItemListWithCart
    },
    // 详情（流量来源）：每商品一页，写入 goods_detail_slot_log（merge），需从 URL 带 itemId
    {
      eventName: 'sycm-flow-source',
      urlContains: '/flow/v6/live/item/source/v4.json',
      urlFilter: null,
      multiValue: true,
      multiRows: false,
      fullRecord: true,
      mergeGoodsDetail: true,
      extractValue: function (data) {
        var list = data && data.data && data.data.data;
        if (!Array.isArray(list)) return undefined;
        var searchNode = walkByPageName(list, '搜索');
        var cartNode = walkByPageName(list, '购物车');
        if (!searchNode || !cartNode) return undefined;
        var searchUv = searchNode.uv && typeof searchNode.uv.value !== 'undefined' ? Number(searchNode.uv.value) : 0;
        var searchPayRateRaw = searchNode.payRate && typeof searchNode.payRate.value !== 'undefined' ? Number(searchNode.payRate.value) : 0;
        var searchPayRate = Math.round(searchPayRateRaw * 100) / 100;
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
