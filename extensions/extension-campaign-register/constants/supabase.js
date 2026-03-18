/**
 * 与主扩展同一 Supabase 项目即可复用 campaign_register RPC；可自行改为 storage 配置
 */
(function (global) {
  var SUPABASE_URL = 'https://ijfzeummbriivdmnhpsi.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_';

  (typeof globalThis !== 'undefined' ? globalThis : global).__AMCR_SUPABASE__ = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
