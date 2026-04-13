/**
 * 与仓库内其它扩展同一 Supabase 项目即可共用数据；可自行替换 URL / anon key
 */
(function (global) {
  var SUPABASE_URL = "https://ijfzeummbriivdmnhpsi.supabase.co";
  var SUPABASE_ANON_KEY =
    "sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_";

  (typeof globalThis !== "undefined" ? globalThis : global).__SHOP_RECORD_SUPABASE__ = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
