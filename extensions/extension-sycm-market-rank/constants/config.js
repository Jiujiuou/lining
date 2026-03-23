/**
 * 仅市场排名：与 extension-sycm-detail 中 rank 段一致，但不限制 url 中的 keyWord（由 popup 勾选白名单过滤）
 */
(function (global) {
  var PIPELINES = [
    {
      eventName: 'sycm-market-rank',
      urlContains: '/mc/mq/mkt/item/live/rank.json',
      urlFilter: null,
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

  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_CONFIG__ = { pipelines: PIPELINES };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
