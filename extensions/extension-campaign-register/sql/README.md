# 推广登记表 Supabase 脚本

在 **Supabase → SQL Editor** 按需执行（新建项目按顺序；已有库只执行缺的迁移）。

| 顺序 | 文件 | 说明 |
|------|------|------|
| 1 | `supabase_campaign_register.sql` | 建表 + 基础 RPC（人群/货品全站） |
| 2 | `supabase_campaign_register_migration.sql` | 从旧列结构迁移时用（多数新库可跳过） |
| 3 | `supabase_campaign_register_extend_search_content.sql` | 增加关键词、内容营销列与 RPC 分支 |
| 4 | `supabase_campaign_register_delete_policy.sql` | 可选：允许 anon 删除行 |
