import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import DashboardSingleDatePicker from "./components/DashboardSingleDatePicker";
import "./App.css";
import "./UserAdminPage.css";

const DEFAULT_PERMISSIONS = { open_all_pages: false, auto_fill: false };

function normalizePermissions(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PERMISSIONS };
  return {
    open_all_pages: Boolean(raw.open_all_pages),
    auto_fill: Boolean(raw.auto_fill),
  };
}

function getTodayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO 或 null → 本地日历日 yyyy-mm-dd（仅用于日期选择器） */
function parseIsoToYmd(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 所选日期的本地 23:59:59 → ISO 存入数据库 */
function ymdEndOfDayToIso(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatExpiryDisplay(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export default function UserAdminPage() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);

  const loadMe = useCallback(async (uid) => {
    if (!supabase || !uid) return null;
    const { data, error: qErr } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (qErr) throw qErr;
    return data;
  }, []);

  const loadAll = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data, error: qErr } = await supabase
      .from("user_profiles")
      .select("*")
      .order("email", { ascending: true, nullsFirst: false });
    setLoading(false);
    if (qErr) {
      setError(qErr.message || String(qErr));
      return;
    }
    setRows(data || []);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let sub;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await loadMe(session.user.id);
        if (!cancelled) setMe(profile);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, loadMe]);

  useEffect(() => {
    if (me?.is_admin) {
      loadAll();
    } else {
      setRows([]);
    }
  }, [me, loadAll]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    if (err) setError(err.message || "登录失败");
    else setLoginPassword("");
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setEditing(null);
    setForm(null);
  }

  function openEdit(row) {
    setEditing(row.user_id);
    setForm({
      vip_status: Boolean(row.vip_status),
      vipDateYmd: parseIsoToYmd(row.vip_expires_at),
      permissions: normalizePermissions(row.permissions),
      is_admin: Boolean(row.is_admin),
    });
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!supabase || !editing || !form) return;
    setError("");
    const expires =
      form.vipDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(form.vipDateYmd)
        ? ymdEndOfDayToIso(form.vipDateYmd)
        : null;
    const { error: uErr } = await supabase
      .from("user_profiles")
      .update({
        vip_status: form.vip_status,
        vip_expires_at: expires,
        permissions: form.permissions,
        is_admin: form.is_admin,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", editing);
    if (uErr) {
      setError(uErr.message || "保存失败");
      return;
    }
    closeEdit();
    await loadAll();
    if (editing === session?.user?.id) {
      const profile = await loadMe(session.user.id);
      setMe(profile);
    }
  }

  if (!ready) {
    return (
      <div className="user-admin">
        <p className="user-admin__muted">加载中…</p>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="user-admin">
        <p className="user-admin__error">未配置 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。</p>
        <Link to="/" className="user-admin__link">
          返回首页
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="user-admin">
        <header className="user-admin__header">
          <h1 className="user-admin__title">用户与 VIP 管理</h1>
          <Link to="/" className="user-admin__link">
            返回首页
          </Link>
        </header>
        <p className="user-admin__hint">请使用管理员账号登录后管理 VIP 与权限。</p>
        <form className="user-admin__form" onSubmit={handleLogin}>
          <label className="user-admin__label">
            邮箱
            <input
              className="user-admin__input"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="user-admin__label">
            密码
            <input
              className="user-admin__input"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? <p className="user-admin__error">{error}</p> : null}
          <button type="submit" className="user-admin__btn user-admin__btn--primary">
            登录
          </button>
        </form>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="user-admin">
        <p className="user-admin__muted">正在读取用户资料…</p>
        {error ? <p className="user-admin__error">{error}</p> : null}
        <button type="button" className="user-admin__btn" onClick={handleLogout}>
          退出登录
        </button>
      </div>
    );
  }

  if (!me.is_admin) {
    return (
      <div className="user-admin">
        <header className="user-admin__header">
          <h1 className="user-admin__title">用户与 VIP 管理</h1>
          <Link to="/" className="user-admin__link">
            返回首页
          </Link>
        </header>
        <p className="user-admin__error">
          当前账号无管理权限。请在 Supabase 中将你的 user_profiles.is_admin 设为 true 后重试。
        </p>
        <p className="user-admin__muted">登录为：{session.user.email}</p>
        <button type="button" className="user-admin__btn" onClick={handleLogout}>
          退出登录
        </button>
      </div>
    );
  }

  return (
    <div className="user-admin">
      <header className="user-admin__header">
        <h1 className="user-admin__title">用户与 VIP 管理</h1>
        <div className="user-admin__header-actions">
          <span className="user-admin__muted">{session.user.email}</span>
          <button type="button" className="user-admin__btn" onClick={handleLogout}>
            退出
          </button>
          <Link to="/" className="user-admin__link">
            返回首页
          </Link>
        </div>
      </header>

      {error ? <p className="user-admin__error">{error}</p> : null}

      <div className="user-admin__table-wrap">
        <table className="user-admin__table">
          <thead>
            <tr>
              <th>邮箱</th>
              <th>显示名</th>
              <th>VIP</th>
              <th>VIP 到期</th>
              <th>权限</th>
              <th>管理员</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="user-admin__muted">
                  加载中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="user-admin__muted">
                  暂无数据。请确认已在 Supabase 执行 sql/supabase_user_profiles.sql。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.email || "—"}</td>
                  <td>{r.display_name || "—"}</td>
                  <td>{r.vip_status ? "是" : "否"}</td>
                  <td className="user-admin__cell-nowrap">
                    {formatExpiryDisplay(r.vip_expires_at)}
                  </td>
                  <td className="user-admin__cell-perms">
                    {normalizePermissions(r.permissions).open_all_pages ? "一键打开 " : ""}
                    {normalizePermissions(r.permissions).auto_fill ? "自动填充 " : ""}
                    {!normalizePermissions(r.permissions).open_all_pages &&
                    !normalizePermissions(r.permissions).auto_fill
                      ? "—"
                      : ""}
                  </td>
                  <td>{r.is_admin ? "是" : "否"}</td>
                  <td>
                    <button
                      type="button"
                      className="user-admin__btn user-admin__btn--small"
                      onClick={() => openEdit(r)}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && form ? (
        <div className="user-admin__modal-overlay" role="presentation" onClick={closeEdit}>
          <div
            className="user-admin__modal"
            role="dialog"
            aria-labelledby="user-admin-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="user-admin-edit-title" className="user-admin__modal-title">
              编辑用户
            </h2>
            <div className="user-admin__modal-scroll">
              <form className="user-admin__form user-admin__form--modal" onSubmit={saveEdit}>
              <label className="user-admin__check">
                <input
                  type="checkbox"
                  checked={form.vip_status}
                  onChange={(e) => setForm((f) => ({ ...f, vip_status: e.target.checked }))}
                />
                VIP 开通
              </label>
              <p className="user-admin__muted user-admin__sub">
                VIP 到期日：选中日期的当天 23:59（本地时间）到期。不选日期表示不限制到期，仍以 VIP
                开关为准。
              </p>
              <div className="user-admin__vip-datetime">
                <DashboardSingleDatePicker
                  label="到期日期"
                  calendarHint=""
                  value={form.vipDateYmd}
                  datesWithData={[]}
                  getTodayYmd={getTodayYmdLocal}
                  onSelectDate={(ymd) => setForm((f) => ({ ...f, vipDateYmd: ymd }))}
                />
                <button
                  type="button"
                  className="user-admin__btn user-admin__btn--text"
                  onClick={() => setForm((f) => ({ ...f, vipDateYmd: "" }))}
                >
                  清除到期时间
                </button>
              </div>
              <p className="user-admin__muted user-admin__sub">功能权限（扩展内可据此判断）</p>
              <label className="user-admin__check">
                <input
                  type="checkbox"
                  checked={form.permissions.open_all_pages}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      permissions: {
                        ...f.permissions,
                        open_all_pages: e.target.checked,
                      },
                    }))
                  }
                />
                一键打开所有页面
              </label>
              <label className="user-admin__check">
                <input
                  type="checkbox"
                  checked={form.permissions.auto_fill}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      permissions: { ...f.permissions, auto_fill: e.target.checked },
                    }))
                  }
                />
                自动填充数据
              </label>
              <label className="user-admin__check user-admin__check--danger">
                <input
                  type="checkbox"
                  checked={form.is_admin}
                  onChange={(e) => setForm((f) => ({ ...f, is_admin: e.target.checked }))}
                />
                管理员（可访问本页并修改他人）
              </label>
              <div className="user-admin__modal-actions">
                <button type="button" className="user-admin__btn" onClick={closeEdit}>
                  取消
                </button>
                <button type="submit" className="user-admin__btn user-admin__btn--primary">
                  保存
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
