import { useState, useEffect, useRef } from 'react';

/**
 * 数据点备注弹窗，风格与看板一致
 * @param {{ open: boolean, chartKey: string, pointDate: string, pointSlot: string, initialNote: string, onClose: () => void, onSave: (note: string) => Promise<void> }} props
 */
export default function NoteModal({ open, chartKey, pointDate, pointSlot, initialNote, onClose, onSave }) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (open) {
      setNote(initialNote ?? '');
      setError(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, initialNote]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(note);
      onClose();
    } catch (err) {
      setError(err?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const slotLabel = pointSlot ? ` ${pointSlot}` : '';
  const title = `添加备注 · ${chartKey}${pointDate ? ` ${pointDate}${slotLabel}` : ''}`;

  return (
    <div
      className="note-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="note-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="note-modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 id="note-modal-title" className="note-modal-title">
          {title}
        </h2>
        <form onSubmit={handleSubmit}>
          <label className="note-modal-label" htmlFor="note-modal-textarea">
            备注内容
          </label>
          <textarea
            id="note-modal-textarea"
            ref={textareaRef}
            className="note-modal-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="输入该数据点的备注…"
            rows={4}
            disabled={saving}
            aria-describedby={error ? 'note-modal-error' : undefined}
          />
          {error && (
            <p id="note-modal-error" className="note-modal-error" role="alert">
              {error}
            </p>
          )}
          <div className="note-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
