-- ============================================================
-- 已有表 sycm_market_rank_log：增加商品标题列（对应 API item.title）
-- 在 Supabase Dashboard → SQL Editor 中执行一次
-- ============================================================

alter table public.sycm_market_rank_log
  add column if not exists item_title text;

comment on column public.sycm_market_rank_log.item_title is '商品标题（生意参谋 rank 接口 item.title）';
