-- ============================================================
-- 推广登记表（campaign_register）：一天一行，按 bizCode 前缀分列
-- 在 Supabase SQL Editor 中执行（新建表时用此脚本；已有表用 migration 脚本）
-- ============================================================

create table if not exists public.campaign_register (
  id bigint generated always as identity primary key,
  report_date date not null,
  campaign_name text not null,
  charge_onebpDisplay numeric,
  alipay_inshop_amt_onebpDisplay numeric,
  charge_onebpSite numeric,
  alipay_inshop_amt_onebpSite numeric,
  unique (report_date, campaign_name)
);

comment on table public.campaign_register is '推广登记表：按东八区日期与商品名，一天一行；各推广类型用前缀列存销售额与花费';

comment on column public.campaign_register.report_date is '东八区日期 YYYY-MM-DD';
comment on column public.campaign_register.campaign_name is '推广名称（findPage 的 campaignName）';
comment on column public.campaign_register.charge_onebpDisplay is '人群推广-花费';
comment on column public.campaign_register.alipay_inshop_amt_onebpDisplay is '人群推广-总成交金额';
comment on column public.campaign_register.charge_onebpSite is '货品全站推广-花费';
comment on column public.campaign_register.alipay_inshop_amt_onebpSite is '货品全站推广-总成交金额';

alter table public.campaign_register enable row level security;

create policy "Allow anon insert for campaign_register"
  on public.campaign_register for insert to anon with check (true);

create policy "Allow anon select for campaign_register"
  on public.campaign_register for select to anon using (true);

create policy "Allow anon update for campaign_register"
  on public.campaign_register for update to anon using (true) with check (true);

-- RPC：按 bizCode 仅更新对应两列
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
