export function buildMetaText(snapshot) {
  const keywordText =
    snapshot && snapshot.keyWord != null && String(snapshot.keyWord).trim() !== ''
      ? `搜索词：${String(snapshot.keyWord)}`
      : '搜索词：（空，未带 keyWord）';
  const updateText =
    snapshot && snapshot.updateTime ? `接口更新：${snapshot.updateTime}` : '';
  return [keywordText, updateText].filter(Boolean).join(' · ');
}

