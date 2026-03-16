-- ============================================================
-- 推广登记表 扩展：关键词推广(onebpSearch)、内容营销(onebpShortVideo)
-- 表已存在时在 Supabase SQL Editor 中执行
-- ============================================================

-- 新增两套前缀列（PostgreSQL 存为小写：onebpsearch / onebpshortvideo）
alter table public.campaign_register
  add column if not exists charge_onebpsearch numeric,
  add column if not exists alipay_inshop_amt_onebpsearch numeric,
  add column if not exists charge_onebpshortvideo numeric,
  add column if not exists alipay_inshop_amt_onebpshortvideo numeric;

comment on column public.campaign_register.charge_onebpsearch is '关键词推广-花费';
comment on column public.campaign_register.alipay_inshop_amt_onebpsearch is '关键词推广-总成交金额';
comment on column public.campaign_register.charge_onebpshortvideo is '内容营销-花费';
comment on column public.campaign_register.alipay_inshop_amt_onebpshortvideo is '内容营销-总成交金额';

-- RPC：按 bizCode 仅更新对应两列（增加 onebpSearch / onebpShortVideo 分支）
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
    elsif p_biz_code = 'onebpSearch' then
      insert into public.campaign_register (report_date, campaign_name, charge_onebpsearch, alipay_inshop_amt_onebpsearch)
      values (v_report_date, v_campaign_name, v_charge, v_amt)
      on conflict (report_date, campaign_name) do update set
        charge_onebpsearch = excluded.charge_onebpsearch,
        alipay_inshop_amt_onebpsearch = excluded.alipay_inshop_amt_onebpsearch;
    elsif p_biz_code = 'onebpShortVideo' then
      insert into public.campaign_register (report_date, campaign_name, charge_onebpshortvideo, alipay_inshop_amt_onebpshortvideo)
      values (v_report_date, v_campaign_name, v_charge, v_amt)
      on conflict (report_date, campaign_name) do update set
        charge_onebpshortvideo = excluded.charge_onebpshortvideo,
        alipay_inshop_amt_onebpshortvideo = excluded.alipay_inshop_amt_onebpshortvideo;
    end if;
  end loop;
end;
$$;
grant execute on function public.campaign_register_upsert_by_biz(jsonb, text) to anon;
