-- 万象2 引力魔方：charge / cvr / ecpc(PPC) / roi
alter table public.shop_record_daily
  add column if not exists ylmf_charge_yuan text,
  add column if not exists ylmf_cvr text,
  add column if not exists ylmf_ppc text,
  add column if not exists ylmf_roi text;
