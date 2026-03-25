/**
 * Popup 内 Supabase Auth：fetch 调用 REST，会话存 chrome.storage.local
 */
(function (global) {
  function getCfg() {
    var s = global.__SHOP_RECORD_SUPABASE__;
    if (!s || !s.url || !s.anonKey) return null;
    return { url: String(s.url).replace(/\/$/, ""), anonKey: s.anonKey };
  }

  function parseApiError(status, body) {
    var msg =
      (body && (body.error_description || body.message || body.msg)) ||
      (typeof body === "string" ? body : "") ||
      "请求失败";
    if (body && body.error && typeof body.error === "string") {
      msg = body.error + (msg && msg !== "请求失败" ? "：" + msg : "");
    }
    return msg || "HTTP " + status;
  }

  /**
   * @param {string} displayName 写入 user_metadata.display_name（Supabase 注册 data）
   */
  function signUp(email, password, displayName) {
    var c = getCfg();
    if (!c) {
      return Promise.resolve({ error: "未配置 Supabase（constants/supabase.js）" });
    }
    var payload = {
      email: String(email).trim(),
      password: String(password)
    };
    var name =
      displayName != null && String(displayName).replace(/\s/g, "") !== ""
        ? String(displayName).trim()
        : "";
    if (name) {
      payload.data = { display_name: name };
    }
    return fetch(c.url + "/auth/v1/signup", {
      method: "POST",
      headers: {
        apikey: c.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().then(function (j) {
        if (!res.ok) {
          return { error: parseApiError(res.status, j) };
        }
        var user = j.user != null ? j.user : j.id != null ? j : null;
        var session = j.session != null ? j.session : null;
        return { user: user, session: session };
      });
    });
  }

  function signInWithPassword(email, password) {
    var c = getCfg();
    if (!c) {
      return Promise.resolve({ error: "未配置 Supabase（constants/supabase.js）" });
    }
    return fetch(c.url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        apikey: c.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: String(email).trim(),
        password: String(password)
      })
    }).then(function (res) {
      return res.json().then(function (j) {
        if (!res.ok) {
          return { error: parseApiError(res.status, j) };
        }
        if (!j.access_token) {
          return { error: "登录响应无效" };
        }
        return { session: j };
      });
    });
  }

  function refreshSession(refreshToken) {
    var c = getCfg();
    if (!c) {
      return Promise.resolve({ error: "未配置 Supabase" });
    }
    return fetch(c.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: {
        apikey: c.anonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refresh_token: String(refreshToken) })
    }).then(function (res) {
      return res.json().then(function (j) {
        if (!res.ok) {
          return { error: parseApiError(res.status, j) };
        }
        if (!j.access_token) {
          return { error: "刷新会话失败" };
        }
        return { session: j };
      });
    });
  }

  function fetchUser(accessToken) {
    var c = getCfg();
    if (!c) {
      return Promise.resolve({ error: "未配置 Supabase" });
    }
    return fetch(c.url + "/auth/v1/user", {
      method: "GET",
      headers: {
        apikey: c.anonKey,
        Authorization: "Bearer " + String(accessToken)
      }
    }).then(function (res) {
      return res.json().then(function (j) {
        if (!res.ok) {
          return { error: parseApiError(res.status, j) };
        }
        return { user: j };
      });
    });
  }

  /**
   * 用 access_token 校验用户；失效则尝试 refresh_token。
   * @returns {Promise<{ ok: boolean, session?: object }>}
   */
  function restoreSession(stored) {
    if (!stored || typeof stored !== "object" || !stored.access_token) {
      return Promise.resolve({ ok: false });
    }
    return fetchUser(stored.access_token).then(function (r) {
      if (!r.error && r.user) {
        return {
          ok: true,
          session: Object.assign({}, stored, { user: r.user })
        };
      }
      if (!stored.refresh_token) {
        return { ok: false };
      }
      return refreshSession(stored.refresh_token).then(function (r2) {
        if (r2.error || !r2.session) {
          return { ok: false };
        }
        var merged = normalizeSession(r2.session, stored.user);
        return fetchUser(merged.access_token).then(function (r3) {
          if (r3.error || !r3.user) {
            return { ok: false };
          }
          merged.user = r3.user;
          return { ok: true, session: merged };
        });
      });
    });
  }

  function normalizeSession(raw, prevUser) {
    var u = raw.user != null ? raw.user : prevUser != null ? prevUser : null;
    return {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token != null ? raw.refresh_token : null,
      expires_in: raw.expires_in,
      expires_at: raw.expires_at,
      token_type: raw.token_type,
      user: u
    };
  }

  global.__SHOP_RECORD_AUTH__ = {
    signUp: signUp,
    signInWithPassword: signInWithPassword,
    refreshSession: refreshSession,
    fetchUser: fetchUser,
    restoreSession: restoreSession,
    normalizeSession: normalizeSession
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : self);
