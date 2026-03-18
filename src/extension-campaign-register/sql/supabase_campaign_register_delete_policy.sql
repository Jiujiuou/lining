-- 推广登记表：允许 anon 删除（看板「操作-删除」需此策略）
create policy "Allow anon delete for campaign_register"
  on public.campaign_register for delete to anon using (true);
