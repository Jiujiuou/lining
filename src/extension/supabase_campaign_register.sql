-- ============================================================
-- 推广登记表（campaign_register）：按天维度的推广花费与总成交金额
-- 在 Supabase SQL Editor 中执行
-- 日期为东八区 YYYY-MM-DD，与项目其它表一致；同一天同一 campaign 多次上报覆盖
-- ============================================================

create table if not exists public.campaign_register (
  id bigint generated always as identity primary key,
  report_date date not null,
  campaign_name text not null,
  charge numeric,
  alipay_inshop_amt numeric,
  unique (report_date, campaign_name)
);

comment on table public.campaign_register is '推广登记表：按东八区日期与商品名上报花费(charge)与总成交金额(alipay_inshop_amt)，同天同商品覆盖';

comment on column public.campaign_register.report_date is '东八区日期 YYYY-MM-DD';
comment on column public.campaign_register.campaign_name is '推广名称（findPage 的 campaignName）';
comment on column public.campaign_register.charge is '花费';
comment on column public.campaign_register.alipay_inshop_amt is '总成交金额';

alter table public.campaign_register enable row level security;

create policy "Allow anon insert for campaign_register"
  on public.campaign_register for insert to anon with check (true);

create policy "Allow anon select for campaign_register"
  on public.campaign_register for select to anon using (true);

create policy "Allow anon update for campaign_register"
  on public.campaign_register for update to anon using (true) with check (true);

-- 允许 upsert：POST 时用 Prefer: resolution=merge-duplicates，按 (report_date, campaign_name) 冲突则更新
-- 无需额外 RPC，PostgREST 对 unique 约束自动支持 merge-duplicates
