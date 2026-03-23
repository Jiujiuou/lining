import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { HiChevronDown } from "react-icons/hi2";
import "./GoodsSelect.css";

/**
 * 商品选择：触发器 + 全屏遮罩大面板（宫格 + 搜索、长标题换行）
 * 键盘：Escape 关闭；方向键在宫格内移动；Enter 选中
 */
export default function GoodsSelect({
  options = [],
  value,
  onChange,
  label = "商品",
  placeholder = "请选择商品",
  id = "goods-select",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const sheetRef = useRef(null);
  const [gridColumnCount, setGridColumnCount] = useState(1);

  const selected = options.find((o) => o.item_id === value);
  const displayText = selected
    ? selected.item_name || selected.item_id
    : placeholder;

  const filteredOptions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const name = String(o.item_name ?? "").toLowerCase();
      const idStr = String(o.item_id ?? "");
      return name.includes(q) || idStr.includes(q);
    });
  }, [options, filterQuery]);

  const close = useCallback(() => {
    setOpen(false);
    setFilterQuery("");
    setFocusedIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) {
      setFocusedIndex(-1);
      return;
    }
    if (filteredOptions.length === 0) {
      setFocusedIndex(-1);
      return;
    }
    const idx = filteredOptions.findIndex((o) => o.item_id === value);
    setFocusedIndex(idx >= 0 ? idx : 0);
  }, [open, filteredOptions, value]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${focusedIndex}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open, focusedIndex]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el || filteredOptions.length === 0) return;
    const updateCols = () => {
      const raw = getComputedStyle(el).gridTemplateColumns || "";
      const parts = raw.trim().split(/\s+/).filter(Boolean);
      const n = parts.length > 0 ? parts.length : 1;
      setGridColumnCount(Math.max(1, n));
    };
    updateCols();
    const ro = new ResizeObserver(() => updateCols());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, filteredOptions.length]);

  const handleTriggerKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
    }
  };

  const handleOverlayKeyDown = (e) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
      return;
    }
    const len = filteredOptions.length;
    const cols = gridColumnCount;
    if (e.target === searchRef.current) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => {
        if (i < 0 || len === 0) return 0;
        const next = i + cols;
        return next < len ? next : i;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => {
        if (i < 0 || len === 0) return 0;
        const next = i - cols;
        return next >= 0 ? next : i;
      });
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocusedIndex((i) =>
        i >= 0 && i < len - 1 ? i + 1 : i,
      );
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocusedIndex((i) => (i > 0 ? i - 1 : i));
      return;
    }
    if (e.key === "Enter") {
      if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
        e.preventDefault();
        onChange(filteredOptions[focusedIndex].item_id);
        close();
        triggerRef.current?.focus();
      }
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown" && filteredOptions.length > 0) {
      e.preventDefault();
      setFocusedIndex(0);
      requestAnimationFrame(() => listRef.current?.focus());
    }
  };

  const sheet = open ? (
    <div
      className="goods-select-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={id + "-sheet-title"}
      onKeyDown={handleOverlayKeyDown}
    >
      <button
        type="button"
        className="goods-select-overlay__backdrop"
        aria-label="关闭"
        onClick={() => {
          close();
          triggerRef.current?.focus();
        }}
      />
      <div
        ref={sheetRef}
        className="goods-select-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="goods-select-sheet__head">
          <h2 id={id + "-sheet-title"} className="goods-select-sheet__title">
            {label ? `选择${label}` : "选择商品"}
          </h2>
          <button
            type="button"
            className="goods-select-sheet__close"
            onClick={() => {
              close();
              triggerRef.current?.focus();
            }}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="goods-select-sheet__search-wrap">
          <input
            ref={searchRef}
            type="search"
            className="goods-select-sheet__search"
            placeholder="搜索商品名称或 ID…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="筛选商品"
          />
          <span className="goods-select-sheet__count">
            {filteredOptions.length} / {options.length}
          </span>
        </div>
        <ul
          ref={listRef}
          className="goods-select-sheet__grid"
          role="listbox"
          aria-labelledby={id + "-sheet-title"}
          tabIndex={-1}
        >
          {filteredOptions.length === 0 ? (
            <li className="goods-select-sheet__empty">无匹配项，请调整关键词</li>
          ) : (
            filteredOptions.map((opt, idx) => (
              <li
                key={opt.item_id}
                data-index={idx}
                role="option"
                tabIndex={-1}
                aria-selected={opt.item_id === value}
                className={
                  "goods-select-sheet__tile" +
                  (opt.item_id === value
                    ? " goods-select-sheet__tile--selected"
                    : "") +
                  (idx === focusedIndex ? " goods-select-sheet__tile--focused" : "")
                }
                onClick={() => {
                  onChange(opt.item_id);
                  close();
                  triggerRef.current?.focus();
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <span className="goods-select-sheet__tile-head">
                  <span
                    className="goods-select-sheet__tile-text"
                    title={opt.item_name || opt.item_id}
                  >
                    {opt.item_name || opt.item_id}
                  </span>
                  {opt.item_id === value ? (
                    <span className="goods-select-sheet__tile-check" aria-hidden>
                      ✓
                    </span>
                  ) : null}
                </span>
                <span className="goods-select-sheet__tile-id" title={String(opt.item_id)}>
                  ID {opt.item_id}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  ) : null;

  return (
    <div className={"goods-select " + (className || "").trim()}>
      {label && (
        <span className="goods-select__label" id={id + "-label"}>
          {label}
        </span>
      )}
      <div className="goods-select__trigger-wrap">
        <button
          ref={triggerRef}
          type="button"
          className="goods-select__trigger"
          onClick={() => {
            if (open) close();
            else setOpen(true);
          }}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={id + "-label"}
          aria-label={label || "选择商品"}
          title={displayText}
        >
          <span className="goods-select__trigger-text">{displayText}</span>
          <HiChevronDown className="goods-select__trigger-icon" aria-hidden />
        </button>
      </div>
      {typeof document !== "undefined" && sheet
        ? createPortal(sheet, document.body)
        : null}
    </div>
  );
}
