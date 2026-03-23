import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import {
  goodsDetailSlotRowsToChartData,
  getGoodsDetail20MinPointsForDate,
  slotTsToEast8DateString,
} from "./utils/supabaseCartLogToChart";
import {
  marketRankRowsToChartData,
  marketRankChartToGridItems,
} from "./utils/supabaseMarketRankToChart";
import { supabase } from "./lib/supabase";
import { fetchAllRowsByPage } from "./lib/supabaseFetchAll";
import { fetchChartNotes, upsertChartNote } from "./lib/chartNotes";
import {
  goodsDetailRowsToTableRows,
  downloadTableXlsx,
} from "./utils/exportGoodsDetailTable";
import ChartCell from "./components/ChartCell";
import DashboardSingleDatePicker from "./components/DashboardSingleDatePicker";
import DashboardMultiDatePicker from "./components/DashboardMultiDatePicker";
import NoteModal from "./components/NoteModal";
import GoodsSelect from "./components/GoodsSelect";
import "./App.css";

/**
 * 在多条 item_name 候选中选下拉展示名：优先不等于 item_id 的标题（含中文等），否则更长更像标题的。
 * 解决：最新一条 slot 若先被 flow 写成 item_id，旧行有中文时不再只展示纯数字。
 */
function resolveBestItemNameFromCandidates(candidates, itemId) {
  const id = String(itemId);
  const uniq = [
    ...new Set(
      candidates.map((c) => String(c ?? "").trim()).filter(Boolean),
    ),
  ];
  if (uniq.length === 0) return id;
  const notSameAsId = uniq.filter((n) => n !== id);
  if (notSameAsId.length === 0) return uniq[0];
  const withNonDigit = notSameAsId.filter((n) => /[^\d]/.test(n));
  const pool = withNonDigit.length ? withNonDigit : notSameAsId;
  return [...pool].sort((a, b) => b.length - a.length)[0];
}

function mergeItemNameForGoodsList(current, incoming, itemId) {
  return resolveBestItemNameFromCandidates([current, incoming], itemId);
}

/**
 * 从 goods_detail_slot_log 拉取「数据库里出现过的全部商品」用于顶部下拉。
 * 分页拉满后按 item_id 聚合**所有行**的 item_name，再优选展示名（不再只用 slot_ts 最新一条）。
 */
async function fetchDistinctGoodsFromSlotLog(supabaseClient, dayEndIso) {
  const allRows = await fetchAllRowsByPage((from, to) =>
    supabaseClient
      .from("goods_detail_slot_log")
      .select("item_id, item_name, slot_ts")
      .lte("slot_ts", dayEndIso)
      .order("slot_ts", { ascending: false })
      .range(from, to),
  );
  const byId = new Map();
  for (const r of allRows) {
    if (!r.item_id) continue;
    const raw = r.item_name != null ? String(r.item_name).trim() : "";
    const name = raw || String(r.item_id);
    if (!byId.has(r.item_id)) byId.set(r.item_id, []);
    byId.get(r.item_id).push(name);
  }
  const out = [];
  for (const [item_id, cands] of byId) {
    const picked = resolveBestItemNameFromCandidates(cands, item_id);
    if (import.meta.env.DEV && cands.length > 1) {
      const first = cands[0];
      if (picked !== first) {
        console.log(
          "[goodsList] 商品展示名优选（非仅取最新 slot）",
          String(item_id),
          { picked, firstOfDesc: first, candidates: cands.length },
        );
      }
    }
    out.push({ item_id, item_name: picked });
  }
  return out.sort((a, b) =>
    a.item_name.localeCompare(b.item_name, "zh-CN"),
  );
}

const SERIES_ORDER_LIMIT = 9;
const RANGE_DAY_OPTIONS = [2, 3, 5, 7];
/** 店铺排名在 GoodsSelect 中的占位 value，选中时仅展示市场排名图表 */
const MARKET_RANK_ITEM_ID = "__market_rank__";
/** 推广数据在 GoodsSelect 中的占位 value，选中时展示 campaign_register 列表 */
const CAMPAIGN_REGISTER_ITEM_ID = "__campaign_register__";

const DASHBOARD_SELECTED_ITEM_STORAGE_KEY = "lining_dashboard_selected_item_id";

/** 推广数据表格「商品名称」列展示顺序（从上到下） */
const CAMPAIGN_NAME_ORDER = [
  "池_2万小方块",
  "池_2万小云宝",
  "池_鹅卵石",
  "池_小贝壳",
  "池_小云团",
  "池_大云团",
];

/** 汇总1：在「池_小贝壳」下展示，加和以下四项 */
const CAMPAIGN_SUMMARY_GROUP1 = ["池_2万小方块", "池_2万小云宝", "池_鹅卵石", "池_小贝壳"];
/** 汇总2：在「池_大云团」下展示，加和以下两项 */
const CAMPAIGN_SUMMARY_GROUP2 = ["池_小云团", "池_大云团"];

const CAMPAIGN_NUMERIC_KEYS = [
  "charge_onebpsearch",
  "alipay_inshop_amt_onebpsearch",
  "charge_onebpdisplay",
  "alipay_inshop_amt_onebpdisplay",
  "charge_onebpsite",
  "alipay_inshop_amt_onebpsite",
  "charge_onebpshortvideo",
  "alipay_inshop_amt_onebpshortvideo",
];

/** 东八区当天日期 YYYY-MM-DD */
function getTodayEast8() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function App() {
  const loc = useLocation();
  const pathname =
    loc.pathname === "/" || loc.pathname === ""
      ? "/"
      : loc.pathname.replace(/\/+$/, "");
  const isDataHub = pathname === "/data";

  const [view, setView] = useState("dashboard");
  const [dataSource, setDataSource] = useState(null); // 'supabase' | null
  const [rawGoodsDetailRows, setRawGoodsDetailRows] = useState([]);
  const [goodsList, setGoodsList] = useState([]); // { item_id, item_name }[]
  const [selectedItemId, setSelectedItemId] = useState(() => {
    try {
      let p = window.location.pathname || "/";
      if (p !== "/") p = p.replace(/\/+$/, "") || "/";
      if (p === "/") return CAMPAIGN_REGISTER_ITEM_ID;
      if (p === "/data") {
        const saved = localStorage.getItem(DASHBOARD_SELECTED_ITEM_STORAGE_KEY);
        if (saved && saved !== CAMPAIGN_REGISTER_ITEM_ID) return saved;
        return MARKET_RANK_ITEM_ID;
      }
      return localStorage.getItem(DASHBOARD_SELECTED_ITEM_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [rawMarketRankRows, setRawMarketRankRows] = useState([]);
  const [viewMode, setViewMode] = useState("single");
  const [selectedDate, setSelectedDate] = useState(() => getTodayEast8());
  const [rangeDays, setRangeDays] = useState(3);
  const [selectedDatesPick, setSelectedDatesPick] = useState([]);
  const [enlargedIndex, setEnlargedIndex] = useState(null);
  const chartGridRef = useRef(null);
  const enlargedRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [noteModal, setNoteModal] = useState(null);
  const [chartNotes, setChartNotes] = useState({});
  const [campaignRegisterRows, setCampaignRegisterRows] = useState([]);
  const [campaignRegisterLoading, setCampaignRegisterLoading] = useState(false);
  /** 删除推广数据二次确认：{ report_date, campaign_name } | null */
  const [deleteConfirmRow, setDeleteConfirmRow] = useState(null);
  const [campaignRegisterDeleting, setCampaignRegisterDeleting] = useState(false);
  /** 推广数据：是否展示汇总行（池_小贝壳下、池_大云团下各一行加和） */
  const [showCampaignSummary, setShowCampaignSummary] = useState(false);
  /** 当前商品在「选中日期所在自然月」内有 slot 的日期（补全月历圆点，不依赖 load 窗口上界） */
  const [itemMonthSlotDates, setItemMonthSlotDates] = useState([]);

  useEffect(() => {
    const today = getTodayEast8();
    console.log("今天日期（东八区）:", today);
  }, []);

  /** 仅在数据区 /data 记住下拉选项（首页推广数据不写入，避免覆盖） */
  useEffect(() => {
    if (!isDataHub || !selectedItemId) return;
    if (selectedItemId === CAMPAIGN_REGISTER_ITEM_ID) return;
    try {
      localStorage.setItem(DASHBOARD_SELECTED_ITEM_STORAGE_KEY, selectedItemId);
    } catch {}
  }, [isDataHub, selectedItemId]);

  /** 首页 / 固定为推广数据 */
  useEffect(() => {
    if (pathname !== "/") return;
    setSelectedItemId(CAMPAIGN_REGISTER_ITEM_ID);
  }, [pathname]);

  /** 进入 /data 时恢复上次数据区选中项，或默认店铺排名 */
  useEffect(() => {
    if (pathname !== "/data") return;
    try {
      const saved = localStorage.getItem(DASHBOARD_SELECTED_ITEM_STORAGE_KEY);
      if (saved && saved !== CAMPAIGN_REGISTER_ITEM_ID) {
        setSelectedItemId(saved);
        return;
      }
    } catch {
      /* ignore */
    }
    setSelectedItemId((prev) =>
      !prev || prev === CAMPAIGN_REGISTER_ITEM_ID
        ? MARKET_RANK_ITEM_ID
        : prev,
    );
  }, [pathname]);

  const selectedItemName = useMemo(
    () =>
      goodsList.find((g) => g.item_id === selectedItemId)?.item_name ||
      selectedItemId ||
      "商品",
    [goodsList, selectedItemId],
  );

  const parsedData = useMemo(() => {
    if (dataSource !== "supabase" || !selectedItemId) return null;
    const rows = rawGoodsDetailRows.filter((r) => r.item_id === selectedItemId);
    if (rows.length === 0) return null;
    return goodsDetailSlotRowsToChartData(rows, selectedItemName);
  }, [dataSource, rawGoodsDetailRows, selectedItemId, selectedItemName]);

  const marketRankChart = useMemo(
    () => marketRankRowsToChartData(rawMarketRankRows),
    [rawMarketRankRows],
  );

  const rankDatesSorted = useMemo(
    () => Object.keys(marketRankChart.byDateSlot || {}).sort(),
    [marketRankChart],
  );

  const loadFromSupabase = useCallback(
    async (overrideDate) => {
      if (!supabase) {
        setError(
          "未配置 Supabase，请在 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY",
        );
        return;
      }
      setError(null);
      setSupabaseLoading(true);
      const day =
        overrideDate && /^\d{4}-\d{2}-\d{2}$/.test(overrideDate)
          ? overrideDate
          : selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
            ? selectedDate
            : getTodayEast8();
      const dayEnd = `${day}T23:59:59.999+08:00`;
      const rangeStart = new Date(day);
      rangeStart.setDate(rangeStart.getDate() - 14);
      const rangeStartStr =
        rangeStart.toISOString().slice(0, 10) + "T00:00:00+08:00";

      const fetchAllGoodsRows = () =>
        fetchAllRowsByPage((from, to) =>
          supabase
            .from("goods_detail_slot_log")
            .select(
              "item_id, item_name, slot_ts, item_cart_cnt, search_uv, search_pay_rate, cart_uv, cart_pay_rate",
            )
            .gte("slot_ts", rangeStartStr)
            .lte("slot_ts", dayEnd)
            .order("slot_ts", { ascending: true })
            .range(from, to),
        );

      try {
        const [goodsRows, list, rankRows] = await Promise.all([
          fetchAllGoodsRows(),
          fetchDistinctGoodsFromSlotLog(supabase, dayEnd),
          fetchAllRowsByPage((from, to) =>
            supabase
              .from("sycm_market_rank_log")
              .select("created_at, shop_title, rank")
              // 与 goods_detail_slot_log 同一窗口，便于「多日→自选」列出窗口内所有有排名数据的日期
              .gte("created_at", rangeStartStr)
              .lte("created_at", dayEnd)
              .order("created_at", { ascending: true })
              .range(from, to),
          ),
        ]);
        setRawGoodsDetailRows(goodsRows);
        setRawMarketRankRows(rankRows);

        setGoodsList(list);
        setDataSource("supabase");
        if (
          selectedItemId === MARKET_RANK_ITEM_ID ||
          selectedItemId === CAMPAIGN_REGISTER_ITEM_ID
        ) {
          // 保持「店铺排名」或「推广数据」选中不变
        } else if (list.length > 0 && !selectedItemId) {
          setSelectedItemId(list[0].item_id);
        } else if (
          selectedItemId &&
          !list.find((g) => g.item_id === selectedItemId)
        ) {
          setSelectedItemId(list[0]?.item_id ?? "");
        }

        const rankChart = marketRankRowsToChartData(rankRows);
        const hasGoods = goodsRows.length > 0;
        const hasRank =
          rankChart.shopNames?.length > 0 &&
          Object.keys(rankChart.byDateSlot || {}).length > 0;
        if (hasGoods || hasRank) {
          // 保持用户选择的 day（含日期框选的、当日尚无 slot 数据的日期），不回退到「有数据的最后一天」
          setSelectedDate(day);
          setSelectedDatesPick([day]);
          setView("dashboard");
        } else {
          setError(null);
          setSelectedDate(day);
          setSelectedDatesPick([day]);
          setView("dashboard");
        }
      } catch (err) {
        setError("加载失败：" + (err.message || String(err)));
      } finally {
        setSupabaseLoading(false);
      }
    },
    [selectedDate],
  );

  useEffect(() => {
    if (!supabase || dataSource !== "supabase") return;
    const channel = supabase
      .channel("goods_detail_slot_log_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "goods_detail_slot_log" },
        (payload) => {
          const row = payload.new;
          if (row && row.item_id && row.slot_ts) {
            setRawGoodsDetailRows((prev) => [
              ...prev,
              {
                item_id: row.item_id,
                item_name: row.item_name,
                slot_ts: row.slot_ts,
                item_cart_cnt: row.item_cart_cnt,
                search_uv: row.search_uv,
                search_pay_rate: row.search_pay_rate,
                cart_uv: row.cart_uv,
                cart_pay_rate: row.cart_pay_rate,
              },
            ]);
            const name =
              row.item_name != null ? String(row.item_name).trim() : "";
            const displayName = resolveBestItemNameFromCandidates(
              [name || String(row.item_id)],
              row.item_id,
            );
            setGoodsList((prev) => {
              if (prev.some((g) => g.item_id === row.item_id)) return prev;
              const next = [
                ...prev,
                { item_id: row.item_id, item_name: displayName },
              ];
              return next.sort((a, b) =>
                a.item_name.localeCompare(b.item_name, "zh-CN"),
              );
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "goods_detail_slot_log" },
        (payload) => {
          const row = payload.new;
          if (row && row.item_id && row.slot_ts) {
            setRawGoodsDetailRows((prev) => {
              const idx = prev.findIndex(
                (r) => r.item_id === row.item_id && r.slot_ts === row.slot_ts,
              );
              const next = [...prev];
              if (idx >= 0) next[idx] = { ...next[idx], ...row };
              else next.push(row);
              return next;
            });
            const incoming =
              row.item_name != null ? String(row.item_name).trim() : "";
            const fromRow = incoming || String(row.item_id);
            setGoodsList((prev) => {
              const gi = prev.findIndex(
                (g) => String(g.item_id) === String(row.item_id),
              );
              if (gi < 0) return prev;
              const merged = mergeItemNameForGoodsList(
                prev[gi].item_name,
                fromRow,
                row.item_id,
              );
              if (merged === prev[gi].item_name) return prev;
              const next = [...prev];
              next[gi] = { ...next[gi], item_name: merged };
              return next.sort((a, b) =>
                a.item_name.localeCompare(b.item_name, "zh-CN"),
              );
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sycm_market_rank_log" },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          const created_at =
            row.created_at ?? row.recorded_at ?? row.recordedAt;
          const shop_title = row.shop_title ?? row.shopTitle;
          const rank = row.rank;
          if (created_at && shop_title != null) {
            setRawMarketRankRows((prev) => [
              ...prev,
              { created_at, shop_title, rank },
            ]);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dataSource]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadFromSupabase();
  }, [loadFromSupabase]);

  useEffect(() => {
    if (!supabase || selectedItemId !== CAMPAIGN_REGISTER_ITEM_ID) {
      if (selectedItemId !== CAMPAIGN_REGISTER_ITEM_ID)
        setCampaignRegisterRows([]);
      return;
    }
    let cancelled = false;
    setCampaignRegisterLoading(true);
    (async () => {
      try {
        const rows = await fetchAllRowsByPage((from, to) =>
          supabase
            .from("campaign_register")
            .select(
              "report_date, campaign_name, charge_onebpdisplay, alipay_inshop_amt_onebpdisplay, charge_onebpsite, alipay_inshop_amt_onebpsite, charge_onebpsearch, alipay_inshop_amt_onebpsearch, charge_onebpshortvideo, alipay_inshop_amt_onebpshortvideo",
            )
            .order("report_date", { ascending: false })
            .order("campaign_name")
            .range(from, to),
        );
        if (cancelled) return;
        setCampaignRegisterLoading(false);
        setCampaignRegisterRows(rows);
      } catch (err) {
        if (cancelled) return;
        setCampaignRegisterLoading(false);
        setError("推广数据加载失败：" + (err.message || String(err)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedItemId]);

  const handleCampaignRegisterDeleteConfirm = useCallback(async () => {
    const row = deleteConfirmRow;
    if (!supabase || !row) return;
    setCampaignRegisterDeleting(true);
    setError(null);
    const reportDate = row.report_date != null ? String(row.report_date).slice(0, 10) : "";
    const campaignName = String(row.campaign_name ?? "").trim();
    const { data: deletedRows, error: deleteError } = await supabase
      .from("campaign_register")
      .delete()
      .eq("report_date", reportDate)
      .eq("campaign_name", campaignName)
      .select("report_date");
    setCampaignRegisterDeleting(false);
    setDeleteConfirmRow(null);
    if (deleteError) {
      setError("删除失败：" + (deleteError.message || String(deleteError)) + "。请确认 Supabase 已为 campaign_register 表添加 delete 策略（运行 supabase_campaign_register_delete_policy.sql）");
      return;
    }
    if (!deletedRows || deletedRows.length === 0) {
      setError("未从 Supabase 删除任何数据（可能无 delete 权限或条件未匹配）。请运行 extensions/extension-campaign-register/sql/supabase_campaign_register_delete_policy.sql 后重试。");
      return;
    }
    setCampaignRegisterRows((prev) =>
      prev.filter(
        (r) =>
          !(
            String(r.report_date ?? "").slice(0, 10) === reportDate &&
            String(r.campaign_name ?? "").trim() === campaignName
          ),
      ),
    );
  }, [deleteConfirmRow]);

  /** 推广数据：有数据的日期列表（从已加载数据中取，降序） */
  const campaignRegisterDates = useMemo(() => {
    const set = new Set();
    campaignRegisterRows.forEach((r) => {
      const d = r.report_date != null ? String(r.report_date).slice(0, 10) : "";
      if (d) set.add(d);
    });
    return Array.from(set).sort().reverse();
  }, [campaignRegisterRows]);

  /** 仅查 slot_ts：当前商品在选中「自然月」内有数据的日期，供月历圆点（与 load 窗口上界无关） */
  useEffect(() => {
    if (!supabase || dataSource !== "supabase") {
      setItemMonthSlotDates([]);
      return;
    }
    if (
      !selectedItemId ||
      selectedItemId === MARKET_RANK_ITEM_ID ||
      selectedItemId === CAMPAIGN_REGISTER_ITEM_ID
    ) {
      setItemMonthSlotDates([]);
      return;
    }
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      setItemMonthSlotDates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [y, m] = selectedDate.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const monthStart = `${y}-${String(m).padStart(2, "0")}-01T00:00:00+08:00`;
      const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999+08:00`;
      try {
        const rows = await fetchAllRowsByPage((from, to) =>
          supabase
            .from("goods_detail_slot_log")
            .select("slot_ts")
            .eq("item_id", selectedItemId)
            .gte("slot_ts", monthStart)
            .lte("slot_ts", monthEnd)
            .order("slot_ts", { ascending: true })
            .range(from, to),
        );
        if (cancelled) return;
        const ds = new Set();
        for (const r of rows) {
          const d = slotTsToEast8DateString(r.slot_ts);
          if (d) ds.add(d);
        }
        setItemMonthSlotDates(Array.from(ds).sort());
      } catch {
        if (!cancelled) setItemMonthSlotDates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, dataSource, selectedItemId, selectedDate]);

  /** 下拉/月历「有数据」日期：图表解析结果 ∪ 当月按商品查询的 slot 日（避免仅 load 到选中日当天导致后续日无点） */
  const datesForSelection = useMemo(() => {
    if (selectedItemId === CAMPAIGN_REGISTER_ITEM_ID) return campaignRegisterDates;
    if (selectedItemId === MARKET_RANK_ITEM_ID) return rankDatesSorted;
    const fromChart = parsedData?.dates ?? [];
    const merged = new Set([...fromChart, ...itemMonthSlotDates]);
    return Array.from(merged).sort();
  }, [
    selectedItemId,
    campaignRegisterDates,
    rankDatesSorted,
    parsedData?.dates,
    itemMonthSlotDates,
  ]);

  /** 推广数据：多日/单日下要展示的日期列表（与 header 里 selectedDates 逻辑一致） */
  const campaignSelectedDates = useMemo(() => {
    if (viewMode === "single") {
      return selectedDate ? [selectedDate] : [];
    }
    if (viewMode === "multiRange") {
      const base =
        selectedDate ?? campaignRegisterDates[campaignRegisterDates.length - 1];
      if (!base) return [];
      const i = campaignRegisterDates.indexOf(base);
      if (i < 0) return campaignRegisterDates.slice(-rangeDays);
      const start = Math.max(0, i - rangeDays + 1);
      return campaignRegisterDates.slice(start, i + 1);
    }
    if (viewMode === "multiPick") {
      return selectedDatesPick.length > 0 ? [...selectedDatesPick].sort() : [];
    }
    return [];
  }, [
    viewMode,
    selectedDate,
    selectedDatesPick,
    rangeDays,
    campaignRegisterDates,
  ]);

  /** 推广数据：当前选中日期（单日或多日）下的行（用于展示），按商品名称指定顺序排序 */
  const displayedCampaignRows = useMemo(() => {
    if (campaignSelectedDates.length === 0) return campaignRegisterRows;
    const set = new Set(campaignSelectedDates);
    const filtered = campaignRegisterRows.filter((r) => {
      const d = r.report_date != null ? String(r.report_date).slice(0, 10) : "";
      return set.has(d);
    });
    const orderMap = new Map(CAMPAIGN_NAME_ORDER.map((name, i) => [name, i]));
    return [...filtered].sort((a, b) => {
      const nameA = String(a.campaign_name ?? "").trim();
      const nameB = String(b.campaign_name ?? "").trim();
      const iA = orderMap.has(nameA) ? orderMap.get(nameA) : CAMPAIGN_NAME_ORDER.length;
      const iB = orderMap.has(nameB) ? orderMap.get(nameB) : CAMPAIGN_NAME_ORDER.length;
      if (iA !== iB) return iA - iB;
      return nameA.localeCompare(nameB);
    });
  }, [campaignRegisterRows, campaignSelectedDates]);

  const NUMERIC_KEYS = [
    "charge_onebpsearch",
    "alipay_inshop_amt_onebpsearch",
    "charge_onebpdisplay",
    "alipay_inshop_amt_onebpdisplay",
    "charge_onebpsite",
    "alipay_inshop_amt_onebpsite",
    "charge_onebpshortvideo",
    "alipay_inshop_amt_onebpshortvideo",
  ];

  /** 推广数据：在 池_小贝壳 下、池_大云团 下插入汇总行（开关打开时） */
  const displayedCampaignRowsWithSummary = useMemo(() => {
    if (!showCampaignSummary || displayedCampaignRows.length === 0) return displayedCampaignRows;
    const set1 = new Set(CAMPAIGN_SUMMARY_GROUP1);
    const set2 = new Set(CAMPAIGN_SUMMARY_GROUP2);
    const byDate = new Map();
    for (const r of displayedCampaignRows) {
      const d = r.report_date != null ? String(r.report_date).slice(0, 10) : "";
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(r);
    }
    const out = [];
    const sumRows = (rows) => {
      const row = { report_date: rows[0]?.report_date ?? null, campaign_name: "", isSummaryRow: true };
      for (const k of CAMPAIGN_NUMERIC_KEYS) row[k] = 0;
      for (const r of rows) {
        for (const k of CAMPAIGN_NUMERIC_KEYS) row[k] = (Number(r[k]) || 0) + (row[k] ?? 0);
      }
      return row;
    };
    const dates = Array.from(byDate.keys()).sort().reverse();
    for (const d of dates) {
      const rows = byDate.get(d);
      for (const r of rows) {
        out.push(r);
        const name = String(r.campaign_name ?? "").trim();
        if (name === "池_小贝壳") {
          const group1Rows = rows.filter((row) => set1.has(String(row.campaign_name ?? "").trim()));
          if (group1Rows.length > 0) {
            const sum = sumRows(group1Rows);
            sum.campaign_name = "汇总";
            out.push(sum);
          }
        } else if (name === "池_大云团") {
          const group2Rows = rows.filter((row) => set2.has(String(row.campaign_name ?? "").trim()));
          if (group2Rows.length > 0) {
            const sum = sumRows(group2Rows);
            sum.campaign_name = "汇总";
            out.push(sum);
          }
        }
      }
    }
    return out;
  }, [showCampaignSummary, displayedCampaignRows]);

  /** 切换到推广数据且当前选中日期不在数据范围内时，切到最新有数据的日期 */
  useEffect(() => {
    if (selectedItemId !== CAMPAIGN_REGISTER_ITEM_ID) return;
    if (campaignRegisterDates.length === 0) return;
    if (selectedDate && campaignRegisterDates.includes(selectedDate)) return;
    setSelectedDate(campaignRegisterDates[0]);
  }, [selectedItemId, campaignRegisterDates, selectedDate]);

  const noteFetchScope = useMemo(() => {
    if (dataSource !== "supabase") return { chartKeys: [], pointDates: [] };
    const { dates = [], byDate = {} } = parsedData || {};
    const marketChart = marketRankChart || {};
    const shopNames = marketChart.shopNames || [];
    let pointDates = [];
    if (viewMode === "single") {
      pointDates = selectedDate
        ? [selectedDate]
        : dates.length
          ? [dates[0]]
          : [];
    } else if (viewMode === "multiRange") {
      const base = selectedDate ?? dates[dates.length - 1];
      if (base) {
        const i = dates.indexOf(base);
        pointDates =
          i >= 0
            ? dates.slice(Math.max(0, i - rangeDays + 1), i + 1)
            : dates.slice(-rangeDays);
      }
    } else if (viewMode === "multiPick") {
      pointDates =
        selectedDatesPick.length > 0
          ? [...selectedDatesPick].sort()
          : dates.length
            ? [dates[0]]
            : [];
    }
    const seenKeys = new Set();
    for (const d of dates) {
      for (const s of byDate[d]?.series ?? []) {
        const key = `${s.category}-${s.subCategory}`;
        if (!seenKeys.has(key)) seenKeys.add(key);
      }
    }
    const templateKeys = Array.from(seenKeys).slice(0, SERIES_ORDER_LIMIT);
    const marketKeys = shopNames.map((name) => "market-rank-" + name);
    return { chartKeys: [...templateKeys, ...marketKeys], pointDates };
  }, [
    dataSource,
    parsedData,
    marketRankChart,
    viewMode,
    selectedDate,
    rangeDays,
    selectedDatesPick,
  ]);

  const noteFetchChartKeys = noteFetchScope.chartKeys.join(",");
  const noteFetchPointDates = noteFetchScope.pointDates.join(",");
  useEffect(() => {
    if (!supabase || !noteFetchChartKeys || !noteFetchPointDates) return;
    const chartKeys = noteFetchScope.chartKeys;
    const pointDates = noteFetchScope.pointDates;
    let cancelled = false;
    (async () => {
      const next = await fetchChartNotes(supabase, chartKeys, pointDates);
      if (!cancelled) setChartNotes(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [noteFetchChartKeys, noteFetchPointDates]);

  useEffect(() => {
    if (enlargedIndex == null) return;
    const onEsc = (e) => {
      if (e.key !== "Escape") return;
      if (noteModal) return;
      setEnlargedIndex(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [enlargedIndex, noteModal]);

  useEffect(() => {
    if (deleteConfirmRow == null) return;
    const onEsc = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDeleteConfirmRow(null);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [deleteConfirmRow]);

  if (pathname !== "/" && pathname !== "/data") {
    return <Navigate to="/" replace />;
  }

  if (view === "dashboard") {
    const isMarketRankView = selectedItemId === MARKET_RANK_ITEM_ID;
    const isCampaignRegisterView = selectedItemId === CAMPAIGN_REGISTER_ITEM_ID;
    const { dates, byDate } = parsedData || { dates: [], byDate: {} };
    const firstDate = datesForSelection[0];

    let selectedDates = [];
    if (viewMode === "single") {
      selectedDates = selectedDate
        ? [selectedDate]
        : firstDate
          ? [firstDate]
          : [];
    } else if (viewMode === "multiRange") {
      const base =
        selectedDate ?? datesForSelection[datesForSelection.length - 1];
      if (base) {
        const i = datesForSelection.indexOf(base);
        if (i >= 0) {
          const start = Math.max(0, i - rangeDays + 1);
          selectedDates = datesForSelection.slice(start, i + 1);
        } else {
          selectedDates = datesForSelection.slice(-rangeDays);
        }
      }
    } else if (viewMode === "multiPick") {
      selectedDates =
        selectedDatesPick.length > 0
          ? [...selectedDatesPick].sort()
          : firstDate
            ? [firstDate]
            : [];
    }

    const seenKeys = new Set();
    const template = [];
    for (const d of dates) {
      for (const s of byDate[d]?.series ?? []) {
        const key = `${s.category}-${s.subCategory}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          template.push(s);
        }
      }
    }
    const templateLimited = isMarketRankView
      ? []
      : template.slice(0, SERIES_ORDER_LIMIT);

    const handleExportTable = async () => {
      if (!supabase) {
        setError("未配置 Supabase，无法导出表格");
        return;
      }
      setExporting(true);
      setError(null);
      try {
        const day =
          selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
            ? selectedDate
            : getTodayEast8();
        const dayEnd = `${day}T23:59:59.999+08:00`;
        const rangeStart = new Date(day);
        rangeStart.setDate(rangeStart.getDate() - 14);
        const rangeStartStr =
          rangeStart.toISOString().slice(0, 10) + "T00:00:00+08:00";

        const allRows = await fetchAllRowsByPage((from, to) =>
          supabase
            .from("goods_detail_slot_log")
            .select(
              "item_id, item_name, slot_ts, item_cart_cnt, search_uv, search_pay_rate, cart_uv, cart_pay_rate",
            )
            .gte("slot_ts", rangeStartStr)
            .lte("slot_ts", dayEnd)
            .order("slot_ts", { ascending: true })
            .range(from, to),
        );
        if (allRows.length === 0) {
          setError("该日期范围内无商品数据，无法导出");
          return;
        }
        console.log(
          "[导出表格] Supabase 原始行样例（前 5 条，用于核对 item_id/item_name）：",
          JSON.stringify(allRows.slice(0, 5), null, 2),
        );
        const tableRows = goodsDetailRowsToTableRows(allRows);
        const name = `小贝壳作战-表格-${day}.xlsx`;
        downloadTableXlsx(tableRows, name);
      } catch (err) {
        console.error("导出表格失败", err);
        setError("导出表格失败：" + (err.message || String(err)));
      } finally {
        setExporting(false);
      }
    };

    const seriesForGrid = isMarketRankView
      ? []
      : templateLimited.map((t) => {
          const seriesItems = selectedDates
            .map((date) => {
              const day = byDate[date];
              const s = day?.series?.find(
                (x) =>
                  x.category === t.category && x.subCategory === t.subCategory,
              );
              return s ? { date, ...s } : null;
            })
            .filter(Boolean);
          const actionsByDate = selectedDates.reduce(
            (acc, d) => ({ ...acc, [d]: byDate[d]?.actions ?? {} }),
            {},
          );
          return {
            key: `${t.category}-${t.subCategory}`,
            seriesItem: seriesItems.length === 1 ? seriesItems[0] : null,
            seriesItems: seriesItems.length > 1 ? seriesItems : null,
            actions:
              seriesItems.length === 1 ? actionsByDate[selectedDates[0]] : null,
            actionsByDate: seriesItems.length > 1 ? actionsByDate : null,
          };
        });

    const marketRankForGrid = marketRankChartToGridItems(marketRankChart, {
      viewMode,
      selectedDate: selectedDate ?? null,
      selectedDates,
      trendDates: [],
    });

    const seriesGridItems = isMarketRankView
      ? marketRankForGrid
          .filter(
            (m) =>
              m.seriesItem ||
              (Array.isArray(m.seriesItems) && m.seriesItems.length > 0),
          )
          .map((m) => ({
            type: "series",
            key: m.key,
            seriesItem:
              m.seriesItem ??
              (m.seriesItems?.length === 1 ? m.seriesItems[0] : null),
            seriesItems:
              m.seriesItems && m.seriesItems.length > 1 ? m.seriesItems : null,
            actions: null,
            actionsByDate: null,
          }))
      : seriesForGrid.map((s) => ({ type: "series", ...s }));
    const totalGridCells = seriesGridItems.length;
    const hasNoDataForSelection = isCampaignRegisterView
      ? !campaignRegisterLoading && displayedCampaignRows.length === 0
      : totalGridCells === 0;

    const formatReportDate = (d) => {
      if (!d) return "";
      const s = typeof d === "string" ? d : (d.slice && d.slice(0, 10)) || "";
      return s.replace(/-/g, "/");
    };
    /** 金额保留两位小数，0 / 0.00 显示为空 */
    const formatMoney = (n) => {
      if (n == null || Number.isNaN(Number(n))) return "";
      const val = Number(n);
      return val === 0 ? "" : val.toFixed(2);
    };
    /** ROI = 成交/消耗，消耗为 0 或结果为 0 时显示为空 */
    const formatRoi = (charge, amt) => {
      const c = charge != null ? Number(charge) : 0;
      if (c === 0 || Number.isNaN(c)) return "";
      const a = amt != null ? Number(amt) : 0;
      if (Number.isNaN(a)) return "";
      const roi = a / c;
      return roi === 0 ? "" : roi.toFixed(2);
    };
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <>
              <div className="dashboard-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "single"}
                  className={`dashboard-tab ${viewMode === "single" ? "dashboard-tab--active" : ""}`}
                  onClick={() => setViewMode("single")}
                >
                  单日
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={
                    viewMode === "multiRange" || viewMode === "multiPick"
                  }
                  className={`dashboard-tab ${viewMode === "multiRange" || viewMode === "multiPick" ? "dashboard-tab--active" : ""}`}
                  onClick={() => setViewMode("multiRange")}
                >
                  多日
                </button>
              </div>

              {viewMode === "single" && (
                <DashboardSingleDatePicker
                  key={selectedItemId}
                  value={selectedDate ?? ""}
                  datesWithData={datesForSelection}
                  getTodayYmd={getTodayEast8}
                  onSelectDate={(next) => {
                    setSelectedDate(next);
                    if (dataSource === "supabase" && view === "dashboard") {
                      loadFromSupabase(next);
                    }
                  }}
                />
              )}

              {(viewMode === "multiRange" || viewMode === "multiPick") && (
                <>
                  <div className="dashboard-subtabs">
                    <button
                      type="button"
                      className={`dashboard-subtab ${viewMode === "multiRange" ? "dashboard-subtab--active" : ""}`}
                      onClick={() => setViewMode("multiRange")}
                    >
                      连续
                    </button>
                    <button
                      type="button"
                      className={`dashboard-subtab ${viewMode === "multiPick" ? "dashboard-subtab--active" : ""}`}
                      onClick={() => setViewMode("multiPick")}
                    >
                      自选
                    </button>
                  </div>
                  {viewMode === "multiRange" && (
                    <>
                      <DashboardSingleDatePicker
                        key={selectedItemId}
                        value={selectedDate ?? ""}
                        datesWithData={datesForSelection}
                        getTodayYmd={getTodayEast8}
                        onSelectDate={(next) => setSelectedDate(next)}
                      />
                      <label className="dashboard-date-label">
                        共
                        <select
                          className="dashboard-date-select dashboard-date-select--narrow"
                          value={rangeDays}
                          onChange={(e) => setRangeDays(Number(e.target.value))}
                        >
                          {RANGE_DAY_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n} 天
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {viewMode === "multiPick" && (
                    <DashboardMultiDatePicker
                      key={selectedItemId}
                      value={selectedDatesPick}
                      onChange={setSelectedDatesPick}
                      datesWithData={datesForSelection}
                      getTodayYmd={getTodayEast8}
                    />
                  )}
                </>
              )}
            </>
          </div>

          {dataSource === "supabase" && (
            <div className="dashboard-header-center">
              {isDataHub ? (
                <GoodsSelect
                  id="dashboard-goods-select"
                  label=""
                  options={[
                    { item_id: MARKET_RANK_ITEM_ID, item_name: "店铺排名" },
                    ...goodsList,
                  ]}
                  value={selectedItemId}
                  onChange={setSelectedItemId}
                  placeholder="请选择商品"
                  className="goods-select--header"
                />
              ) : (
                <span className="dashboard-promo-only-title">推广数据</span>
              )}
            </div>
          )}

          <div className="dashboard-header-actions">
            {isCampaignRegisterView && (
              <label className="dashboard-summary-switch">
                <span className="dashboard-summary-switch-label">展示汇总</span>
                <input
                  type="checkbox"
                  checked={showCampaignSummary}
                  onChange={(e) => setShowCampaignSummary(e.target.checked)}
                  className="dashboard-summary-switch-input"
                  aria-label="展示汇总"
                />
                <span className="dashboard-summary-switch-slider" />
              </label>
            )}
            {supabaseLoading ? (
              <span className="dashboard-loading-hint">加载中…</span>
            ) : dataSource === "supabase" &&
              !isCampaignRegisterView &&
              (rawGoodsDetailRows.length > 0 ||
                rawMarketRankRows.length > 0) ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleExportTable}
                disabled={exporting}
              >
                {exporting ? "导出中…" : "导出表格"}
              </button>
            ) : null}
            {error && <span className="dashboard-header-error">{error}</span>}
          </div>
        </header>

        {deleteConfirmRow != null && (
          <div
            className="note-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onClick={(e) => e.target === e.currentTarget && setDeleteConfirmRow(null)}
          >
            <div className="note-modal-panel" onClick={(e) => e.stopPropagation()}>
              <h2 id="delete-confirm-title" className="delete-confirm-title">
                确定删除该条推广数据？
              </h2>
              <p className="delete-confirm-desc">
                {formatReportDate(deleteConfirmRow.report_date)} · {deleteConfirmRow.campaign_name ?? ""}
              </p>
              <div className="delete-confirm-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setDeleteConfirmRow(null)}
                  disabled={campaignRegisterDeleting}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCampaignRegisterDeleteConfirm}
                  disabled={campaignRegisterDeleting}
                >
                  {campaignRegisterDeleting ? "删除中…" : "确定"}
                </button>
              </div>
            </div>
          </div>
        )}

        <NoteModal
          open={noteModal != null}
          chartKey={noteModal?.chartKey ?? ""}
          pointDate={noteModal?.pointDate ?? ""}
          pointSlot={noteModal?.pointSlot ?? ""}
          initialNote={noteModal?.initialNote ?? ""}
          onClose={() => setNoteModal(null)}
          onSave={async (note) => {
            if (!noteModal || !supabase) return;
            await upsertChartNote(
              supabase,
              noteModal.chartKey,
              noteModal.pointDate,
              noteModal.pointSlot,
              note,
            );
            const key = `${noteModal.pointDate}|${noteModal.pointSlot ?? ""}`;
            setChartNotes((prev) => ({
              ...prev,
              [noteModal.chartKey]: {
                ...(prev[noteModal.chartKey] ?? {}),
                [key]: note,
              },
            }));
          }}
        />

        <main className="dashboard-main">
          {hasNoDataForSelection ? (
            <p className="dashboard-empty-hint">
              {isCampaignRegisterView
                ? "暂无推广数据，请使用扩展在推广记录页登记后再查看"
                : "当前日期暂无数据，请切换日期后查看"}
            </p>
          ) : isCampaignRegisterView ? (
            <div className="campaign-register-wrap">
              {campaignRegisterLoading ? (
                <p className="dashboard-empty-hint">加载中…</p>
              ) : (
                <table className="campaign-register-table">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>商品名称</th>
                      <th>关键词消耗</th>
                      <th>关键词成交</th>
                      <th className="campaign-register-roi">关键词ROI</th>
                      <th>人群消耗</th>
                      <th>人群成交</th>
                      <th className="campaign-register-roi">人群ROI</th>
                      <th>全站消耗</th>
                      <th>全站成交</th>
                      <th className="campaign-register-roi">全站ROI</th>
                      <th>内容消耗</th>
                      <th>内容成交</th>
                      <th className="campaign-register-roi">内容ROI</th>
                      <th className="campaign-register-action">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedCampaignRowsWithSummary.map((row, i) => (
                      <tr
                        key={row.isSummaryRow ? `summary-${row.report_date}-${row.campaign_name}-${i}` : `${row.report_date}-${row.campaign_name ?? ""}-${i}`}
                        className={row.isSummaryRow ? "campaign-register-row--summary" : undefined}
                      >
                        <td>{formatReportDate(row.report_date)}</td>
                        <td title={row.campaign_name ?? ""}>
                          {row.campaign_name ?? ""}
                        </td>
                        <td className="campaign-register-num">
                          {formatMoney(row.charge_onebpsearch)}
                        </td>
                        <td className="campaign-register-num">
                          {formatMoney(row.alipay_inshop_amt_onebpsearch)}
                        </td>
                        <td className="campaign-register-num campaign-register-roi">
                          {formatRoi(row.charge_onebpsearch, row.alipay_inshop_amt_onebpsearch)}
                        </td>
                        <td className="campaign-register-num">
                          {formatMoney(row.charge_onebpdisplay)}
                        </td>
                        <td className="campaign-register-num">
                          {formatMoney(row.alipay_inshop_amt_onebpdisplay)}
                        </td>
                        <td className="campaign-register-num campaign-register-roi">
                          {formatRoi(row.charge_onebpdisplay, row.alipay_inshop_amt_onebpdisplay)}
                        </td>
                        <td className="campaign-register-num">
                          {formatMoney(row.charge_onebpsite)}
                        </td>
                        <td className="campaign-register-num">
                          {formatMoney(row.alipay_inshop_amt_onebpsite)}
                        </td>
                        <td className="campaign-register-num campaign-register-roi">
                          {formatRoi(row.charge_onebpsite, row.alipay_inshop_amt_onebpsite)}
                        </td>
                        <td className="campaign-register-num">
                          {formatMoney(row.charge_onebpshortvideo)}
                        </td>
                        <td className="campaign-register-num">
                          {formatMoney(row.alipay_inshop_amt_onebpshortvideo)}
                        </td>
                        <td className="campaign-register-num campaign-register-roi">
                          {formatRoi(row.charge_onebpshortvideo, row.alipay_inshop_amt_onebpshortvideo)}
                        </td>
                        <td className="campaign-register-action">
                          {row.isSummaryRow ? (
                            ""
                          ) : (
                            <button
                              type="button"
                              className="campaign-register-delete-btn"
                              onClick={() => setDeleteConfirmRow({ report_date: row.report_date, campaign_name: row.campaign_name })}
                              aria-label={`删除 ${row.campaign_name ?? ""}`}
                            >
                              删除
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="chart-grid" ref={chartGridRef}>
              {seriesGridItems.map((cell, i) => (
                <ChartCell
                  key={cell.key}
                  seriesItem={cell.seriesItem}
                  seriesItems={cell.seriesItems}
                  actions={cell.actions}
                  actionsByDate={cell.actionsByDate}
                  compact
                  chartKey={cell.key}
                  currentDate={selectedDates[0]}
                  notesMap={chartNotes[cell.key] ?? {}}
                  detailPoints20m={
                    dataSource === "supabase" &&
                    cell.key === `${selectedItemName}-商品加购件数` &&
                    selectedDates[0]
                      ? getGoodsDetail20MinPointsForDate(
                          rawGoodsDetailRows.filter(
                            (r) => r.item_id === selectedItemId,
                          ),
                          selectedDates[0],
                        )
                      : null
                  }
                  onClick={() => setEnlargedIndex(i)}
                />
              ))}
            </div>
          )}
        </main>

        {enlargedIndex != null && (
          <div
            className="dashboard-overlay"
            role="presentation"
            onClick={(e) =>
              e.target === e.currentTarget && setEnlargedIndex(null)
            }
          >
            <button
              type="button"
              className="dashboard-nav dashboard-nav--left"
              aria-label="上一张"
              onClick={(e) => {
                e.stopPropagation();
                setEnlargedIndex(
                  (enlargedIndex + totalGridCells - 1) % totalGridCells,
                );
              }}
            >
              <HiChevronLeft />
            </button>
            <div
              className="dashboard-enlarged"
              ref={enlargedRef}
              onClick={(e) => e.stopPropagation()}
            >
              {seriesGridItems[enlargedIndex] && (
                <ChartCell
                  seriesItem={seriesGridItems[enlargedIndex].seriesItem}
                  seriesItems={seriesGridItems[enlargedIndex].seriesItems}
                  actions={seriesGridItems[enlargedIndex].actions}
                  actionsByDate={seriesGridItems[enlargedIndex].actionsByDate}
                  compact={false}
                  chartKey={seriesGridItems[enlargedIndex].key}
                  currentDate={selectedDates[0]}
                  onDotClick={(ctx) => setNoteModal(ctx)}
                  notesMap={
                    chartNotes[seriesGridItems[enlargedIndex].key] ?? {}
                  }
                  detailPoints20m={
                    dataSource === "supabase" &&
                    seriesGridItems[enlargedIndex].key ===
                      `${selectedItemName}-商品加购件数` &&
                    selectedDates[0]
                      ? getGoodsDetail20MinPointsForDate(
                          rawGoodsDetailRows.filter(
                            (r) => r.item_id === selectedItemId,
                          ),
                          selectedDates[0],
                        )
                      : null
                  }
                />
              )}
            </div>
            <button
              type="button"
              className="dashboard-nav dashboard-nav--right"
              aria-label="下一张"
              onClick={(e) => {
                e.stopPropagation();
                setEnlargedIndex((enlargedIndex + 1) % totalGridCells);
              }}
            >
              <HiChevronRight />
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default App;
