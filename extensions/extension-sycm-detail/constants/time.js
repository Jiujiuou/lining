(function (global) {
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }
  function getEast8TimeStr() {
    var d = new Date();
    var utc = d.getTime() + d.getTimezoneOffset() * 60000;
    var east8 = new Date(utc + 8 * 60 * 60 * 1000);
    return (
      east8.getFullYear() +
      "-" +
      pad(east8.getMonth() + 1) +
      "-" +
      pad(east8.getDate()) +
      ":" +
      pad(east8.getHours()) +
      ":" +
      pad(east8.getMinutes()) +
      ":" +
      pad(east8.getSeconds())
    );
  }
  function formatMetric(n) {
    if (n == null) return "—";
    var v = Number(n);
    if (v !== v) return String(n);
    return String(v);
  }
  function formatRate(n) {
    if (n == null) return "—";
    var v = Number(n);
    if (v !== v) return String(n);
    return (Math.round(v * 10000) / 100).toFixed(2) + "%";
  }
  (typeof globalThis !== "undefined" ? globalThis : global).__SYCM_TIME_MAIN__ =
    {
      pad: pad,
      getEast8TimeStr: getEast8TimeStr,
      formatMetric: formatMetric,
      formatRate: formatRate,
    };
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : self,
);
