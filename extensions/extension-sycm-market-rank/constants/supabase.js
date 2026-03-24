/**
 * Supabase URL / anon key（可与仓库内其它扩展共用同一项目）
 */
(function (global) {
  var SUPABASE_URL = 'https://ijfzeummbriivdmnhpsi.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_';

  (typeof globalThis !== 'undefined' ? globalThis : global).__SYCM_RANK_SUPABASE__ = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  };
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : self);
