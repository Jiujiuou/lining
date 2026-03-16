-- ============================================================
-- 推广登记表 迁移：一天一行，按 bizCode 前缀分列（人群 onebpDisplay / 货品全站 onebpSite）
-- 旧数据已删除时在 Supabase SQL Editor 中执行
-- ============================================================

-- 新增按 bizCode 前缀的列
alter table public.campaign_register
  add column if not exists charge_onebpDisplay numeric,
  add column if not exists alipay_inshop_amt_onebpDisplay numeric,
  add column if not exists charge_onebpSite numeric,
  add column if not exists alipay_inshop_amt_onebpSite numeric;

-- 删除旧列（执行前请确认无需要保留的旧数据）
alter table public.campaign_register
  drop column if exists charge,
  drop column if exists alipay_inshop_amt;

comment on column public.campaign_register.charge_onebpDisplay is '人群推广-花费';
comment on column public.campaign_register.alipay_inshop_amt_onebpDisplay is '人群推广-总成交金额';
comment on column public.campaign_register.charge_onebpSite is '货品全站推广-花费';
comment on column public.campaign_register.alipay_inshop_amt_onebpSite is '货品全站推广-总成交金额';

-- RPC：按 bizCode 仅更新对应两列，避免覆盖其他类型数据
create or replace function public.campaign_register_upsert_by_biz(p_rows jsonb, p_biz_code text)
returns void
language plpgsql
security definer
as $$
declare
  r jsonb;
  v_report_date date;
  v_campaign_name text;
  v_charge numeric;
  v_amt numeric;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_report_date := (r->>'report_date')::date;
    v_campaign_name := r->>'campaign_name';
    v_charge := (r->'charge')::numeric;
    v_amt := (r->'alipay_inshop_amt')::numeric;
    if v_report_date is null or v_campaign_name is null then
      continue;
    end if;
    if p_biz_code = 'onebpDisplay' then
      insert into public.campaign_register (report_date, campaign_name, charge_onebpDisplay, alipay_inshop_amt_onebpDisplay)
      values (v_report_date, v_campaign_name, v_charge, v_amt)
      on conflict (report_date, campaign_name) do update set
        charge_onebpDisplay = excluded.charge_onebpDisplay,
        alipay_inshop_amt_onebpDisplay = excluded.alipay_inshop_amt_onebpDisplay;
    elsif p_biz_code = 'onebpSite' then
      insert into public.campaign_register (report_date, campaign_name, charge_onebpSite, alipay_inshop_amt_onebpSite)
      values (v_report_date, v_campaign_name, v_charge, v_amt)
      on conflict (report_date, campaign_name) do update set
        charge_onebpSite = excluded.charge_onebpSite,
        alipay_inshop_amt_onebpSite = excluded.alipay_inshop_amt_onebpSite;
    end if;
  end loop;
end;
$$;
grant execute on function public.campaign_register_upsert_by_biz(jsonb, text) to anon;
