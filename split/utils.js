
// --- 工具函数 ---
// 本文件包含一些通用工具函数, 例如防抖动保存.
//
// 功能函数:
// - debouncedSave(): 对保存操作进行防抖处理, 避免在短时间内频繁触发保存.
//
// 依赖:
// - saveCurrentPreset(): 实际执行保存的函数 (应在主脚本中定义).
// - showSaveStatus(): 用于显示保存状态的UI函数 (from ui.js).
//
// 加载顺序:
// - 本文件应在 ui.js 之后, 在调用 debouncedSave 的主程序之前加载.

let saveDebounceTimer = null;

function debouncedSave() {
  if (!currentEditingPreset) return;
  clearTimeout(saveDebounceTimer);
  showSaveStatus('正在自动保存...');
  saveDebounceTimer = setTimeout(async () => {
    try {
      await saveCurrentPreset();
      showSaveStatus('已保存', true);
    } catch (e) {
      showSaveStatus(`保存失败: ${e.message}`, false, true);
    }
  }, 1500);
}
