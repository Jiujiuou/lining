import { useState, useRef, useEffect } from 'react';
import { HiChevronDown } from 'react-icons/hi2';
import './GoodsSelect.css';

/**
 * 商品下拉选择器（自定义组件）
 * - 选项单行展示、过长省略，避免换行
 * - 触控目标 ≥44px（UI/UX Pro Max）
 * - 支持键盘：Escape 关闭，ArrowDown/Up 移动，Enter 选中
 * - 无障碍：aria-expanded、listbox、option、aria-selected
 */
export default function GoodsSelect({ options = [], value, onChange, label = '商品', placeholder = '请选择商品', id = 'goods-select', className = '' }) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.item_id === value);
  const displayText = selected ? (selected.item_name || selected.item_id) : placeholder;

  useEffect(() => {
    if (!open) {
      setFocusedIndex(-1);
      return;
    }
    const idx = options.findIndex((o) => o.item_id === value);
    setFocusedIndex(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && listRef.current && !listRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    listRef.current?.querySelector('[data-index="' + focusedIndex + '"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, focusedIndex]);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => (i < options.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => (i > 0 ? i - 1 : 0));
      return;
    }
    if (e.key === 'Enter' && focusedIndex >= 0 && options[focusedIndex]) {
      e.preventDefault();
      onChange(options[focusedIndex].item_id);
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div className={'goods-select ' + (className || '').trim()}>
      {label && (
        <span className="goods-select__label" id={id + '-label'}>
          {label}
        </span>
      )}
      <div className="goods-select__trigger-wrap">
        <button
          ref={triggerRef}
          type="button"
          className="goods-select__trigger"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={id + '-label'}
          aria-label={label || '选择商品'}
          title={displayText}
        >
          <span className="goods-select__trigger-text">{displayText}</span>
          <HiChevronDown className="goods-select__trigger-icon" aria-hidden />
        </button>
        {open && (
          <ul
            ref={listRef}
            className="goods-select__list"
            role="listbox"
            aria-labelledby={id + '-label'}
            tabIndex={-1}
          >
            {options.map((opt, idx) => (
              <li
                key={opt.item_id}
                data-index={idx}
                role="option"
                aria-selected={opt.item_id === value}
                className={'goods-select__option' + (opt.item_id === value ? ' goods-select__option--selected' : '') + (idx === focusedIndex ? ' goods-select__option--focused' : '')}
                onClick={() => {
                  onChange(opt.item_id);
                  setOpen(false);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <span className="goods-select__option-text" title={opt.item_name || opt.item_id}>
                  {opt.item_name || opt.item_id}
                </span>
                {opt.item_id === value && (
                  <span className="goods-select__option-check" aria-hidden>✓</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
