-- ============================================================
-- 商品维度数据点备注（与具体指标图无关）
-- 语义：同一 item_id 在同一 point_date + point_slot 仅一条备注，
--       适用于该商品下「商品加购 / 流量来源」等全部图表。
-- 在 Supabase Dashboard → SQL Editor 中执行。
--
-- 与 sycm_chart_point_notes 的关系：
--   - chart_point_notes：按 chart_key（图表/序列）区分，用于「店铺排名」等多序列视图。
--   - 本表：按 item_id 区分，用于商品详情多指标看板的共享备注。
-- ============================================================

create table if not exists public.goods_detail_item_point_notes (
  id bigint generated always as identity primary key,
  item_id text not null,
  point_date text not null,
  point_slot text not null,
  note text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (item_id, point_date, point_slot)
);

create index if not exists goods_detail_item_point_notes_item_date_idx
  on public.goods_detail_item_point_notes (item_id, point_date);

alter table public.goods_detail_item_point_notes enable row level security;

create policy "Allow anon select for goods_detail_item_point_notes"
  on public.goods_detail_item_point_notes for select to anon using (true);

create policy "Allow anon insert for goods_detail_item_point_notes"
  on public.goods_detail_item_point_notes for insert to anon with check (true);

create policy "Allow anon update for goods_detail_item_point_notes"
  on public.goods_detail_item_point_notes for update to anon using (true) with check (true);

-- 从旧表迁移：见 sql/migrate_chart_point_notes_to_goods_item_notes.sql
-- （仅「-商品加购件数」类 key 可通过 slot_log 匹配 item_id；「流量来源-*」无法自动迁移。）
