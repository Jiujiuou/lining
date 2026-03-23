-- ============================================================
-- 迁移：goods_detail_slot_log.item_name 禁止 NULL
-- 在 Supabase SQL Editor 中按顺序执行（已有表时）
-- ============================================================

-- 1) 删除无有效商品名的行（NULL 或仅空白，无法展示于 /data 下拉）
delete from public.goods_detail_slot_log
where coalesce(trim(item_name), '') = '';

-- 2) 约束：禁止 NULL，且禁止仅空白（与扩展 ensureItemName / RPC 一致）
alter table public.goods_detail_slot_log
  alter column item_name set not null;

alter table public.goods_detail_slot_log
  drop constraint if exists goods_detail_slot_log_item_name_nonempty;

alter table public.goods_detail_slot_log
  add constraint goods_detail_slot_log_item_name_nonempty
  check (length(trim(item_name)) > 0);

-- 3) RPC：写入前将空标题回落为 item_id，保证永不插入 NULL
create or replace function public.merge_goods_detail_slot_log(p_row jsonb)
returns void
language plpgsql
security definer
as $$
declare
  v_item_id text;
  v_item_name text;
begin
  v_item_id := nullif(trim(p_row->>'item_id'), '');
  if v_item_id is null then
    raise exception 'merge_goods_detail_slot_log: item_id required';
  end if;
  v_item_name := coalesce(nullif(trim(p_row->>'item_name'), ''), v_item_id);

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
    v_item_id,
    (p_row->>'slot_ts')::timestamptz,
    v_item_name,
    (p_row->'item_cart_cnt')::int,
    (p_row->'search_uv')::int,
    (p_row->'search_pay_rate')::numeric,
    (p_row->'cart_uv')::int,
    (p_row->'cart_pay_rate')::numeric
  )
  on conflict (item_id, slot_ts) do update set
    item_name = coalesce(
      nullif(trim(excluded.item_name::text), ''),
      goods_detail_slot_log.item_name
    ),
    item_cart_cnt = coalesce(excluded.item_cart_cnt, goods_detail_slot_log.item_cart_cnt),
    search_uv    = coalesce(excluded.search_uv, goods_detail_slot_log.search_uv),
    search_pay_rate = coalesce(excluded.search_pay_rate, goods_detail_slot_log.search_pay_rate),
    cart_uv      = coalesce(excluded.cart_uv, goods_detail_slot_log.cart_uv),
    cart_pay_rate = coalesce(excluded.cart_pay_rate, goods_detail_slot_log.cart_pay_rate);
end;
$$;

grant execute on function public.merge_goods_detail_slot_log(jsonb) to anon;
