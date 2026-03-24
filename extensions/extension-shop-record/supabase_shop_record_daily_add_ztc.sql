-- 万象1 直通车指标：charge / cvr / ecpc(PPC) / roi
alter table public.shop_record_daily
  add column if not exists ztc_charge_yuan text,
  add column if not exists ztc_cvr text,
  add column if not exists ztc_ppc text,
  add column if not exists ztc_roi text;
