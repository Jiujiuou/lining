export const SUPABASE_URL = 'https://ijfzeummbriivdmnhpsi.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_JLdtAikiQsgtXeKPJ_Gfrg_bkeBNHh_';

export function getSupabaseCredentials() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  };
}
