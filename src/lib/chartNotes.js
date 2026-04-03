import { fetchAllRowsByPage } from './supabaseFetchAll';

/**
 * 图表数据点备注：读写 sycm_chart_point_notes 表
 * 设计原则：按「图表序列标识 chart_key + 日期 + 时段」唯一，适用于店铺排名等「每条线一个 key」的场景。
 * 表结构：chart_key, point_date, point_slot, note (unique: chart_key, point_date, point_slot)
 */

/**
 * 商品维度备注：读写 goods_detail_item_point_notes 表
 * 设计原则：按「item_id + 日期 + 时段」唯一，备注属于商品，与具体指标（加购/搜索等）无关。
 */

/**
 * 拉取某商品在若干日期内的备注，合并为与图表相同的 map： "date|slot" -> note
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} itemId
 * @param {string[]} pointDates
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchGoodsItemPointNotes(client, itemId, pointDates) {
  if (!client || itemId == null || itemId === '' || !pointDates?.length) {
    return {};
  }
  let allRows;
  try {
    allRows = await fetchAllRowsByPage((from, to) =>
      client
        .from('goods_detail_item_point_notes')
        .select('item_id, point_date, point_slot, note')
        .eq('item_id', String(itemId))
        .in('point_date', pointDates)
        .order('point_date')
        .order('point_slot')
        .range(from, to),
    );
  } catch (_error) {
    return {};
  }
  const map = {};
  for (const row of allRows) {
    const mapKey = `${row.point_date}|${row.point_slot ?? ''}`;
    map[mapKey] = row.note ?? '';
  }
  return map;
}

/**
 * 插入或更新一条商品维度备注
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} itemId
 * @param {string} pointDate
 * @param {string} pointSlot
 * @param {string} note
 */
export async function upsertGoodsItemPointNote(client, itemId, pointDate, pointSlot, note) {
  if (!client) throw new Error('Supabase client required');
  const { error } = await client.from('goods_detail_item_point_notes').upsert(
    {
      item_id: String(itemId),
      point_date: pointDate,
      point_slot: pointSlot ?? '',
      note: note ?? '',
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'item_id,point_date,point_slot',
    },
  );
  if (error) throw error;
}

/**
 * 拉取备注：按 chart_key 列表与 point_date 列表筛选（分页拉满后再组装）
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} chartKeys
 * @param {string[]} pointDates
 * @returns {Promise<Record<string, Record<string, string>>>} chartKey -> { "date|slot": note }
 */
export async function fetchChartNotes(client, chartKeys, pointDates) {
  if (!client || !chartKeys?.length || !pointDates?.length) {
    return {};
  }
  let allRows;
  try {
    allRows = await fetchAllRowsByPage((from, to) =>
      client
        .from('sycm_chart_point_notes')
        .select('chart_key, point_date, point_slot, note')
        .in('chart_key', chartKeys)
        .in('point_date', pointDates)
        .order('chart_key')
        .order('point_date')
        .order('point_slot')
        .range(from, to),
    );
  } catch (_error) {
    return {};
  }

  const byChart = {};
  for (const row of allRows) {
    const key = row.chart_key;
    const mapKey = `${row.point_date}|${row.point_slot ?? ''}`;
    if (!byChart[key]) byChart[key] = {};
    byChart[key][mapKey] = row.note ?? '';
  }
  return byChart;
}

/**
 * 插入或更新一条备注（upsert）
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} chartKey
 * @param {string} pointDate
 * @param {string} pointSlot
 * @param {string} note
 */
export async function upsertChartNote(client, chartKey, pointDate, pointSlot, note) {
  if (!client) throw new Error('Supabase client required');
  const { error } = await client.from('sycm_chart_point_notes').upsert(
    {
      chart_key: chartKey,
      point_date: pointDate,
      point_slot: pointSlot ?? '',
      note: note ?? '',
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'chart_key,point_date,point_slot',
    }
  );
  if (error) throw error;
}
