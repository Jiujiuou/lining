-- ============================================================
-- 市场排名扩展专用：sycm_market_rank_log
-- 由 extension-sycm-market-rank 上报（店铺名 + 排名）
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

create table if not exists public.sycm_market_rank_log (
  id bigint generated always as identity primary key,
  shop_title text not null,
  rank integer not null,
  item_title text,
  created_at timestamptz default now()
);

alter table public.sycm_market_rank_log enable row level security;

create policy "Allow anon insert for sycm_market_rank_log"
  on public.sycm_market_rank_log for insert to anon with check (true);

create policy "Allow anon select for sycm_market_rank_log"
  on public.sycm_market_rank_log for select to anon using (true);

alter publication supabase_realtime add table public.sycm_market_rank_log;

-- alter table public.sycm_market_rank_log drop column if exists recorded_at;
