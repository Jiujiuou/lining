const ONEBP_SEARCH_BASE =
  'https://one.alimama.com/index.html#!/manage/search?mx_bizCode=onebpSearch&bizCode=onebpSearch&tab=campaign';
const ONEBP_DISPLAY_BASE =
  'https://one.alimama.com/index.html#!/manage/display?mx_bizCode=onebpDisplay&bizCode=onebpDisplay&tab=campaign';
const ONEBP_SITE_BASE =
  'https://one.alimama.com/index.html#!/manage/onesite?mx_bizCode=onebpSite&bizCode=onebpSite&tab=campaign';
const ONEBP_SHORTVIDEO_BASE =
  'https://one.alimama.com/index.html#!/manage/content?mx_bizCode=onebpShortVideo&bizCode=onebpShortVideo&tab=campaign';

export function yesterdayYmd() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function buildOnebpSearchUrl() {
  const ymd = yesterdayYmd();
  return `${ONEBP_SEARCH_BASE}&startTime=${ymd}&endTime=${ymd}`;
}

export function buildOnebpDisplayUrl() {
  const ymd = yesterdayYmd();
  return `${ONEBP_DISPLAY_BASE}&startTime=${ymd}&endTime=${ymd}`;
}

export function buildOnebpSiteUrl() {
  const ymd = yesterdayYmd();
  return `${ONEBP_SITE_BASE}&startTime=${ymd}&endTime=${ymd}&effectEqual=15&unifyType=last_click_by_effect_time`;
}

export function buildOnebpShortVideoUrl() {
  const ymd = yesterdayYmd();
  return `${ONEBP_SHORTVIDEO_BASE}&startTime=${ymd}&endTime=${ymd}&unifyType=video_kuan`;
}

export function getAllPageUrls({
  shopRateUrl,
  alimamaUrl,
  sycmMySpaceUrl,
  reportSubmitPageUrl,
}) {
  return [
    shopRateUrl,
    alimamaUrl,
    buildOnebpSearchUrl(),
    buildOnebpDisplayUrl(),
    buildOnebpSiteUrl(),
    buildOnebpShortVideoUrl(),
    sycmMySpaceUrl,
    reportSubmitPageUrl,
  ];
}

