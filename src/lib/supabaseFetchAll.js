/**
 * Supabase（PostgREST）单次 select 默认最多返回 1000 行，超过需用 .range 分页拉满。
 * @see https://supabase.com/docs/reference/javascript/select
 */

/** 与 PostgREST 默认上限对齐；分页循环直到最后一页不足此长度 */
export const SUPABASE_PAGE_SIZE = 1000;

/**
 * 按固定排序分页拉取查询的完整结果，合并为单行数组后再使用（渲染、导出等）。
 *
 * 调用方传入的 `fetchPage` 必须对**同一套**过滤条件与**同一套** `.order(...)` 链式调用 `.range(from, to)`，
 * 保证多页之间顺序稳定、无重复无遗漏。
 *
 * @template T
 * @param {(from: number, to: number) => Promise<import('@supabase/supabase-js').PostgrestSingleResponse<T[]>>} fetchPage
 * @param {number} [pageSize=SUPABASE_PAGE_SIZE]
 * @returns {Promise<T[]>}
 */
export async function fetchAllRowsByPage(fetchPage, pageSize = SUPABASE_PAGE_SIZE) {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from = to + 1;
  }
  return rows;
}
