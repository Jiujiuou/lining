-- ============================================================
-- 店铺记录扩展一期：shop_record_daily
-- 目标：每天一行（按 report_at 合并）
-- ============================================================

create table if not exists public.shop_record_daily (
  id bigint generated always as identity primary key,
  report_at date not null,
  item_desc_match_score text,
  seller_service_score text,
  seller_shipping_score text,
  refund_finish_duration text,
  refund_finish_rate text,
  dispute_refund_rate text,
  taobao_cps_spend_yuan text,
  ztc_charge_yuan text,
  ztc_cvr text,
  ztc_ppc text,
  ztc_roi text,
  ylmf_charge_yuan text,
  ylmf_cvr text,
  ylmf_ppc text,
  ylmf_roi text,
  content_promo_charge_yuan text,
  content_promo_roi text,
  site_wide_charge_yuan text,
  site_wide_roi text,
  sycm_pv text,
  sycm_uv text,
  sycm_pay_buyers text,
  sycm_pay_items text,
  sycm_pay_amount text,
  sycm_aov text,
  sycm_pay_cvr text,
  sycm_old_visitor_ratio text,
  sycm_avg_stay_sec text,
  sycm_avg_pv_depth text,
  sycm_bounce_rate text
);

-- 每天一条：upsert 冲突键
create unique index if not exists shop_record_daily_report_at_uidx
  on public.shop_record_daily (report_at);

alter table public.shop_record_daily enable row level security;

-- 扩展使用 anon key 直接写入：需要 insert + update + select
create policy "Allow anon insert shop_record_daily"
  on public.shop_record_daily for insert to anon with check (true);

create policy "Allow anon update shop_record_daily"
  on public.shop_record_daily for update to anon using (true) with check (true);

create policy "Allow anon select shop_record_daily"
  on public.shop_record_daily for select to anon using (true);
