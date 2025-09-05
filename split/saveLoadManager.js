// --- 存档与读档管理器 ---
// 本文件负责处理游戏的多存档、读档、导入和导出功能.
//
// 功能函数:
// - showSaveLoadManager(): 显示存档/读档管理器模态框.
// - loadGame(slotId): 从指定槽位加载游戏.
// - deleteSave(slotId): 删除指定槽位的存档.
// - clearAllSaves(): 清除所有本地及世界书中的存档快照.
// - exportSave(slotId): 导出单个存档文件.
// - handleFileImport(event): 处理文件导入事件.
// - setupSaveManagerEventListeners(): 为存档管理器界面的按钮绑定事件监听器.
//
// 加载顺序:
// - 本文件应在 ui.js 和 worldbookManager.js 之后加载. 

function _getDisplayText(aiResponse) {
  try {
    if (!aiResponse || typeof aiResponse !== 'string') return '';
    const gameTextMatch = /<gametxt>([\s\S]*?)<\/gametxt>/i.exec(aiResponse);
    if (gameTextMatch && gameTextMatch[1]) {
      const commentRegex = new RegExp('<!--[\s\S]*?-->', 'g');
      return gameTextMatch[1].replace(commentRegex, '').trim();
    }
    return aiResponse
      .replace(
        /<\[\/]?((本世历程|往世涟漪|UpdateVariable|角色提取|thinking|gametxt|开局设定|行动选项|action))[\s\S]*?>/gi,
        '',
      )
      .trim();
  } catch (e) {
    console.error('解析显示文本时出错:', e);
    return '[摘要解析失败]';
  }
}

function getSavesFromStorage() {
  try {
    const saves = localStorage.getItem('guixu_multi_save_data');
    return saves ? JSON.parse(saves) : {};
  } catch (e) {
    console.error('获取存档失败:', e);
    guiXuAlert('错误：主存档文件已损坏，无法读取。', '错误');
    return {};
  }
}

function showSaveLoadManager() {
  const modal = document.getElementById('save-load-modal');
  const container = modal.querySelector('.modal-body');
  if (!modal || !container) return;

  modal.style.display = 'flex';
  const saves = getSavesFromStorage();

  let autoHtml = `<h3 style="font-size: 14px; color: #8b7355; margin-bottom: 10px;">自动存档</h3>`;
  const autoSlotIds = ['auto_save_slot_0', 'auto_save_slot_1'];
  let hasAutoSaves = false;
  autoSlotIds.forEach(slotId => {
    if (saves[slotId]) hasAutoSaves = true;
    autoHtml += renderSlot(saves[slotId], slotId, true);
  });
  if (!hasAutoSaves)
    autoHtml += `<p style="text-align:center; color:#8b7355; font-size:12px; font-style: italic;">暂无自动存档。</p>`;

  let manualHtml = `<h3 style="font-size: 14px; color: #8b7355; margin-top: 20px; margin-bottom: 10px; border-top: 1px solid rgba(201, 170, 113, 0.3); padding-top: 15px;">手动存档</h3>`;
  let hasManualSaves = false;
  for (let i = 1; i <= 5; i++) {
    const slotId = `slot_${i}`;
    if (saves[slotId]) hasManualSaves = true;
    manualHtml += renderSlot(saves[slotId], slotId, false);
  }
  if (!hasManualSaves)
    manualHtml += `<p style="text-align:center; color:#8b7355; font-size:12px; font-style: italic;">暂无手动存档。</p>`;

  container.innerHTML = autoHtml + manualHtml;
}

function renderSlot(saveData, slotId, isAutoSave) {
  const actionsHtml = `
          <div class="save-slot-actions">
              <button class="theme-btn theme-btn-gold btn-small" data-action="load-slot" ${!saveData ? 'disabled' : ''}>读档</button>
              <button class="theme-btn theme-btn-gold btn-small" data-action="export-slot" ${!saveData ? 'disabled' : ''}>导出</button>
              <button class="theme-btn theme-btn-red btn-small" data-action="delete-slot" ${!saveData ? 'disabled' : ''}>删除</button>
          </div>`;

  let contentHtml;
  const statData = saveData?.mvu_data?.stat_data || saveData?.mvu_data;
  const defaultName = isAutoSave
    ? slotId === 'auto_save_slot_0'
      ? '最新自动存档'
      : '上一次自动存档'
    : `存档 ${slotId.split('_')[1]}`;

  if (statData) {
    const saveName = saveData.save_name || defaultName;
    const date = new Date(saveData.timestamp).toLocaleString('zh-CN');
    const jingjie = statData['当前境界']?.[0] || '未知';
    const jinian = statData['当前时间纪年']?.[0] || '未知';
    const summary = _getDisplayText(saveData.message_content);
    contentHtml = `
              <div class="slot-name">${saveName}</div>
              ${actionsHtml}
              <div class="slot-time">${date} - ${jingjie} - ${jinian}</div>
              <div class="slot-summary">${summary ? summary.substring(0, 40) + '...' : '无正文记录'}</div>`;
  } else {
    contentHtml = `
              <div class="slot-name">${defaultName}</div>
              ${actionsHtml}
              <div class="slot-time" style="font-style: italic; color: #8b7355;">空存档位</div>`;
  }
  return `<div class="save-slot" data-slot-id="${slotId}"><div class="save-slot-info">${contentHtml}</div></div>`;
}

async function loadGame(slotId) {
  const allSaves = getSavesFromStorage();
  const saveData = allSaves[slotId];
  if (!saveData) return;

  const saveName = saveData.save_name || slotId;
  if (!(await guiXuConfirm(`确定要读取存档“${saveName}”吗？当前所有未保存的进度将会被覆盖。`))) return;

  const loadingOverlay = document.getElementById('loading-overlay');
  loadingOverlay.innerHTML = `<p>正在读取“${saveName}”的记忆...</p>`;
  loadingOverlay.style.display = 'flex';

  try {
    const messages = await getChatMessages(0);
    if (!messages || !messages.length === 0) throw new Error('无法获取第0层消息，无法读档。');

    const messageZero = messages[0];
    messageZero.data = saveData.mvu_data;
    messageZero.message = saveData.message_content || '';

    // --- 新增：从独立世界书恢复到当前序号 ---
    if (saveData.lorebook_entries) {
      const entries = saveData.lorebook_entries;
      const bookName = WorldBookManager.LOREBOOK_NAME;
      const unifiedIndexInput = document.getElementById('unified-index-input');
      const currentIndex = unifiedIndexInput ? parseInt(unifiedIndexInput.value, 10) : 1;

      const currentJourneyKey = currentIndex > 1 ? `本世历程(${currentIndex})` : '本世历程';
      const currentPastLivesKey = currentIndex > 1 ? `往世涟漪(${currentIndex})` : '往世涟漪';
      const currentNovelModeKey = currentIndex > 1 ? `小说模式(${currentIndex})` : '小说模式'; // 简化处理

      await TavernHelper.updateWorldbookWith(bookName, async allEntries => {
        const findOrCreate = (targetKey, sourceKey, baseKey, order) => {
          const sourceEntry = allEntries.find(e => e.name === entries[sourceKey]);
          const targetEntry = allEntries.find(e => e.name === targetKey);
          if (sourceEntry) {
            if (targetEntry) {
              targetEntry.content = sourceEntry.content || '';
            } else {
              const base = allEntries.find(e => e.name === baseKey) || {};
              allEntries.push({
                ...base,
                uid: undefined,
                name: targetKey,
                content: sourceEntry.content || '',
                strategy: { ...base.strategy, keys: [...(base.strategy?.keys || []), targetKey] },
                enabled: true,
                position: { ...base.position, order },
              });
            }
          }
        };
        findOrCreate(currentJourneyKey, 'journey_entry_name', '本世历程', 20);
        findOrCreate(currentPastLivesKey, 'past_lives_entry_name', '往世涟漪', 19);
        findOrCreate(currentNovelModeKey, 'novel_mode_entry_name', '小说模式', 18); 

        return allEntries;
      });
      console.log(`[归墟读档] 已将存档"${saveName}"的世界书数据覆写到当前序号 ${currentIndex}`);
    }

    await TavernHelper.setChatMessages([messageZero], { refresh: 'all' });
    await guiXuAlert('读档成功！页面将刷新以应用所有更改。');
    window.location.reload();
  } catch (error) {
    console.error('读档失败:', error);
    await guiXuAlert(`读档失败: ${error.message}`, '错误');
  } finally {
    loadingOverlay.style.display = 'none';
  }
}

async function deleteSave(slotId) {
  const allSaves = getSavesFromStorage();
  const saveDataToDelete = allSaves[slotId];
  if (!saveDataToDelete) return;

  const slotName = saveDataToDelete.save_name || `存档${slotId.replace(/slot_|auto_save_slot_/, '')}`;
  let confirmMsg = `确定要删除存档 "${slotName}" 吗？此操作不可恢复。`;
  if (saveDataToDelete.lorebook_entries) {
    confirmMsg += `\n相关的世界书条目也会被一并删除。`;
  }

  if (await guiXuConfirm(confirmMsg)) {
    try {
      if (saveDataToDelete.lorebook_entries) {
        const bookName = WorldBookManager.LOREBOOK_NAME;
        const entryNamesToDelete = Object.values(saveDataToDelete.lorebook_entries);
        await TavernHelper.updateWorldbookWith(bookName, worldbook => {
          return worldbook.filter(e => !entryNamesToDelete.includes(e.name));
        });
      }
      delete allSaves[slotId];
      localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
      await guiXuAlert(`"${slotName}" 已删除。`);
      showSaveLoadManager();
    } catch (error) {
      console.error('删除存档失败:', error);
      await guiXuAlert(`删除存档失败: ${error.message}`, '错误');
    }
  }
}

// === 功能升级: "清除所有存档"功能强化 ===
async function clearAllSaves() {
  const allSaves = getSavesFromStorage();
  const hasLocalStorageSaves = Object.keys(allSaves).length > 0;
  const bookName = WorldBookManager.LOREBOOK_NAME;
  const lorebookCommentsToDelete = new Set();
  let uidsToDelete = [];

  try {
    document.getElementById('loading-overlay').style.display = 'flex';
    const allLorebookEntries = await TavernHelper.getWorldbook(bookName);

    // 强化后的正则表达式，匹配各种存档残留格式
    const snapshotRegex = /^(.*?)[:：-]\s*(本世历程|往世涟漪|小说模式)(\(\d+\))?$/i;

    // 1. 扫描世界书，寻找匹配的残留条目
    allLorebookEntries.forEach(entry => {
      const trimmedName = entry.name ? entry.name.trim() : '';
      if (snapshotRegex.test(trimmedName)) {
        lorebookCommentsToDelete.add(trimmedName);
      }
    });

    // 2. 检查旧存档文件中的链接，确保兼容性
    Object.values(allSaves).forEach(save => {
      if (save.lorebook_entries) {
        Object.values(save.lorebook_entries).forEach(name => {
          if (name) lorebookCommentsToDelete.add(name);
        });
      }
    });

    // 3. 根据收集到的名称获取最终的UID列表
    uidsToDelete = allLorebookEntries
      .filter(entry => lorebookCommentsToDelete.has(entry.name ? entry.name.trim() : ''))
      .map(entry => entry.uid);

    const hasLorebookSnapshots = uidsToDelete.length > 0;
    if (!hasLocalStorageSaves && !hasLorebookSnapshots) {
      await guiXuAlert('没有可清除的存档数据。');
      return;
    }

    let confirmMsg = `你确定要清除所有存档吗？此操作不可恢复.\n\n`;
    confirmMsg += hasLocalStorageSaves
      ? `> 将删除 ${Object.keys(allSaves).length} 个本地存档槽位.\n`
      : `> 未找到本地存档槽位.\n`;

    if (hasLorebookSnapshots) {
      const namesToList = Array.from(lorebookCommentsToDelete).sort().join('\n- ');
      confirmMsg += `> 将从世界书【${bookName}】中删除以下 ${uidsToDelete.length} 个关联的快照条目：\n- ${namesToList}`;
    } else {
      confirmMsg += `> 未在世界书中找到需要删除的存档快照。`;
    }

    if (!(await guiXuConfirm(confirmMsg, '高危操作确认'))) return;

    // 4. 执行删除
    if (hasLorebookSnapshots) {
      await TavernHelper.updateWorldbookWith(bookName, worldbook => {
        return worldbook.filter(entry => !uidsToDelete.includes(entry.uid));
      });
    }
    if (hasLocalStorageSaves) {
      localStorage.removeItem('guixu_multi_save_data');
    }

    await guiXuAlert(`所有存档及关联的世界书快照已清除。`);
    showSaveLoadManager(); // Refresh the save list UI
  } catch (error) {
    console.error('清除所有存档时出错:', error);
    await guiXuAlert(`清除存档失败: ${error.message}`, '错误');
  } finally {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

async function exportSave(slotId) {
  const allSaves = getSavesFromStorage();
  const saveData = allSaves[slotId];
  if (!saveData) return;

  try {
    const dataToExport = {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      saveData: saveData,
      lorebookData: [],
    };

    if (saveData.lorebook_entries) {
      const bookName = WorldBookManager.LOREBOOK_NAME;
      const entryNames = Object.values(saveData.lorebook_entries);
      const allEntries = await TavernHelper.getWorldbook(bookName);
      dataToExport.lorebookData = allEntries.filter(e => entryNames.includes(e.name));
    }

    const fileName = `${(saveData.save_name || `guixu_save_${slotId}`).replace(/[^a-z0-9]/gi, '_')}.json`;
    exportData(JSON.stringify(dataToExport, null, 2), fileName);
    await guiXuAlert('存档已成功导出！');
  } catch (error) {
    console.error('导出存档失败:', error);
    await guiXuAlert(`导出失败: ${error.message}`, '错误');
  }
}

async function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const importedData = JSON.parse(e.target.result);
      let saveDataToImport;
      let lorebookDataToImport = [];

      if (importedData.exportVersion === '1.0') {
        // New format
        saveDataToImport = importedData.saveData;
        lorebookDataToImport = importedData.lorebookData || [];
      } else {
        // Old format
        saveDataToImport = importedData;
      }

      if (!saveDataToImport || !saveDataToImport.timestamp || !saveDataToImport.mvu_data) {
        throw new Error('存档文件格式无效。');
      }

      const slotId = await promptForSlotSelection(saveDataToImport.save_name || '导入的存档');
      if (!slotId) return;

      const allSaves = getSavesFromStorage();
      const bookName = WorldBookManager.LOREBOOK_NAME;

      // Handle lorebook entries
      if (lorebookDataToImport.length > 0) {
        await TavernHelper.updateWorldbookWith(bookName, worldbook => {
          const existingNames = new Set(worldbook.map(e => e.name));
          lorebookDataToImport.forEach(entry => {
            if (!existingNames.has(entry.name)) {
              const { uid, ...newEntry } = entry;
              worldbook.push(newEntry);
            }
          });
          return worldbook;
        });
      }

      allSaves[slotId] = saveDataToImport;
      localStorage.setItem('guixu_multi_save_data', JSON.stringify(allSaves));
      await guiXuAlert(`存档已成功导入到 ${slotId.replace('slot_', '存档位 ')}。`);
      showSaveLoadManager();
    } catch (error) {
      await guiXuAlert(`导入失败: ${error.message}`, '错误');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function promptForSlotSelection(importName) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display: flex; z-index: 2001;';
    let slotsHtml = '';
    for (let i = 1; i <= 5; i++)
      slotsHtml += `<button class="theme-btn theme-btn-gold" data-slot-id="slot_${i}">存档位 ${i}</button>`;
    modal.innerHTML = `
            <div class="modal-content" style="width: 450px; height: auto;">
              <h2 class="modal-title">选择导入位置</h2>
              <div class="modal-body" style="padding: 20px;">
                <p>请选择一个存档位以导入 "${importName}":</p>
                <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top:20px;">${slotsHtml}</div>
                <div class="modal-actions"><button class="theme-btn theme-btn-red" id="import-cancel-btn">取消</button></div>
              </div>
            </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      const target = e.target;
      if (target.dataset.slotId) {
        resolve(target.dataset.slotId);
        modal.remove();
      } else if (target.id === 'import-cancel-btn' || target === modal) {
        resolve(null);
        modal.remove();
      }
    });
  });
}

function setupSaveManagerEventListeners() {
  document.getElementById('show-save-manager-btn').addEventListener('click', showSaveLoadManager);
  const modal = document.getElementById('save-load-modal');
  if (!modal) return;
  modal.addEventListener('click', e => {
    const button = e.target.closest('[data-action]');
    if (e.target.matches('.modal-overlay')) modal.style.display = 'none';
    if (!button) return;
    const action = button.dataset.action;
    const slotId = button.closest('.save-slot')?.dataset.slotId;
    switch (action) {
      case 'close-modal':
        modal.style.display = 'none';
        break;
      case 'load-slot':
        if (slotId) loadGame(slotId);
        break;
      case 'export-slot':
        if (slotId) exportSave(slotId);
        break;
      case 'delete-slot':
        if (slotId) deleteSave(slotId);
        break;
      case 'import-save':
        document.getElementById('import-save-file-input').click();
        break;
      case 'clear-all-saves':
        clearAllSaves();
        break;
    }
  });
  document.getElementById('import-save-file-input').addEventListener('change', handleFileImport);
}
