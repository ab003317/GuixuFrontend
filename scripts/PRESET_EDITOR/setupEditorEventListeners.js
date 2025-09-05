//这个函数负责监听预设编辑器中各种元素的交互事件，并调用相应的处理函数。
//在页面加载完成后，为编辑器内的所有可交互元素（按钮、输入框、选项卡等）一次性绑定所有需要的事件处理函数（点击、输入、变化等）。

function setupEditorEventListeners() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  wbModal.addEventListener('click', e => {
    if (e.target.id === 'wb-modal-save-btn') saveWorldBookData();
    if (e.target.id === 'wb-modal-cancel-btn') hideWorldBookModal();
    if (e.target.id === 'wb-strategy-toggle-btn') {
      const current = e.target.dataset.strategy;
      setStrategyButtonState(current === 'constant' ? 'selective' : 'constant');
    }
  });
  document.getElementById('wb-position-type').addEventListener('change', e => {
    document.getElementById('wb-depth-settings').style.display = e.target.value === 'at_depth' ? 'grid' : 'none';
  });

  // New listeners for search and refresh
  const searchInput = document.getElementById('wb-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderWorldBookEditor();
    });
  }

  const refreshBtn = document.getElementById('wb-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadEditorData();
      showSaveStatus('数据已刷新', true);
    });
  }

  editorContainer.addEventListener('click', async e => {
    const target = e.target;
    const tabButton = target.closest('.tab-button');
    if (tabButton) {
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      tabButton.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(pane => (pane.style.display = 'none'));
      document.getElementById(tabButton.dataset.tab + '-tab').style.display = 'block';
      return;
    }

    if (target.id === 'add-new-talent-btn') return showModal('talent');
    if (target.id === 'add-new-background-btn') return showModal('background');
    const editTalentBtn = target.closest('.edit-talent-btn');
    if (editTalentBtn) return showModal('talent', editTalentBtn.dataset.uid);

    const deleteTalentBtn = target.closest('.delete-talent-btn');
    if (deleteTalentBtn) {
      const uid = deleteTalentBtn.dataset.uid;
      const name = deleteTalentBtn.dataset.name;
      if (uid && (await guiXuConfirm(`你确定要删除天赋 "${name}" 吗?`, '删除确认'))) {
        if (await WorldBookManager.deleteEntryByUid(uid)) {
          await guiXuAlert(`天赋 "${name}" 已删除。`);
          await loadEditorData();
        } else {
          await guiXuAlert('删除失败', '错误');
        }
      }
      return;
    }

    const editBgBtn = target.closest('.edit-background-btn');
    if (editBgBtn) return showModal('background', editBgBtn.dataset.uid);

    const deleteBgBtn = target.closest('.delete-background-btn');
    if (deleteBgBtn) {
      const uid = deleteBgBtn.dataset.uid;
      const name = deleteBgBtn.dataset.name;
      if (uid && (await guiXuConfirm(`你确定要删除背景 "${name}" 吗?`, '删除确认'))) {
        if (await WorldBookManager.deleteEntryByUid(uid)) {
          await guiXuAlert(`背景 "${name}" 已删除。`);
          await loadEditorData();
        } else {
          await guiXuAlert('删除失败', '错误');
        }
      }
      return;
    }

    const wbFilterBtn = target.closest('.wb-filter-btn');
    if (wbFilterBtn) {
      document.querySelectorAll('.wb-filter-btn').forEach(btn => btn.classList.remove('active'));
      wbFilterBtn.classList.add('active');
      currentWbFilter = wbFilterBtn.dataset.filter;
      renderWorldBookEditor();
      return;
    }

    if (target.id === 'add-new-worldbook-btn') return showWorldBookModal();
    if (target.id === 'add-preset-worldbook-btn') return promptPresetSelectionForWB();

    const wbItem = target.closest('.editor-item[data-uid]');
    if (wbItem) {
      const uid = wbItem.dataset.uid;
      const entry = editorData.worldbookEntries.find(e => String(e.uid) === String(uid));

      if (!entry) {
        console.error(`[归墟编辑器] 错误：在数据中未找到 UID 为 ${uid} 的世界书条目。可能是数据不同步导致的。`);
        await guiXuAlert('操作失败：找不到对应的世界书条目，数据可能已过期，请尝试点击“刷新数据”按钮。', '错误');
        return;
      }

      if (target.closest('.edit-wb-btn')) return showWorldBookModal(entry);

      if (target.closest('.delete-wb-btn')) {
        if (await guiXuConfirm(`确定要删除世界书条目 "${entry.name}" 吗？`)) {
          await WorldBookManager.deleteEntryByUid(entry.uid);
          await loadEditorData();
        }
        return;
      }

      if (target.closest('.toggle-wb-btn')) {
        await TavernHelper.updateWorldbookWith(WorldBookManager.LOREBOOK_NAME, worldbook => {
          const entryToUpdate = worldbook.find(e => String(e.uid) === String(uid));
          if (entryToUpdate) entryToUpdate.enabled = !entryToUpdate.enabled;
          return worldbook;
        });
        await loadEditorData();
        return;
      }
    }

    const presetItem = target.closest('.preset-list-item');
    if (presetItem) {
      editPreset(presetItem.dataset.presetName);
      if (window.innerWidth <= 768) {
        document.querySelector('.preset-editor-layout').classList.add('mobile-details-view');
      }
      return;
    }

    if (target.id === 'add-new-preset-btn') {
      const newName = await guiXuPrompt('输入新预设的名称:', '', '新预设');
      if (newName && newName.trim() !== '') {
        if (editorData.presets.some(p => p.name === newName.trim())) {
          await guiXuAlert('该名称的预设已存在。', '错误');
          return;
        }
        const newSeries = await guiXuPrompt('输入系列名称 (可留空):', '', '系列');
        const newPreset = {
          id: newName.trim(),
          name: newName.trim(),
          author: '玩家',
          points: 40,
          attributes: {},
          requiredTalents: [],
          optionalTalents: [],
          series: (newSeries || '').trim(),
          description: '',
          enabled: false,
        };
        await WorldBookManager.savePreset(newPreset);
        await loadEditorData();
        editPreset(newPreset.name);
      }
      return;
    }

    if (target.id === 'export-preset-btn') {
      if (!currentEditingPreset) return await guiXuAlert('请先从列表中选择一个预设。');
      exportSeriesPackage(currentEditingPreset);
      return;
    }

    const presetDetailsPanel = target.closest('#preset-details-panel');
    if (presetDetailsPanel) {
      if (target.id === 'preset-back-to-list-btn') {
        document.querySelector('.preset-editor-layout').classList.remove('mobile-details-view');
        currentEditingPreset = null;
        renderPresetEditor();
        return;
      }
      const toggleBtn = target.closest('#toggle-preset-details-btn');
      if (toggleBtn) {
        const collapsibleArea = document.getElementById('preset-details-collapsible-area');
        const isCollapsed = collapsibleArea.style.display === 'none';
        collapsibleArea.style.display = isCollapsed ? 'block' : 'none';
        toggleBtn.classList.toggle('collapsed', !isCollapsed);
        return;
      }
      const presetTabBtn = target.closest('.preset-tab-btn');
      if (presetTabBtn) return switchPresetTab(presetTabBtn.dataset.tab);
      const attrBtn = target.closest('.attribute-card .value-btn');
      if (attrBtn && !attrBtn.disabled) {
        const attrId = attrBtn.dataset.attribute;
        if (!currentEditingPreset) return;
        if (!currentEditingPreset.attributes) currentEditingPreset.attributes = {};
        let currentValue = currentEditingPreset.attributes[attrId] || 0;
        if (attrBtn.classList.contains('increase-btn')) currentValue++;
        else if (attrBtn.classList.contains('decrease-btn') && currentValue > 0) currentValue--;
        currentEditingPreset.attributes[attrId] = currentValue;
        renderPresetAttributes(currentEditingPreset.attributes);
        debouncedSave();
        return;
      }
      const availableTalentItem = target.closest('#available-talents-list .editor-item');
      if (availableTalentItem) {
        if (availableTalentItem.classList.contains('disabled')) return await guiXuAlert(availableTalentItem.title);
        addTalentToPreset(availableTalentItem.dataset.talentName);
        debouncedSave();
        return;
      }
      const talentActionBtn = target.closest('.preset-talent-action-btn');
      if (talentActionBtn) {
        const talentName = talentActionBtn.closest('.selected-talent-item').dataset.talentName;
        const action = talentActionBtn.dataset.action;
        if (action === 'setRequired') setTalentStateInPreset(talentName, 'required');
        else if (action === 'setOptional') setTalentStateInPreset(talentName, 'optional');
        else if (action === 'remove') removeTalentFromPreset(talentName);
        debouncedSave();
        return;
      }
      const seriesItem = target.closest('.series-item');
      if (seriesItem) {
        const details = seriesItem.querySelector('.item-description-details');
        if (details) details.style.display = details.style.display === 'block' ? 'none' : 'block';
        return;
      }
      if (target.id === 'export-current-preset-btn') return exportSeriesPackage(currentEditingPreset);
      if (target.id === 'duplicate-current-preset-btn') return duplicateCurrentPreset();
      if (target.id === 'delete-current-preset-btn') return deleteCurrentPreset();
    }

    if (target.id === 'batch-import-talents-btn' || target.id === 'batch-import-backgrounds-btn') {
      const type = target.id === 'batch-import-talents-btn' ? 'talent' : 'background';
      showBatchImportModal(type);
    }
  });

  editorContainer.addEventListener('change', e => {
    if (e.target.id === 'preset-worldbook-enabled-switch' && currentEditingPreset) {
      currentEditingPreset.enabled = e.target.checked;
      debouncedSave();
    }
  });
  editorContainer.addEventListener('input', e => {
    if (e.target.closest('#preset-name, #preset-author, #preset-series, #preset-points')) {
      debouncedSave();
    }
  });
}
