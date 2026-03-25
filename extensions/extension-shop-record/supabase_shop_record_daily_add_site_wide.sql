-- 万象3 全站推广（onebpSite）：report/query.json 中 list[0].charge / roi
alter table public.shop_record_daily
  add column if not exists site_wide_charge_yuan text,
  add column if not exists site_wide_roi text;

comment on column public.shop_record_daily.site_wide_charge_yuan is '全站推广花费（元）';
comment on column public.shop_record_daily.site_wide_roi is '全站推广ROI';
