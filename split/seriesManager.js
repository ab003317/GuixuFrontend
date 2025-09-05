
// --- 系列数据管理器 ---
// 本文件提供一个SeriesManager对象, 用于根据"系列"对天赋、背景和预设进行筛选和组织.
//
// 功能函数:
// - SeriesManager.getSeriesData(seriesName): 获取指定系列名称下的所有天赋、背景和预设.
// - SeriesManager.getAllSeries(): 获取当前所有数据中存在的全部系列名称.
//
// 依赖:
// - editorData: 包含所有天赋、背景、预设的全局数据对象 (应在主脚本中定义).
//
// 加载顺序:
// - 本文件应在 editorData 数据加载并初始化之后, 在任何调用系列管理功能的UI或逻辑之前加载.

const SeriesManager = {
  getSeriesData(seriesName) {
    if (!seriesName || !seriesName.trim()) {
      return { talents: [], backgrounds: [], presets: [] };
    }
    const trimmedSeriesName = seriesName.trim();
    const seriesTalents = editorData.talents.filter(t => String(t.series || '').trim() === trimmedSeriesName);
    const seriesBackgrounds = editorData.backgrounds.filter(b => String(b.series || '').trim() === trimmedSeriesName);
    const seriesPresets = editorData.presets.filter(p => String(p.series || '').trim() === trimmedSeriesName);

    return {
      talents: seriesTalents,
      backgrounds: seriesBackgrounds,
      presets: seriesPresets,
    };
  },

  getAllSeries() {
    const series = new Set();
    editorData.talents.forEach(t => {
      if (t.series) series.add(String(t.series).trim());
    });
    editorData.backgrounds.forEach(b => {
      if (b.series) series.add(String(b.series).trim());
    });
    editorData.presets.forEach(p => {
      if (p.series) series.add(String(p.series).trim());
    });
    return Array.from(series)
      .filter(s => s)
      .sort();
  },
};
