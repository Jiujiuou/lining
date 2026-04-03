const FIELD_MAP = [
  ['item_desc_match_score', '7069'],
  ['sycm_pv', '7070'],
  ['seller_service_score', '7071'],
  ['sycm_uv', '7072'],
  ['seller_shipping_score', '7073'],
  ['sycm_pay_buyers', '7074'],
  ['refund_finish_duration', '7075'],
  ['sycm_pay_items', '7076'],
  ['refund_finish_rate', '7077'],
  ['sycm_pay_amount', '7078'],
  ['dispute_refund_rate', '7079'],
  ['sycm_aov', '7080'],
  ['taobao_cps_spend_yuan', '7081'],
  ['sycm_pay_cvr', '7082'],
  ['ztc_charge_yuan', '7083'],
  ['sycm_old_visitor_ratio', '7084'],
  ['ztc_cvr', '7085'],
  ['sycm_avg_stay_sec', '7086'],
  ['ztc_ppc', '7087'],
  ['sycm_avg_pv_depth', '7088'],
  ['ztc_roi', '7089'],
  ['sycm_bounce_rate', '7090'],
  ['ylmf_charge_yuan', '11452'],
  ['ylmf_cvr', '11453'],
  ['ylmf_ppc', '11454'],
  ['ylmf_roi', '11455'],
  ['site_wide_charge_yuan', '15851'],
  ['site_wide_roi', '15852'],
  ['content_promo_charge_yuan', '31083'],
  ['content_promo_roi', '31084'],
];

const DEFAULT_ZERO_FIELD_IDS = ['13386', '15095', '15096', '15097'];

function setNativeInputOrTextareaValue(element, value) {
  let descriptor = null;
  if (element instanceof HTMLTextAreaElement) {
    descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  } else if (element instanceof HTMLInputElement) {
    descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  }

  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
    return;
  }

  element.value = value;
}

function dispatchInputAndChange(element, value) {
  const isEmpty = value === '';
  const inputType = isEmpty ? 'deleteContentBackward' : 'insertFromPaste';

  try {
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType,
        data: isEmpty ? null : value,
      }),
    );
  } catch {
    try {
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {
      return;
    }
  }

  try {
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } catch {
    return;
  }
}

function dispatchOnFieldMarkCell(element) {
  const cell = element.closest && element.closest('[data-fieldmark]');
  if (!cell) return;

  try {
    cell.dispatchEvent(
      new InputEvent('input', { bubbles: true, cancelable: true, composed: true }),
    );
  } catch {
    try {
      cell.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {
      return;
    }
  }

  try {
    cell.dispatchEvent(new Event('change', { bubbles: true }));
  } catch {
    return;
  }
}

function getFieldControlElement(fieldIdSuffix) {
  const id = `field${fieldIdSuffix}`;
  const cell = document.querySelector(`[data-fieldmark="${id}"]`);
  if (cell) {
    const inner = cell.querySelector('input.wf-input, input, textarea');
    if (inner) return inner;
  }

  const elementById = document.getElementById(id);
  if (elementById && (elementById.tagName === 'INPUT' || elementById.tagName === 'TEXTAREA')) {
    return elementById;
  }

  return null;
}

function setFieldValue(fieldIdSuffix, rawValue) {
  const id = `field${fieldIdSuffix}`;
  const element = getFieldControlElement(fieldIdSuffix);
  if (!element) return false;

  const value = rawValue == null ? '' : String(rawValue);
  const tag = element.tagName && element.tagName.toLowerCase();

  if (tag === 'input' || tag === 'textarea') {
    setNativeInputOrTextareaValue(element, value);
  } else {
    element.value = value;
  }

  dispatchInputAndChange(element, value);
  dispatchOnFieldMarkCell(element);

  const span = document.getElementById(`${id}span`);
  if (span && element.type === 'hidden') {
    span.textContent = value;
  }

  return true;
}

function fillReportPageFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return { ok: false, filled: 0 };

  let filled = 0;
  FIELD_MAP.forEach(([key, fieldId]) => {
    const raw = snapshot[key];
    const hasValue = raw !== undefined && raw !== null && String(raw).replace(/\s/g, '') !== '';

    if (!hasValue) return;
    if (setFieldValue(fieldId, raw)) filled += 1;
  });

  DEFAULT_ZERO_FIELD_IDS.forEach((fieldId) => {
    if (setFieldValue(fieldId, '0')) filled += 1;
  });

  return { ok: true, filled };
}

/**
 * 页面主世界（MAIN）：与 OA 页内脚本同一 JS 环境，负责执行填充并回传结果。
 * 隔离世界通过 window.postMessage 投递快照。
 */
{
  var FILL = "SR_FILL_SNAPSHOT";
  var DONE = "SR_FILL_SNAPSHOT_DONE";

  window.addEventListener("message", function (ev) {
    if (ev.source !== window || !ev.data || ev.data.type !== FILL) return;
    if (typeof fillReportPageFromSnapshot !== "function") {
      window.postMessage(
        { type: DONE, ok: false, error: "report-page-fill 未注入", filled: 0 },
        "*"
      );
      return;
    }
    var snap = ev.data.snap;
    var ret = fillReportPageFromSnapshot(snap);
    window.postMessage(
      {
        type: DONE,
        ok: !!ret.ok,
        filled: ret.filled,
        reportAt: snap && snap.report_at ? String(snap.report_at) : ""
      },
      "*"
    );
  });
}
