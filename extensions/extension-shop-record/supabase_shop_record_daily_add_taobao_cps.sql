-- 已有表时执行：新增「淘宝客花费（元）」列（pay_ord_cfee_8）
alter table public.shop_record_daily
  add column if not exists taobao_cps_spend_yuan text;
