import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import DashboardSingleDatePicker from "./components/DashboardSingleDatePicker";
import "./StorePage.css";
import "./App.css";

function getYesterdayYmd() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ROWS = [
  {
    leftLabel: "宝贝与描述相符",
    leftKey: "item_desc_match_score",
    rightLabel: "浏览量PV",
    rightKey: "sycm_pv",
  },
  {
    leftLabel: "卖家服务态度",
    leftKey: "seller_service_score",
    rightLabel: "访客数UV",
    rightKey: "sycm_uv",
  },
  {
    leftLabel: "卖家发货速度",
    leftKey: "seller_shipping_score",
    rightLabel: "支付买家数",
    rightKey: "sycm_pay_buyers",
  },
  {
    leftLabel: "退款完结时长",
    leftKey: "refund_finish_duration",
    rightLabel: "支付商品件数",
    rightKey: "sycm_pay_items",
  },
  {
    leftLabel: "退款自主完结率",
    leftKey: "refund_finish_rate",
    rightLabel: "支付金额（元）",
    rightKey: "sycm_pay_amount",
  },
  {
    leftLabel: "退款纠纷率",
    leftKey: "dispute_refund_rate",
    rightLabel: "客单价（元）",
    rightKey: "sycm_aov",
  },
  {
    leftLabel: "淘宝客花费（元）",
    leftKey: "taobao_cps_spend_yuan",
    rightLabel: "支付转化率",
    rightKey: "sycm_pay_cvr",
  },
  {
    leftLabel: "直通车花费（元）",
    leftKey: "ztc_charge_yuan",
    rightLabel: "老访客数占比",
    rightKey: "sycm_old_visitor_ratio",
  },
  {
    leftLabel: "直通车转化率",
    leftKey: "ztc_cvr",
    rightLabel: "人均停留时长（秒）",
    rightKey: "sycm_avg_stay_sec",
  },
  {
    leftLabel: "直通车PPC",
    leftKey: "ztc_ppc",
    rightLabel: "人均浏览量（访问深度）",
    rightKey: "sycm_avg_pv_depth",
  },
  {
    leftLabel: "直通车ROI",
    leftKey: "ztc_roi",
    rightLabel: "跳失率",
    rightKey: "sycm_bounce_rate",
  },
  {
    leftLabel: "引力魔方花费",
    leftKey: "ylmf_charge_yuan",
    rightLabel: "引力魔方转化率",
    rightKey: "ylmf_cvr",
  },
  {
    leftLabel: "引力魔方PPC",
    leftKey: "ylmf_ppc",
    rightLabel: "引力魔方ROI",
    rightKey: "ylmf_roi",
  },
  {
    leftLabel: "抖音推广花费",
    leftKey: null,
    rightLabel: "品销宝花费",
    rightKey: null,
  },
  {
    leftLabel: "超级直播花费",
    leftKey: null,
    rightLabel: "钻展花费",
    rightKey: null,
  },
  {
    leftLabel: "全站推广花费",
    leftKey: null,
    rightLabel: "全站推广ROI",
    rightKey: null,
  },
  {
    leftLabel: "内容推广花费",
    leftKey: "content_promo_charge_yuan",
    rightLabel: "内容推广ROI",
    rightKey: "content_promo_roi",
  },
  {
    leftLabel: "总推广花费",
    leftKey: null,
    rightLabel: "推广占比",
    rightKey: null,
  },
];

export default function StorePage() {
  const [selectedDate, setSelectedDate] = useState(() => getYesterdayYmd());
  const [row, setRow] = useState(null);
  const [datesWithData, setDatesWithData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadDates() {
      if (!supabase) return;
      const { data, error: qErr } = await supabase
        .from("shop_record_daily")
        .select("report_at")
        .order("report_at", { ascending: false })
        .limit(365);
      if (!alive || qErr || !Array.isArray(data)) return;
      const dates = data
        .map((r) => (r && r.report_at ? String(r.report_at) : ""))
        .filter(Boolean);
      setDatesWithData([...new Set(dates)]);
    }
    loadDates();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      if (!supabase) {
        setRow(null);
        setError(
          "未配置 Supabase（请检查 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）",
        );
        setLoading(false);
        return;
      }
      const { data, error: qErr } = await supabase
        .from("shop_record_daily")
        .select("*")
        .eq("report_at", selectedDate)
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (qErr) {
        setRow(null);
        setError(`读取失败：${qErr.message || String(qErr)}`);
      } else {
        setRow(data || null);
      }
      setLoading(false);
    }
    load();
    return () => {
      alive = false;
    };
  }, [selectedDate]);

  const titleText = useMemo(() => {
    if (loading) return "加载中…";
    if (error) return error;
    return row ? "" : "该日期暂无数据";
  }, [loading, error, row]);

  return (
    <div className="dashboard store-page">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <DashboardSingleDatePicker
            value={selectedDate}
            datesWithData={datesWithData}
            onSelectDate={setSelectedDate}
            getTodayYmd={getYesterdayYmd}
          />
        </div>

        <div className="dashboard-header-actions">
          {titleText ? (
            <span
              className={
                error ? "dashboard-header-error" : "dashboard-loading-hint"
              }
            >
              {titleText}
            </span>
          ) : null}
        </div>
      </header>

      <table className="store-metrics-table" aria-label="店铺数据表">
        <tbody>
          {ROWS.map((r) => (
            <tr key={`${r.leftLabel}-${r.rightLabel}`}>
              <td>{r.leftLabel}</td>
              <td>{r.leftKey && row ? (row[r.leftKey] ?? "") : ""}</td>
              <td>{r.rightLabel}</td>
              <td>{r.rightKey && row ? (row[r.rightKey] ?? "") : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
