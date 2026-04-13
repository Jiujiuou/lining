(function() {
  "use strict";
  (function(global) {
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
    function extractSycmItemListWithCart(data) {
      var inner = data && data.data && data.data.data;
      var list = inner && inner.data;
      if (!Array.isArray(list) || list.length === 0) return void 0;
      var items = [];
      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        var itemId = row.item && row.item.itemId || row.itemId && (row.itemId.value != null ? row.itemId.value : row.itemId);
        var title = row.item && row.item.title;
        var cnt = row.itemCartCnt;
        var itemCartCnt = cnt != null && typeof cnt.value !== "undefined" ? Number(cnt.value) : typeof cnt === "number" ? cnt : null;
        if (!itemId) continue;
        items.push({
          item_id: String(itemId),
          item_name: title ? String(title) : "",
          item_cart_cnt: itemCartCnt != null && !isNaN(itemCartCnt) ? itemCartCnt : null
        });
      }
      return items.length ? { items } : void 0;
    }
    var PIPELINES = [
      // 多商品加购：关注列表 live.json → goods_detail_slot_log（merge），popup 同步列表
      {
        eventName: "sycm-goods-live",
        urlContains: "/cc/item/view/foucs/live.json",
        urlFilter: null,
        multiValue: true,
        multiRows: true,
        mergeGoodsDetail: true,
        extractValue: extractSycmItemListWithCart
      },
      // 多商品加购：实时 top 榜 top.json（结构同 live），同一 eventName / 白名单 / 时间槽 / popup 列表
      {
        eventName: "sycm-goods-live",
        urlContains: "/cc/item/live/view/top.json",
        urlFilter: null,
        multiValue: true,
        multiRows: true,
        mergeGoodsDetail: true,
        extractValue: extractSycmItemListWithCart
      },
      // 详情（流量来源）：每商品一页，写入 goods_detail_slot_log（merge），需从 URL 带 itemId
      {
        eventName: "sycm-flow-source",
        urlContains: "/flow/v6/live/item/source/v4.json",
        urlFilter: null,
        multiValue: true,
        multiRows: false,
        fullRecord: true,
        mergeGoodsDetail: true,
        extractValue: function(data) {
          var list = data && data.data && data.data.data;
          if (!Array.isArray(list)) return void 0;
          var searchNode = walkByPageName(list, "搜索");
          var cartNode = walkByPageName(list, "购物车");
          if (!searchNode || !cartNode) return void 0;
          var searchUv = searchNode.uv && typeof searchNode.uv.value !== "undefined" ? Number(searchNode.uv.value) : 0;
          var searchPayRateRaw = searchNode.payRate && typeof searchNode.payRate.value !== "undefined" ? Number(searchNode.payRate.value) : 0;
          var searchPayRate = Math.round(searchPayRateRaw * 100) / 100;
          var cartUv = cartNode.uv && typeof cartNode.uv.value !== "undefined" ? Number(cartNode.uv.value) : 0;
          var cartPayRateRaw = cartNode.payRate && typeof cartNode.payRate.value !== "undefined" ? Number(cartNode.payRate.value) : 0;
          var cartPayRate = Math.round(cartPayRateRaw * 100) / 100;
          return {
            search_uv: searchUv,
            search_pay_rate: searchPayRate,
            cart_uv: cartUv,
            cart_pay_rate: cartPayRate
          };
        }
      }
    ];
    (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_CONFIG__ = { pipelines: PIPELINES };
  })(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
  const mod = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null
  }, Symbol.toStringTag, { value: "Module" }));
  globalThis.__SYCM_DETAIL_CONFIG__ = mod;
})();
//# sourceMappingURL=config.js.map
