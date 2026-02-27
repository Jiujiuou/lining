-- ============================================================
-- goods_detail_slot_log：商品+时间槽宽表（加购 + 详情指标）
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 建表：一行 = 一个商品在一个 20 分钟时段
create table if not exists public.goods_detail_slot_log (
  id bigint generated always as identity primary key,
  item_id text not null,
  slot_ts timestamptz not null,
  item_name text,
  item_cart_cnt integer,
  search_uv integer,
  search_pay_rate numeric,
  cart_uv integer,
  cart_pay_rate numeric,
  unique (item_id, slot_ts)
);

comment on table public.goods_detail_slot_log is '商品按 20 分钟时间槽的加购与详情指标，加购来自 live.json，详情来自 flow 接口，两源 upsert 合并';

alter table public.goods_detail_slot_log enable row level security;

create policy "Allow anon insert for goods_detail_slot_log"
  on public.goods_detail_slot_log for insert to anon with check (true);

create policy "Allow anon select for goods_detail_slot_log"
  on public.goods_detail_slot_log for select to anon using (true);

create policy "Allow anon update for goods_detail_slot_log"
  on public.goods_detail_slot_log for update to anon using (true) with check (true);

alter publication supabase_realtime add table public.goods_detail_slot_log;

-- ============================================================
-- RPC：按 (item_id, slot_ts) 合并写入，只更新传入的非空列
-- 扩展调用此 RPC 替代直接 INSERT，实现 A/B 两源补全同一行
-- ============================================================
create or replace function public.merge_goods_detail_slot_log(p_row jsonb)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.goods_detail_slot_log (
    item_id,
    slot_ts,
    item_name,
    item_cart_cnt,
    search_uv,
    search_pay_rate,
    cart_uv,
    cart_pay_rate
  )
  values (
    p_row->>'item_id',
    (p_row->>'slot_ts')::timestamptz,
    nullif(p_row->>'item_name', ''),
    (p_row->'item_cart_cnt')::int,
    (p_row->'search_uv')::int,
    (p_row->'search_pay_rate')::numeric,
    (p_row->'cart_uv')::int,
    (p_row->'cart_pay_rate')::numeric
  )
  on conflict (item_id, slot_ts) do update set
    item_name    = coalesce(nullif(excluded.item_name, ''), goods_detail_slot_log.item_name),
    item_cart_cnt = coalesce(excluded.item_cart_cnt, goods_detail_slot_log.item_cart_cnt),
    search_uv    = coalesce(excluded.search_uv, goods_detail_slot_log.search_uv),
    search_pay_rate = coalesce(excluded.search_pay_rate, goods_detail_slot_log.search_pay_rate),
    cart_uv      = coalesce(excluded.cart_uv, goods_detail_slot_log.cart_uv),
    cart_pay_rate = coalesce(excluded.cart_pay_rate, goods_detail_slot_log.cart_pay_rate);
end;
$$;

-- 允许 anon 调用 RPC
grant execute on function public.merge_goods_detail_slot_log(jsonb) to anon;
