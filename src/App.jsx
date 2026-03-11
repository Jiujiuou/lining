import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import html2canvas from "html2canvas";
import {
  goodsDetailSlotRowsToChartData,
  getGoodsDetail20MinPointsForDate,
} from "./utils/supabaseCartLogToChart";
import {
  marketRankRowsToChartData,
  marketRankChartToGridItems,
} from "./utils/supabaseMarketRankToChart";
import { supabase } from "./lib/supabase";
import { fetchChartNotes, upsertChartNote } from "./lib/chartNotes";
import {
  goodsDetailRowsToTableRows,
  downloadTableXlsx,
} from "./utils/exportGoodsDetailTable";
import ChartCell from "./components/ChartCell";
import NoteModal from "./components/NoteModal";
import GoodsSelect from "./components/GoodsSelect";
import "./App.css";

/** Supabase 单次查询默认最多返回行数，超过需分页 */
const SUPABASE_PAGE_SIZE = 1000;

const SERIES_ORDER_LIMIT = 9;
const RANGE_DAY_OPTIONS = [2, 3, 5, 7];
/** 店铺排名在 GoodsSelect 中的占位 value，选中时仅展示市场排名图表 */
const MARKET_RANK_ITEM_ID = "__market_rank__";

/** 东八区当天日期 YYYY-MM-DD */
function getTodayEast8() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function App() {
  const [view, setView] = useState("dashboard");
  const [dataSource, setDataSource] = useState(null); // 'supabase' | null
  const [rawGoodsDetailRows, setRawGoodsDetailRows] = useState([]);
  const [goodsList, setGoodsList] = useState([]); // { item_id, item_name }[]
  const [selectedItemId, setSelectedItemId] = useState("");
  const [rawMarketRankRows, setRawMarketRankRows] = useState([]);
  const [viewMode, setViewMode] = useState("single");
  const [selectedDate, setSelectedDate] = useState(() => getTodayEast8());
  const [rangeDays, setRangeDays] = useState(3);
  const [selectedDatesPick, setSelectedDatesPick] = useState([]);
  const [enlargedIndex, setEnlargedIndex] = useState(null);
  const [pickOpen, setPickOpen] = useState(false);
  const pickRef = useRef(null);
  const chartGridRef = useRef(null);
  const enlargedRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [noteModal, setNoteModal] = useState(null);
  const [chartNotes, setChartNotes] = useState({});

  useEffect(() => {
    const today = getTodayEast8();
    console.log("今天日期（东八区）:", today);
  }, []);

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
      const dayStart = `${day}T00:00:00+08:00`;
      const dayEnd = `${day}T23:59:59.999+08:00`;
      const rangeStart = new Date(day);
      rangeStart.setDate(rangeStart.getDate() - 14);
      const rangeStartStr =
        rangeStart.toISOString().slice(0, 10) + "T00:00:00+08:00";

      const fetchAllGoodsRows = async () => {
        const rows = [];
        let from = 0;
        while (true) {
          const to = from + SUPABASE_PAGE_SIZE - 1;
          const { data, error } = await supabase
            .from("goods_detail_slot_log")
            .select(
              "item_id, item_name, slot_ts, item_cart_cnt, search_uv, search_pay_rate, cart_uv, cart_pay_rate",
            )
            .gte("slot_ts", rangeStartStr)
            .lte("slot_ts", dayEnd)
            .order("slot_ts", { ascending: true })
            .range(from, to);
          if (error) throw error;
          const chunk = data ?? [];
          rows.push(...chunk);
          if (chunk.length < SUPABASE_PAGE_SIZE) break;
          from = to + 1;
        }
        return rows;
      };

      try {
        const [goodsRows, rankRes] = await Promise.all([
          fetchAllGoodsRows(),
          supabase
            .from("sycm_market_rank_log")
            .select("created_at, shop_title, rank")
            .gte("created_at", dayStart)
            .lte("created_at", dayEnd)
            .order("created_at", { ascending: true }),
        ]);
        if (rankRes.error) throw rankRes.error;
        setRawGoodsDetailRows(goodsRows);
        setRawMarketRankRows(rankRes.data ?? []);

        const itemMap = new Map();
        goodsRows.forEach((r) => {
          if (r.item_id && !itemMap.has(r.item_id)) {
            itemMap.set(r.item_id, {
              item_id: r.item_id,
              item_name: r.item_name || r.item_id,
            });
          }
        });
        const list = Array.from(itemMap.values());
        setGoodsList(list);
        setDataSource("supabase");
        if (selectedItemId === MARKET_RANK_ITEM_ID) {
          // 保持「店铺排名」选中不变
        } else if (list.length > 0 && !selectedItemId) {
          setSelectedItemId(list[0].item_id);
        } else if (
          selectedItemId &&
          !list.find((g) => g.item_id === selectedItemId)
        ) {
          setSelectedItemId(list[0]?.item_id ?? "");
        }

        const rankChart = marketRankRowsToChartData(rankRes.data ?? []);
        const hasGoods = goodsRows.length > 0;
        const hasRank =
          rankChart.shopNames?.length > 0 &&
          Object.keys(rankChart.byDateSlot || {}).length > 0;
        if (hasGoods || hasRank) {
          const firstItemId = list[0]?.item_id;
          const firstItemRows = firstItemId
            ? goodsRows.filter((r) => r.item_id === firstItemId)
            : [];
          const merged = firstItemId
            ? goodsDetailSlotRowsToChartData(
                firstItemRows,
                list[0]?.item_name || firstItemId,
              )
            : { dates: [] };
          if (merged.dates?.length > 0) {
            const dateToSelect = merged.dates.includes(day)
              ? day
              : merged.dates[merged.dates.length - 1];
            setSelectedDate(dateToSelect);
            setSelectedDatesPick([dateToSelect]);
          } else {
            setSelectedDate(day);
            setSelectedDatesPick([day]);
          }
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
    if (!pickOpen) return;
    const onDoc = (e) => {
      if (pickRef.current && !pickRef.current.contains(e.target))
        setPickOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickOpen]);

  if (view === "dashboard") {
    const isMarketRankView = selectedItemId === MARKET_RANK_ITEM_ID;
    const { dates, byDate } = parsedData || { dates: [], byDate: {} };
    const rankDates = Object.keys(marketRankChart.byDateSlot || {}).sort();
    const datesForSelection = isMarketRankView ? rankDates : dates;
    const firstDate = datesForSelection[0];

    let selectedDates = [];
    if (viewMode === "single") {
      selectedDates = selectedDate
        ? [selectedDate]
        : firstDate
          ? [firstDate]
          : [];
    } else if (viewMode === "multiRange") {
      const base = selectedDate ?? datesForSelection[datesForSelection.length - 1];
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
    const templateLimited = isMarketRankView ? [] : template.slice(0, SERIES_ORDER_LIMIT);

    const togglePickDate = (d) => {
      setSelectedDatesPick((prev) =>
        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
      );
    };

    const handleExportPng = async () => {
      const el =
        enlargedIndex != null ? enlargedRef.current : chartGridRef.current;
      if (!el) return;
      setExporting(true);
      try {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });
        const datesForName = selectedDates;
        const name =
          enlargedIndex != null
            ? `小贝壳作战-详情-${datesForName[0] ?? "export"}.png`
            : `小贝壳作战-${datesForName[0] ?? "export"}${datesForName.length > 1 ? `-${datesForName.length}天` : ""}.png`;
        const link = document.createElement("a");
        link.download = name;
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (err) {
        console.error("导出失败", err);
      } finally {
        setExporting(false);
      }
    };

    /** 分页拉取 goods_detail_slot_log 全量（避免 Supabase 单次 1000 行上限） */
    const fetchAllGoodsDetailRows = async (rangeStartStr, dayEnd) => {
      const rows = [];
      let from = 0;
      while (true) {
        const to = from + SUPABASE_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("goods_detail_slot_log")
          .select(
            "item_id, item_name, slot_ts, item_cart_cnt, search_uv, search_pay_rate, cart_uv, cart_pay_rate",
          )
          .gte("slot_ts", rangeStartStr)
          .lte("slot_ts", dayEnd)
          .order("slot_ts", { ascending: true })
          .range(from, to);
        if (error) throw error;
        const chunk = data ?? [];
        rows.push(...chunk);
        if (chunk.length < SUPABASE_PAGE_SIZE) break;
        from = to + 1;
      }
      return rows;
    };

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

        const allRows = await fetchAllGoodsDetailRows(rangeStartStr, dayEnd);
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
                (x) => x.category === t.category && x.subCategory === t.subCategory,
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
          .filter((m) => m.seriesItem)
          .map((m) => ({
            type: "series",
            key: m.key,
            seriesItem: m.seriesItem,
            seriesItems: null,
            actions: null,
            actionsByDate: null,
          }))
      : seriesForGrid.map((s) => ({ type: "series", ...s }));
    const totalGridCells = seriesGridItems.length;
    const hasNoDataForSelection = totalGridCells === 0;
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
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
              <label className="dashboard-date-label">
                日期
                <input
                  type="date"
                  className="dashboard-date-select"
                  value={selectedDate ?? ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedDate(next);
                    if (dataSource === "supabase" && view === "dashboard") {
                      loadFromSupabase(next);
                    }
                  }}
                />
              </label>
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
                    <label className="dashboard-date-label">
                      日期
                      <select
                        className="dashboard-date-select"
                        value={selectedDate ?? ""}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      >
                        {datesForSelection.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
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
                  <div className="dashboard-pick-wrap" ref={pickRef}>
                    <button
                      type="button"
                      className="dashboard-pick-trigger"
                      onClick={() => setPickOpen((o) => !o)}
                      aria-expanded={pickOpen}
                    >
                      选日期
                      {selectedDatesPick.length > 0
                        ? `（${selectedDatesPick.length} 天）`
                        : ""}
                    </button>
                    {pickOpen && (
                      <div className="dashboard-pick-dropdown">
                        {datesForSelection.map((d) => (
                          <label key={d} className="dashboard-pick-option">
                            <input
                              type="checkbox"
                              checked={selectedDatesPick.includes(d)}
                              onChange={() => togglePickDate(d)}
                            />
                            <span>{d}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {dataSource === "supabase" &&
            (goodsList.length > 0 || rawMarketRankRows.length > 0) && (
            <div className="dashboard-header-center">
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
            </div>
          )}

          <div className="dashboard-header-actions">
            {supabaseLoading ? (
              <span className="dashboard-loading-hint">加载中…</span>
            ) : dataSource === "supabase" &&
              (rawGoodsDetailRows.length > 0 || rawMarketRankRows.length > 0) ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleExportPng}
                  disabled={exporting}
                >
                  {exporting ? "导出中…" : "导出 PNG"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleExportTable}
                  disabled={exporting}
                >
                  {exporting ? "导出中…" : "导出表格"}
                </button>
              </>
            ) : null}
            {error && <span className="dashboard-header-error">{error}</span>}
          </div>
        </header>

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
              当前日期暂无数据，请切换日期后查看
            </p>
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
