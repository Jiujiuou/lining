/**
 * 内容脚本占位：复制本插件后在此实现采集/注入逻辑。
 */
(function () {
  var logger = typeof __EXT_TEMPLATE_LOGGER__ !== "undefined" ? __EXT_TEMPLATE_LOGGER__ : null;
  var PREFIX =
    typeof __EXT_TEMPLATE_DEFAULTS__ !== "undefined" && __EXT_TEMPLATE_DEFAULTS__.PREFIX
      ? __EXT_TEMPLATE_DEFAULTS__.PREFIX
      : "";
  if (logger) {
    logger.log(PREFIX + " 内容脚本已注入。请修改 manifest 匹配规则与本文件逻辑。");
  }
})();
