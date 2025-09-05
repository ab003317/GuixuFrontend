//---------------------------------------------------设置统一索引控制。----------------------------------------------

function setupUnifiedIndexControls() {
  const unifiedIndexInput = document.getElementById('unified-index-input');
  const autoToggleCheckbox = document.getElementById('auto-toggle-lorebook-checkbox');
  const incrementBtn = document.getElementById('index-increment-btn');
  const decrementBtn = document.getElementById('index-decrement-btn');

  if (!unifiedIndexInput || !autoToggleCheckbox || !incrementBtn || !decrementBtn) return;

  const state = { unifiedIndex: 1, isAutoToggleEnabled: false };

  function updateStepperButtons() {
    const currentValue = parseInt(unifiedIndexInput.value, 10);
    decrementBtn.disabled = currentValue <= 1;
  }

  async function updateAutoToggledEntries(andDisableAll = false) {
    if (typeof TavernHelper === 'undefined' || typeof TavernHelper.updateWorldbookWith === 'undefined') return;
    const bookName = LOREBOOK_NAME;
    const index = state.unifiedIndex;

    const entryTypes = ['本世历程', '往世涟漪', '分段正文', '小总结', '大总结'];

    try {
      await TavernHelper.updateWorldbookWith(bookName, allEntries => {
        const entriesToCreate = [];

        for (const type of entryTypes) {
          const currentKey = index > 1 ? `${type}(${index})` : type;
          if (!allEntries.find(e => e.name === currentKey)) {
            const base = allEntries.find(e => e.name === type);
            if (base) {
              entriesToCreate.push({
                ...base,
                uid: undefined,
                name: currentKey,
                content: '',
                strategy: { ...base.strategy, keys: [...(base.strategy?.keys || []), currentKey] },
                enabled: true,
              });
            }
          }
        }
        allEntries.push(...entriesToCreate);

        for (const entry of allEntries) {
          const entryBaseType = entryTypes.find(type => entry.name.startsWith(type));
          if (!entryBaseType) continue;

          const currentKeyForType = index > 1 ? `${entryBaseType}(${index})` : entryBaseType;
          const isTarget = entry.name === currentKeyForType;
          const shouldBeEnabled = isTarget && !andDisableAll && state.isAutoToggleEnabled;

          if (entry.enabled !== shouldBeEnabled) {
            entry.enabled = shouldBeEnabled;
          }
        }
        return allEntries;
      });
    } catch (error) {
      console.error('[归墟] 更新世界书条目状态时出错:', error);
    }
  }

  function saveState() {
    try {
      localStorage.setItem('guixu_unified_index', state.unifiedIndex);
      localStorage.setItem('guixu_auto_toggle_enabled', state.isAutoToggleEnabled);
    } catch (e) {
      console.error('保存状态失败:', e);
    }
  }

  function loadState() {
    try {
      state.unifiedIndex = parseInt(localStorage.getItem('guixu_unified_index'), 10) || 1;
      unifiedIndexInput.value = state.unifiedIndex;
      state.isAutoToggleEnabled = localStorage.getItem('guixu_auto_toggle_enabled') === 'true';
      autoToggleCheckbox.checked = state.isAutoToggleEnabled;
      updateStepperButtons();
    } catch (e) {
      console.error('加载状态失败:', e);
    }
  }

  loadState();
  unifiedIndexInput.addEventListener('change', e => {
    const newIndex = parseInt(e.target.value, 10);
    if (!isNaN(newIndex) && newIndex > 0) {
      state.unifiedIndex = newIndex;
      saveState();
      if (state.isAutoToggleEnabled) updateAutoToggledEntries();
    } else {
      e.target.value = state.unifiedIndex;
    }
    updateStepperButtons();
  });
  autoToggleCheckbox.addEventListener('change', e => {
    state.isAutoToggleEnabled = e.target.checked;
    saveState();
    updateAutoToggledEntries(!state.isAutoToggleEnabled);
  });

  incrementBtn.addEventListener('click', () => {
    const currentValue = parseInt(unifiedIndexInput.value, 10);
    unifiedIndexInput.value = isNaN(currentValue) ? 1 : currentValue + 1;
    unifiedIndexInput.dispatchEvent(new Event('change'));
  });

  decrementBtn.addEventListener('click', () => {
    const currentValue = parseInt(unifiedIndexInput.value, 10);
    if (!isNaN(currentValue) && currentValue > 1) {
      unifiedIndexInput.value = currentValue - 1;
      unifiedIndexInput.dispatchEvent(new Event('change'));
    }
  });
}
