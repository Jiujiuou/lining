function walkByPageName(nodes, name) {
  if (!Array.isArray(nodes)) return null;

  for (const node of nodes) {
    if (node && node.pageName && node.pageName.value === name) return node;
    if (node && Array.isArray(node.children) && node.children.length > 0) {
      const found = walkByPageName(node.children, name);
      if (found) return found;
    }
  }

  return null;
}

function extractSycmItemListWithCart(data) {
  const inner = data && data.data && data.data.data;
  const list = inner && inner.data;
  if (!Array.isArray(list) || list.length === 0) return undefined;

  const items = [];
  for (const row of list) {
    const itemId =
      (row.item && row.item.itemId) ||
      (row.itemId && (row.itemId.value != null ? row.itemId.value : row.itemId));
    const title = row.item && row.item.title;
    const count = row.itemCartCnt;
    const itemCartCount =
      count != null && typeof count.value !== 'undefined'
        ? Number(count.value)
        : typeof count === 'number'
          ? count
          : null;

    if (!itemId) continue;

    items.push({
      item_id: String(itemId),
      item_name: title ? String(title) : '',
      item_cart_cnt: itemCartCount != null && !Number.isNaN(itemCartCount) ? itemCartCount : null,
    });
  }

  return items.length > 0 ? { items } : undefined;
}

export const PIPELINES = [
  {
    eventName: 'sycm-goods-live',
    urlContains: '/cc/item/view/foucs/live.json',
    urlFilter: null,
    multiValue: true,
    multiRows: true,
    mergeGoodsDetail: true,
    extractValue: extractSycmItemListWithCart,
  },
  {
    eventName: 'sycm-goods-live',
    urlContains: '/cc/item/live/view/top.json',
    urlFilter: null,
    multiValue: true,
    multiRows: true,
    mergeGoodsDetail: true,
    extractValue: extractSycmItemListWithCart,
  },
  {
    eventName: 'sycm-flow-source',
    urlContains: '/flow/v6/live/item/source/v4.json',
    urlFilter: null,
    multiValue: true,
    multiRows: false,
    fullRecord: true,
    mergeGoodsDetail: true,
    extractValue(data) {
      const list = data && data.data && data.data.data;
      if (!Array.isArray(list)) return undefined;

      const searchNode = walkByPageName(list, '搜索');
      const cartNode = walkByPageName(list, '购物车');
      if (!searchNode || !cartNode) return undefined;

      const searchUv =
        searchNode.uv && typeof searchNode.uv.value !== 'undefined'
          ? Number(searchNode.uv.value)
          : 0;
      const searchPayRateRaw =
        searchNode.payRate && typeof searchNode.payRate.value !== 'undefined'
          ? Number(searchNode.payRate.value)
          : 0;
      const cartUv =
        cartNode.uv && typeof cartNode.uv.value !== 'undefined' ? Number(cartNode.uv.value) : 0;
      const cartPayRateRaw =
        cartNode.payRate && typeof cartNode.payRate.value !== 'undefined'
          ? Number(cartNode.payRate.value)
          : 0;

      return {
        search_uv: searchUv,
        search_pay_rate: Math.round(searchPayRateRaw * 100) / 100,
        cart_uv: cartUv,
        cart_pay_rate: Math.round(cartPayRateRaw * 100) / 100,
      };
    },
  },
];

export const SYCM_CONFIG = { pipelines: PIPELINES };
