-- ============================================================
-- supabase_sycm_log.sql - Supabase 表结构与策略
-- ============================================================
-- 用途：扩展 content.js 将数据 POST 到 Supabase 时，需要对应的表与 RLS 策略。
-- 在 Supabase Dashboard → SQL Editor 中执行本文件（或按需执行其中一段）。
-- 表与扩展对应关系：
--   sycm_cart_log         ← content.js SINKS sycm-cart-log（商品加购件数）
--   sycm_flow_source_log  ← sycm-flow-source（流量来源 4 指标）
--   sycm_market_rank_log  ← sycm-market-rank（市场排名，多店铺多行）
-- ============================================================

-- ============================================================
-- Supabase SQL Editor：生意参谋 itemCartCnt 记录表
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

-- 建表（若你已在界面建过表，可跳过，只保留表名与列名一致即可）
-- 表名建议：sycm_cart_log，列：item_cart_cnt (int), created_at (timestamptz，插入时传东八区时间或用 default now()）
create table if not exists public.sycm_cart_log (
  id bigint generated always as identity primary key,
  item_cart_cnt integer not null,
  created_at timestamptz default now()
);

-- 启用 RLS 时，允许匿名插入（扩展用 anon key 插入时需此策略，否则用 service_role 或单独建策略）
alter table public.sycm_cart_log enable row level security;

-- 策略：允许匿名用户插入（仅当使用 anon key 从扩展插入时需要）
create policy "Allow anon insert for sycm_cart_log"
  on public.sycm_cart_log
  for insert
  to anon
  with check (true);

-- 策略：允许匿名用户查询（前端「从 Supabase 加载」需要，否则会一直提示暂无数据）
create policy "Allow anon select for sycm_cart_log"
  on public.sycm_cart_log for select to anon using (true);

-- 启用 Realtime 推送（前端需监听 INSERT 时执行）
-- 在 Supabase Dashboard → Database → Replication 中为 public.sycm_cart_log 开启，或执行：
alter publication supabase_realtime add table public.sycm_cart_log;

-- 示例：手动插入一条（SQL Editor 里可直接运行测试）
-- insert into public.sycm_cart_log (item_cart_cnt, created_at)
-- values (15, '2026-02-16T19:44:08+08:00');

-- ============================================================
-- 第二个（及更多）指标的通用表结构
-- 格式统一：一个 value 列（名可按业务取） + created_at
-- 在 inject.js 的 SOURCES 里加一项，在 content.js 的 SINKS 里加一项即可
-- ============================================================

-- 示例：第二个接口对应的表（表名、列名按实际改）
-- create table if not exists public.sycm_other_log (
--   id bigint generated always as identity primary key,
--   metric_value numeric not null,   -- 或 integer，按需
--   created_at timestamptz default now()
-- );
-- alter table public.sycm_other_log enable row level security;
-- create policy "Allow anon insert for sycm_other_log"
--   on public.sycm_other_log for insert to anon with check (true);
-- create policy "Allow anon select for sycm_other_log"
--   on public.sycm_other_log for select to anon using (true);
-- alter publication supabase_realtime add table public.sycm_other_log;

-- ============================================================
-- 流量来源 v4 接口：4 个指标一张表（搜索访客数、搜索支付转化率、购物车访客数、购物车支付转化率）
-- 接口：/flow/v6/live/item/source/v4.json
-- ============================================================

create table if not exists public.sycm_flow_source_log (
  id bigint generated always as identity primary key,
  search_uv integer not null,
  search_pay_rate numeric not null,
  cart_uv integer not null,
  cart_pay_rate numeric not null,
  created_at timestamptz default now()
);

alter table public.sycm_flow_source_log enable row level security;

create policy "Allow anon insert for sycm_flow_source_log"
  on public.sycm_flow_source_log for insert to anon with check (true);

create policy "Allow anon select for sycm_flow_source_log"
  on public.sycm_flow_source_log for select to anon using (true);

alter publication supabase_realtime add table public.sycm_flow_source_log;

-- ============================================================
-- 市场排名 rank.json：每行一个店铺在该时刻的排名（店铺名 + 排名 + 时间）
-- 接口：/mc/mq/mkt/item/live/rank.json
-- ============================================================

create table if not exists public.sycm_market_rank_log (
  id bigint generated always as identity primary key,
  shop_title text not null,
  rank integer not null,
  created_at timestamptz default now()
);

alter table public.sycm_market_rank_log enable row level security;

create policy "Allow anon insert for sycm_market_rank_log"
  on public.sycm_market_rank_log for insert to anon with check (true);

create policy "Allow anon select for sycm_market_rank_log"
  on public.sycm_market_rank_log for select to anon using (true);

alter publication supabase_realtime add table public.sycm_market_rank_log;

-- ============================================================
-- 图表数据点备注表（操作记录）
-- 用途：按图表 + 日期 + 时段存储数据点备注，前端可读写。
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

create table if not exists public.sycm_chart_point_notes (
  id bigint generated always as identity primary key,
  chart_key text not null,
  point_date text not null,
  point_slot text not null,
  note text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (chart_key, point_date, point_slot)
);

alter table public.sycm_chart_point_notes enable row level security;

create policy "Allow anon select for sycm_chart_point_notes"
  on public.sycm_chart_point_notes for select to anon using (true);

create policy "Allow anon insert for sycm_chart_point_notes"
  on public.sycm_chart_point_notes for insert to anon with check (true);

create policy "Allow anon update for sycm_chart_point_notes"
  on public.sycm_chart_point_notes for update to anon using (true) with check (true);

-- ============================================================
-- 已有表删除 recorded_at 列（在 SQL Editor 中按需执行一次）
-- ============================================================
-- alter table public.sycm_cart_log drop column if exists recorded_at;
-- alter table public.sycm_flow_source_log drop column if exists recorded_at;
-- alter table public.sycm_market_rank_log drop column if exists recorded_at;
