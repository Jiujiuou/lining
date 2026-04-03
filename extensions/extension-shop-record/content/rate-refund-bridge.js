import { PREFIX, SHOP_RECORD_DEFAULTS } from '../defaults.js';
import { createPrefixedRuntimeLogger } from '../../shared/chrome/ext-log.js';

{
  var APPEND_LOG_TYPE = SHOP_RECORD_DEFAULTS.RUNTIME.CONTENT_APPEND_LOG_MESSAGE;
  var MSG = 'shop-record-refund-jsonp';
  var extLog = createPrefixedRuntimeLogger(APPEND_LOG_TYPE, PREFIX);

  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.source !== MSG) return;

    var payload = d.payload || {};
    var disputeRefundRate = payload.disputeRefundRate;
    var refundProFinishTime = payload.refundProFinishTime;
    var refundFinishRate = payload.refundFinishRate;

    extLog(
      'refund metrics: dispute_refund_rate=' +
        String(disputeRefundRate != null ? disputeRefundRate : '-') +
        ', refund_finish_duration=' +
        String(refundProFinishTime != null ? refundProFinishTime : '-') +
        ', refund_finish_rate=' +
        String(refundFinishRate != null ? refundFinishRate : '-'),
    );

    try {
      window.dispatchEvent(
        new CustomEvent('shop-record-refund-data', {
          detail: {
            disputeRefundRate: disputeRefundRate,
            refundProFinishTime: refundProFinishTime,
            refundFinishRate: refundFinishRate,
          },
        }),
      );
    } catch {
      /* ignore */
    }
  });
}
