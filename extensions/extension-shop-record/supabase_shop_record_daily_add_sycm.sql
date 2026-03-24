-- 千牛后台 previewById 昨日行：流量与转化指标
alter table public.shop_record_daily
  add column if not exists sycm_pv text,
  add column if not exists sycm_uv text,
  add column if not exists sycm_pay_buyers text,
  add column if not exists sycm_pay_items text,
  add column if not exists sycm_pay_amount text,
  add column if not exists sycm_aov text,
  add column if not exists sycm_pay_cvr text,
  add column if not exists sycm_old_visitor_ratio text,
  add column if not exists sycm_avg_stay_sec text,
  add column if not exists sycm_avg_pv_depth text,
  add column if not exists sycm_bounce_rate text;
