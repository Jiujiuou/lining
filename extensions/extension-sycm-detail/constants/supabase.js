/**
 * Supabase 连接配置（扩展内共用）
 * 后续可改为从 chrome.storage 或 popup 配置页读取
 */
(function (global) {
  var SUPABASE_URL = 'https://ijfzeummbriivdmnhpsi.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_';

  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_SUPABASE__ = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
