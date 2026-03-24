-- 万象4 内容推广：charge、roi
alter table public.shop_record_daily
  add column if not exists content_promo_charge_yuan text,
  add column if not exists content_promo_roi text;
