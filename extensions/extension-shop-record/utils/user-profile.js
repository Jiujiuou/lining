/**
 * 从 Supabase user_profiles 读取 VIP / permissions，供 popup 功能校验
 * 依赖 constants/supabase.js（__SHOP_RECORD_SUPABASE__）
 */
(function (global) {
  function getCfg() {
    var s = global.__SHOP_RECORD_SUPABASE__;
    if (!s || !s.url || !s.anonKey) return null;
    return { url: String(s.url).replace(/\/$/, ""), anonKey: s.anonKey };
  }

  /**
   * @param {object|null} profile user_profiles 一行
   * @returns {boolean}
   */
  function isVipActive(profile) {
    if (!profile || !profile.vip_status) return false;
    var exp = profile.vip_expires_at;
    if (exp == null || exp === "") return true;
    var t = new Date(exp).getTime();
    if (Number.isNaN(t)) return true;
    return t > Date.now();
  }

  /**
   * @param {object|null} profile
   * @param {string} key permissions 内键，如 open_all_pages、auto_fill
   */
  function hasPermissionFlag(profile, key) {
    if (!profile || !key) return false;
    var p = profile.permissions;
    if (!p || typeof p !== "object") return false;
    return p[key] === true;
  }

  /**
   * @param {object|null} profile
   * @param {string} permissionKey
   * @returns {string|null} 不可用时返回提示文案；可用返回 null
   */
  function getDenyMessage(profile, permissionKey) {
    if (!profile) {
      return "未找到账号资料，请稍后重试或联系工作人员。";
    }
    if (!isVipActive(profile)) {
      if (profile.vip_status && profile.vip_expires_at) {
        var t = new Date(profile.vip_expires_at).getTime();
        if (!Number.isNaN(t) && t <= Date.now()) {
          return "VIP 已过期，请联系工作人员续费。";
        }
      }
      return "请联系工作人员开通 VIP 或办理续费。";
    }
    if (!hasPermissionFlag(profile, permissionKey)) {
      return "当前账号未开通该功能权限，请联系工作人员。";
    }
    return null;
  }

  /**
   * @param {string} accessToken
   * @param {(err: Error|null, profile: object|null) => void} callback
   */
  function fetchUserProfile(accessToken, callback) {
    var c = getCfg();
    if (!c) {
      callback(new Error("未配置 Supabase"), null);
      return;
    }
    if (!accessToken) {
      callback(new Error("未登录"), null);
      return;
    }
    fetch(c.url + "/rest/v1/user_profiles?select=vip_status,vip_expires_at,permissions", {
      method: "GET",
      cache: "no-store",
      headers: {
        apikey: c.anonKey,
        Authorization: "Bearer " + String(accessToken),
        Accept: "application/json",
        AcceptProfile: "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    })
      .then(function (res) {
        return res.json().then(function (j) {
          if (!res.ok) {
            var msg =
              j && (j.message || j.error_description || j.msg)
                ? String(j.message || j.error_description || j.msg)
                : "HTTP " + res.status;
            throw new Error(msg);
          }
          return j;
        });
      })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          callback(null, null);
          return;
        }
        callback(null, rows[0]);
      })
      .catch(function (e) {
        callback(e instanceof Error ? e : new Error(String(e)), null);
      });
  }

  /**
   * @param {string|null} accessToken
   * @param {string} permissionKey
   * @param {(ok: boolean, message: string) => void} callback message 在 ok 为 false 时为提示
   */
  function checkFeaturePermission(accessToken, permissionKey, callback) {
    if (!accessToken) {
      callback(false, "请先登录扩展账号。");
      return;
    }
    fetchUserProfile(accessToken, function (err, profile) {
      if (err) {
        callback(false, "读取账号权限失败：" + err.message);
        return;
      }
      var deny = getDenyMessage(profile, permissionKey);
      if (deny) {
        callback(false, deny);
        return;
      }
      callback(true, "");
    });
  }

  global.__SHOP_RECORD_USER_PROFILE__ = {
    fetchUserProfile: fetchUserProfile,
    checkFeaturePermission: checkFeaturePermission,
    isVipActive: isVipActive,
    hasPermissionFlag: hasPermissionFlag,
    getDenyMessage: getDenyMessage,
    PERM_OPEN_ALL_PAGES: "open_all_pages",
    PERM_AUTO_FILL: "auto_fill"
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
