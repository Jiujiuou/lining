/**
 * 图表数据点备注：读写 sycm_chart_point_notes 表
 * 表结构：chart_key, point_date, point_slot, note (unique: chart_key, point_date, point_slot)
 */

/**
 * 拉取备注：按 chart_key 列表与 point_date 列表筛选
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} chartKeys
 * @param {string[]} pointDates
 * @returns {Promise<Record<string, Record<string, string>>>} chartKey -> { "date|slot": note }
 */
export async function fetchChartNotes(client, chartKeys, pointDates) {
  if (!client || !chartKeys?.length || !pointDates?.length) {
    return {};
  }
  const { data, error } = await client
    .from('sycm_chart_point_notes')
    .select('chart_key, point_date, point_slot, note')
    .in('chart_key', chartKeys)
    .in('point_date', pointDates);

  if (error) {
    console.error('fetchChartNotes', error);
    return {};
  }

  const byChart = {};
  for (const row of data ?? []) {
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
